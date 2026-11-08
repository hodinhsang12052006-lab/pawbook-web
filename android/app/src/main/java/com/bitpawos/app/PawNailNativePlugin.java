package com.bitpawos.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

// Cầu nối nhỏ giữa web (lib/nativePush.ts, màn chat) và phần native của app.
//
// getInfo().firebase: bản app có cấu hình Firebase (google-services.json) hay không. Thiếu
// file đó mà vẫn gọi PushNotifications.register() thì FirebaseMessaging.getInstance() ném
// IllegalStateException và app CRASH. Bản build cũ không có plugin này → web coi như chưa
// hỗ trợ thông báo đẩy native.
//
// Cuộc gọi (versionCode 4+, getInfo().calls = 1): startOngoingCall / updateOngoingCall / stopOngoingCall (foreground
// service giữ micro / camera khi rời app, giữ màn hình sáng khi gọi video, cảm biến tiệm cận khi nghe bằng loa trong),
// setAudioRoute / getAudioState (nút Loa), takeCallAction + sự kiện "callAction" ({action: "hangup" | "answer" |
// "declined", callId?}) từ thông báo. Web dò từng hàm (lib/calls/nativeCallBridge.ts): bản app cũ giữ hành vi cũ.
@CapacitorPlugin(name = "PawNailNative")
public class PawNailNativePlugin extends Plugin {

    /** Phiên bản bộ vẽ thông báo chat native (tin data-only type=chat, v=1). */
    private static final int CHAT_RENDERER = 1;
    /** Phiên bản phần cuộc gọi native (foreground service + âm thanh + thông báo cuộc gọi data-only, versionCode 4). */
    private static final int CALLS_VERSION = 1;
    static final String EVENT_CALL_ACTION = "callAction";

    /** Plugin của WebView chính đang sống (thông báo → web). */
    private static volatile WeakReference<PawNailNativePlugin> current = new WeakReference<>(null);

