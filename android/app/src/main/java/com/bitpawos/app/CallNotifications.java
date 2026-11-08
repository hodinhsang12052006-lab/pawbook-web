package com.bitpawos.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.Map;

/**
 * Thông báo cuộc gọi do app TỰ VẼ (versionCode 4+; máy chủ chỉ gửi tin data-only "call" / "call-end" cho token có build
 * ≥ 4 — lib/fcm.ts nativeCallMinBuild), như tin chat (ChatNotifications):
 *  - "call": thông báo đổ chuông trên kênh "calls" (hiện nổi, chuông LẶP — FLAG_INSISTENT — tới khi trả lời / từ chối /
 *    vuốt bỏ / hết giờ đổ chuông), nút "Từ chối" (CallActionReceiver: POST /api/calls reject bằng cookie WebView, như trả
 *    lời nhanh tin chat) và "Trả lời" (mở app — MainActivity báo web tự nghe máy cuộc gọi đó). Chạm vào thông báo: mở
 *    app, web đổ chuông trong app (không tự nghe). KHÔNG full-screen intent (chính sách Play), KHÔNG ConnectionService.
 *  - "call-end" cùng tag: đã trả lời / từ chối (máy khác) → gỡ; nhỡ → "Cuộc gọi nhỡ từ X" (CallLogic.onCallEnd).
 * Định danh: tag "pn-call-<callId>", id 0 — đúng tag mà dạng "notification" của máy chủ / web dùng (callNotice.ts gỡ
 * được bằng PushNotifications.removeDeliveredNotifications).
 */
final class CallNotifications {

    private static final String TAG = "PawNailCall";

    static final int ID = 0;
    /** Intent extra (String): callId cần TỰ NGHE MÁY khi mở app (nút Trả lời). Chỉ intent mang khoá nội bộ. */
    static final String EXTRA_ANSWER = "pn_call_answer";
    /** Intent extra (String): callId của thông báo vừa chạm (mở app, gỡ thông báo đổ chuông — web đổ chuông trong app). */
    static final String EXTRA_OPEN = "pn_call_open";
    static final String EXTRA_CALL_ID = "pn_call_id";
    static final String EXTRA_CALLER_ID = "pn_caller_id";
    static final String EXTRA_CALL_TOKEN = "pn_call_token";
    static final String ACTION_ANSWER = "com.bitpawos.app.action.ANSWER_CALL";
    static final String ACTION_OPEN = "com.bitpawos.app.action.OPEN_CALL";

    /** Chờ ảnh người gọi (lần đầu) tối đa bấy nhiêu rồi đổ chuông bằng chữ cái đầu — chuông không bao giờ chờ mạng. */
    private static final long AVATAR_WAIT_MS = 1200;
    private static final String PREFS = "pn_app";
    private static final String KEY_ENDED = "ended_calls";
    private static final long[] RING_VIBRATION = { 0, 800, 600, 800, 600 };

    private CallNotifications() {}

    // ---------------------------------------------------------------------------------
    // Tin đến
    // ---------------------------------------------------------------------------------

    /** data.type == "call" */
    static void onIncoming(Context ctx, Map<String, String> d) {
        String callId = d.get("callId");
        String callerId = d.get("callerId");
        String token = d.get("token");
        if (!CallLogic.isCallId(callId) || !CallLogic.isUserId(callerId) || !CallLogic.isCallToken(token)) return;
        ChatNotifications.ensureChannelsOnce(ctx);
        if (!ChatNotifications.canPost(ctx)) return;
        boolean video = "video".equals(d.get("callType"));
        long now = System.currentTimeMillis();
        long exp = CallLogic.parseLong(d.get("exp"), 0);
        String name = callerName(ctx, d);
        String url = safeUrl(d.get("url"), callerId);
        int decision = CallLogic.onIncoming(now, exp, isEnded(ctx, callId), AppState.isMainResumed());
        if (decision == CallLogic.IN_IGNORE) return;
        if (decision == CallLogic.IN_MISSED) {
            String title = ChatNotifications.clean(d.get("mtitle"), 120);
            String body = ChatNotifications.clean(d.get("mbody"), 200);
            postMissed(ctx, callId, name, video, title, body, url, !AppState.isMainResumed() && !isShown(ctx, callId));
            return;
        }
        // Ảnh người gọi: có cache → dùng ngay; chưa → chờ tối đa AVATAR_WAIT_MS (không vẽ lại sau: cập nhật thông báo đang
        // đổ chuông có thể làm tiếng chuông dừng / phát lại).
        String avatar = d.get("avatar");
        ChatAvatars.prefetch(ctx, avatar, AVATAR_WAIT_MS);
        Bitmap square = ChatAvatars.loadSquare(ctx, avatar, false);
        String subtitle = ChatNotifications.clean(d.get("title"), 80);
        if (subtitle.isEmpty()) subtitle = ctx.getString(video ? R.string.call_incoming_video : R.string.call_incoming_voice);
        postRinging(ctx, callId, callerId, token, name, subtitle, url, square, CallLogic.ringTimeoutMs(now, exp));
    }