    @Override
    public void load() {
        current = new WeakReference<>(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (current.get() == this) current = new WeakReference<>(null);
        // WebView chính bị huỷ = cuộc gọi trong nó đã mất: không giữ micro / chế độ âm thanh / màn hình.
        Context app = getContext().getApplicationContext();
        OngoingCallService.stop(app);
        CallAudio.get().end(app);
    }

    /**
     * Native → web: "hangup" (nút Kết thúc của thông báo đang gọi), "answer" / "declined" (thông báo cuộc gọi đến).
     * @return true nếu trang web đang có người nghe sự kiện (đã giao).
     */
    static boolean emitCallAction(String action, String callId) {
        PawNailNativePlugin p = current.get();
        if (p == null || !p.hasListeners(EVENT_CALL_ACTION)) return false;
        JSObject o = new JSObject();
        o.put("action", action);
        if (callId != null) o.put("callId", callId);
        try {
            p.notifyListeners(EVENT_CALL_ACTION, o);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /**
     * { firebase, sdk, bubbles (API 30+), bubblePref ("all"|"selected"|"none", API 31+, khác:
     * null), notificationsEnabled, messagesChannel (kênh "Tin nhắn" chưa bị tắt), chat (1) }
     */
    @PluginMethod
    public void getInfo(PluginCall call) {
        Context ctx = getContext();
        // Plugin com.google.gms.google-services sinh chuỗi google_app_id từ
        // google-services.json; Firebase tự khởi tạo từ chính chuỗi này.
        int firebaseAppId = ctx.getResources().getIdentifier("google_app_id", "string", ctx.getPackageName());
        JSObject ret = new JSObject();
        ret.put("firebase", firebaseAppId != 0);
        ret.put("sdk", Build.VERSION.SDK_INT);
        ret.put("bubbles", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R);
        ret.put("bubblePref", bubblePreference(ctx));
        ret.put("notificationsEnabled", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        ret.put("messagesChannel", ChatNotifications.messagesChannelEnabled(ctx));
        ret.put("chat", CHAT_RENDERER);
        ret.put("calls", CALLS_VERSION);
        call.resolve(ret);
    }

    // ---------------------------------------------------------------------------------
    // Cuộc gọi đang diễn ra (CallManager.tsx)
    // ---------------------------------------------------------------------------------

    /**
     * { peerName, video (bố cục video), camera (camera của mình đang bật), state: "calling" | "connecting" |
     * "connected", since (ms, lúc thông) } → { started, audio }. Gọi khi app đang ở tiền cảnh (vừa bấm gọi / nghe máy):
     * Android 12+ không cho bật foreground service micro / camera từ nền.
     */
    @PluginMethod
    public void startOngoingCall(PluginCall call) {
        Context ctx = getContext();
        boolean video = Boolean.TRUE.equals(call.getBoolean("video", false));
        JSObject ret = new JSObject();
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ret.put("started", false);
            ret.put("reason", "microphone");
            call.resolve(ret);
            return;
        }
        boolean started = OngoingCallService.start(
            ctx,
            call.getString("peerName", ""),
            video,
            Boolean.TRUE.equals(call.getBoolean("camera", false)),
            call.getString("state"),
            longArg(call, "since")
        );
        CallAudio.get().begin(ctx, video);
        keepScreenOn(CallLogic.keepScreenOn(video));
        ret.put("started", started);
        ret.put("audio", CallAudio.get().state(ctx));
        call.resolve(ret);
    }

    /** Cùng tham số với startOngoingCall: đổi chữ của thông báo (đang gọi → đã thông + đồng hồ), thoại ↔ video. */
    @PluginMethod
    public void updateOngoingCall(PluginCall call) {
        Context ctx = getContext();
        boolean video = Boolean.TRUE.equals(call.getBoolean("video", false));
        boolean running = OngoingCallService.isRunning();
        if (running) {
            running = OngoingCallService.start(
                ctx,
                call.getString("peerName", ""),
                video,
                Boolean.TRUE.equals(call.getBoolean("camera", false)),
                call.getString("state"),
                longArg(call, "since")
            );
        }
        if (CallAudio.get().isActive()) CallAudio.get().setVideo(ctx, video);
        keepScreenOn(CallLogic.keepScreenOn(video));
        JSObject ret = new JSObject();
        ret.put("started", running);
        ret.put("audio", CallAudio.get().state(ctx));
        call.resolve(ret);
    }

    /** Cuộc gọi kết thúc: tắt service + thông báo, trả lại chế độ âm thanh, thôi giữ màn hình sáng / cảm biến tiệm cận. */
    @PluginMethod
    public void stopOngoingCall(PluginCall call) {
        Context ctx = getContext();
        OngoingCallService.stop(ctx);
        CallAudio.get().end(ctx);
        keepScreenOn(false);
        call.resolve();
    }

    /** { route: "speaker" | "earpiece" | "auto" } → trạng thái âm thanh (nút Loa của màn hình gọi). */
    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        Context ctx = getContext();
        CallAudio.get().setRoute(ctx, call.getString("route", "auto"));
        JSObject ret = CallAudio.get().state(ctx);
        ret.put("ongoing", OngoingCallService.isRunning());
        call.resolve(ret);
    }

    /** { active, route, earpiece, headset, bluetooth, ongoing } */
    @PluginMethod
    public void getAudioState(PluginCall call) {
        JSObject ret = CallAudio.get().state(getContext());
        ret.put("ongoing", OngoingCallService.isRunning());
        call.resolve(ret);
    }

    /** Hành động đang chờ từ thông báo cuộc gọi (mở app bằng nút Trả lời): { action, callId } một lần, hoặc {}. */
    @PluginMethod
    public void takeCallAction(PluginCall call) {
        String[] a = AppState.takePendingCallAction();
        JSObject ret = new JSObject();
        if (a != null) {
            ret.put("action", a[0]);
            ret.put("callId", a[1]);
        }
        call.resolve(ret);
    }

    private void keepScreenOn(boolean on) {
        Activity a = getActivity();
        if (a == null) return;
        a.runOnUiThread(() -> {
            try {
                if (on) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } catch (RuntimeException ignored) {}
        });
    }

    private static long longArg(PluginCall call, String name) {
        Object v = call.getData().opt(name);
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            return Double.isFinite(d) && d > 0 ? (long) d : 0;
        }
        return 0;
    }

    /**
     * { id: string | null } — hội thoại web đang mở (null = không mở / rời trang chat / tab ẩn).
     * Trong lúc app ở tiền cảnh, tin của hội thoại này không hiện thông báo native.
     */
    @PluginMethod
    public void setActiveConversation(PluginCall call) {
        String id = call.getString("id");
        if (id != null && !AppLinks.isConversationId(id)) {
            call.reject("invalid conversation id");
            return;
        }
        AppState.setActiveConversation(id);
        // Đang xem hội thoại → gỡ thông báo của nó (như Messenger).
        if (id != null && AppState.isMainResumed()) ChatNotifications.clear(getContext(), id);
        call.resolve();
    }

    /** { id } — gỡ thông báo của hội thoại và quên lịch sử đã lưu cho nó. */
    @PluginMethod
    public void clearConversation(PluginCall call) {
        String id = call.getString("id");
        if (!AppLinks.isConversationId(id)) {
            call.reject("invalid conversation id");
            return;
        }
        ChatNotifications.clear(getContext(), id);
        call.resolve();
    }

    /**
     * Đăng xuất (web gọi TRƯỚC signOut): gỡ mọi thông báo, xoá lịch sử tin đã lưu, lối tắt hội thoại và ảnh đại diện
     * cache — máy dùng chung không để lộ tin của tài khoản trước. Chạy nền, trả lời khi xong.
     */
    @PluginMethod
    public void clearAll(PluginCall call) {
        Context app = getContext().getApplicationContext();
        ChatNotifications.runAsync(() -> {
            try {
                ChatNotifications.clearAll(app);
            } finally {
                call.resolve();
            }
        });
    }

    /** Màn cài đặt bong bóng của app (Android 11+); máy cũ hơn: cài đặt thông báo. */
    @PluginMethod
    public void openBubbleSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_BUBBLE_SETTINGS).putExtra(
                Settings.EXTRA_APP_PACKAGE,
                getContext().getPackageName()
            );
            if (start(i)) {
                call.resolve();
                return;
            }
        }
        openNotificationSettings(call);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context ctx = getContext();
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        } else {
            i = appDetails(ctx);
        }
        if (start(i) || start(appDetails(ctx))) call.resolve();
        else call.reject("settings unavailable");
    }

    private static Intent appDetails(Context ctx) {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.getPackageName(), null));
    }

    private boolean start(Intent i) {
        try {
            if (getActivity() != null) {
                getActivity().startActivity(i);
            } else {
                getContext().startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }

    private static Object bubblePreference(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return JSObject.NULL;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return JSObject.NULL;
        switch (nm.getBubblePreference()) {
            case NotificationManager.BUBBLE_PREFERENCE_ALL:
                return "all";
            case NotificationManager.BUBBLE_PREFERENCE_SELECTED:
                return "selected";
            default:
                return "none";
        }
    }

}