    /** data.type == "call-end" */
    static void onEnd(Context ctx, Map<String, String> d) {
        String callId = d.get("callId");
        String callerId = d.get("callerId");
        if (!CallLogic.isCallId(callId) || !CallLogic.isUserId(callerId)) return;
        rememberEnded(ctx, callId);
        boolean shown = isShown(ctx, callId);
        int action = CallLogic.onCallEnd(d.get("outcome"), shown, AppState.isMainResumed());
        switch (action) {
            case CallLogic.END_CANCEL:
                cancel(ctx, callId);
                break;
            case CallLogic.END_MISSED_SILENT:
            case CallLogic.END_MISSED_ALERT: {
                ChatNotifications.ensureChannelsOnce(ctx);
                String title = ChatNotifications.clean(d.get("title"), 120);
                String body = ChatNotifications.clean(d.get("body"), 200);
                postMissed(ctx, callId, callerName(ctx, d), "video".equals(d.get("callType")), title, body, safeUrl(d.get("url"), callerId), action == CallLogic.END_MISSED_ALERT);
                break;
            }
            default:
                break;
        }
    }

    // ---------------------------------------------------------------------------------
    // Vẽ
    // ---------------------------------------------------------------------------------

    private static void postRinging(Context ctx, String callId, String callerId, String token, String name, String subtitle, String url, Bitmap square, long timeoutMs) {
        int accent = ContextCompat.getColor(ctx, R.color.pn_notification_accent);
        String key = "u:" + callerId;
        Bitmap circle = square != null
            ? ChatAvatars.circle(square, ChatAvatars.PERSON_PX)
            : ChatAvatars.initialsCircle(name, key, ChatAvatars.PERSON_PX);
        Person caller = new Person.Builder().setName(name).setKey(key).setIcon(IconCompat.createWithBitmap(circle)).setImportant(true).build();

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ChatNotifications.CHANNEL_CALLS)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setLargeIcon(circle)
            .setContentTitle(name)
            .setContentText(subtitle)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .addPerson(caller)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true) // FCM giao trùng: không đổ chuông lại từ đầu
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setTimeoutAfter(timeoutMs)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(activityIntent(ctx, ACTION_OPEN, EXTRA_OPEN, callId, url, 1))
            .addAction(R.drawable.ic_stat_pawnail, ctx.getString(R.string.call_decline), declineIntent(ctx, callId, callerId, token))
            .addAction(R.drawable.ic_stat_pawnail, ctx.getString(R.string.call_answer), activityIntent(ctx, ACTION_ANSWER, EXTRA_ANSWER, callId, url, 2));
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            // Android 7.x không có kênh: âm thanh / rung đặt trên chính thông báo.
            b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), AudioManager.STREAM_RING);
            b.setVibrate(RING_VIBRATION);
        }
        Notification n = b.build();
        // Chuông lặp tới khi thông báo bị gỡ (trả lời / từ chối / vuốt / timeoutAfter) — như điện thoại đổ chuông.
        n.flags |= Notification.FLAG_INSISTENT;
        notify(ctx, callId, n);
    }

    private static void postMissed(Context ctx, String callId, String name, boolean video, String title, String body, String url, boolean alert) {
        if (!ChatNotifications.canPost(ctx)) return;
        // Gỡ TRƯỚC: cập nhật đè lên thông báo đang đổ chuông không dừng được tiếng chuông lặp trên mọi bản Android.
        cancel(ctx, callId);
        if (title.isEmpty()) title = ctx.getString(video ? R.string.call_missed_video_title : R.string.call_missed_title, name);
        if (body.isEmpty()) body = ctx.getString(R.string.call_missed_body);
        int accent = ContextCompat.getColor(ctx, R.color.pn_notification_accent);
        Notification pub = new NotificationCompat.Builder(ctx, ChatNotifications.CHANNEL_GENERAL)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setContentTitle(ctx.getString(R.string.app_name))
            .setContentText(ctx.getString(R.string.call_missed_public))
            .build();
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ChatNotifications.CHANNEL_GENERAL)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setSilent(!alert)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(pub)
            .setContentIntent(activityIntent(ctx, ACTION_OPEN, EXTRA_OPEN, callId, url, 3));
        if (alert && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) b.setDefaults(NotificationCompat.DEFAULT_ALL);
        notify(ctx, callId, b.build());
    }

    private static void notify(Context ctx, String callId, Notification n) {
        try {
            NotificationManagerCompat.from(ctx).notify(CallLogic.tagFor(callId), ID, n);
        } catch (RuntimeException e) {
            Log.w(TAG, "notify failed: " + e.getClass().getSimpleName());
        }
    }

    // ---------------------------------------------------------------------------------
    // Intent
    // ---------------------------------------------------------------------------------

    private static int requestCode(String callId, int kind) {
        return callId.hashCode() * 8 + kind;
    }

    /** Mở app chính (Activity trực tiếp — Android 12 cấm "trampoline"), path của cuộc trò chuyện với người gọi. */
    private static PendingIntent activityIntent(Context ctx, String action, String extra, String callId, String url, int kind) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setAction(action)
            .setData(Uri.parse("pawnail-call://" + kind + "/" + Uri.encode(callId)))
            .putExtra(AppLinks.EXTRA_URL, url)
            .putExtra(extra, callId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) i.setIdentifier("call:" + kind + ":" + callId);
        return PendingIntent.getActivity(ctx, requestCode(callId, kind), AppLinks.withKey(ctx, i), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent declineIntent(Context ctx, String callId, String callerId, String token) {
        // Receiver không export + PendingIntent immutable: chỉ hệ thống (khi người dùng bấm) gửi được, token không lộ ra app khác.
        Intent i = new Intent(ctx, CallActionReceiver.class)
            .setAction(CallActionReceiver.ACTION_DECLINE)
            .setData(Uri.parse("pawnail-call://decline/" + Uri.encode(callId)))
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_CALLER_ID, callerId)
            .putExtra(EXTRA_CALL_TOKEN, token);
        return PendingIntent.getBroadcast(ctx, requestCode(callId, 4), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------------------------------------------------------------------------------
    // Trạng thái
    // ---------------------------------------------------------------------------------

    static void cancel(Context ctx, String callId) {
        if (!CallLogic.isCallId(callId)) return;
        try {
            NotificationManagerCompat.from(ctx).cancel(CallLogic.tagFor(callId), ID);
        } catch (RuntimeException e) {
            Log.w(TAG, "cancel failed: " + e.getClass().getSimpleName());
        }
    }

    static boolean isShown(Context ctx, String callId) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return false;
        String tag = CallLogic.tagFor(callId);
        try {
            for (StatusBarNotification s : nm.getActiveNotifications()) {
                if (s.getId() == ID && tag.equals(s.getTag())) return true;
            }
        } catch (RuntimeException ignored) {}
        return false;
    }

    /** Cuộc gọi đã kết thúc / đã bấm Từ chối: tin "đang gọi" tới muộn của nó không đổ chuông nữa (10 phút, 20 cuộc). */
    static synchronized void rememberEnded(Context ctx, String callId) {
        SharedPreferences p = prefs(ctx);
        String next = CallLogic.addEnded(p.getString(KEY_ENDED, ""), callId, System.currentTimeMillis(), CallLogic.ENDED_KEEP_MS, CallLogic.ENDED_MAX);
        p.edit().putString(KEY_ENDED, next).apply();
    }

    static synchronized boolean isEnded(Context ctx, String callId) {
        return CallLogic.isEnded(prefs(ctx).getString(KEY_ENDED, ""), callId, System.currentTimeMillis(), CallLogic.ENDED_KEEP_MS);
    }

    /** Đăng xuất: quên danh sách. */
    static synchronized void clearAll(Context ctx) {
        prefs(ctx).edit().remove(KEY_ENDED).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String callerName(Context ctx, Map<String, String> d) {
        String n = ChatNotifications.cleanName(d.get("name"), 60);
        return n.isEmpty() ? ctx.getString(R.string.app_name) : n;
    }

    private static String safeUrl(String url, String callerId) {
        return AppLinks.isSafePath(url) ? url : "/messages?to=" + callerId;
    }
}
