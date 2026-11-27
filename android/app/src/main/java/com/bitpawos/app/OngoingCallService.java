package com.bitpawos.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * "Đang trong cuộc gọi" (versionCode 4+): foreground service loại microphone để Android KHÔNG tắt micro của cuộc gọi
 * WebRTC trong WebView khi người dùng rời app hay tắt màn hình (trước đây bên kia thấy "X đã rời app — có thể không
 * nghe được bạn"). KHÔNG loại camera: rời app thì camera dừng, web tắt track video và báo bên kia "Tạm dừng video".
 *
 * Web bật / cập nhật / tắt qua PawNailNative.startOngoingCall / updateOngoingCall / stopOngoingCall (CallManager.tsx).
 * Thông báo bắt buộc của foreground service (chính sách Play): "Cuộc gọi với X · Chạm để quay lại cuộc gọi" + nút
 * "Kết thúc" → báo web (sự kiện callAction "hangup") để cúp máy đúng cách (gửi bye / reject cho bên kia). Android 12+:
 * kiểu CallStyle (chip cuộc gọi trên thanh trạng thái, Android 14+ không vuốt bỏ được).
 * Cập nhật (đang gọi → đã thông + đồng hồ, thoại ↔ video) chỉ đăng lại thông báo — KHÔNG gọi lại startForeground (app
 * thường đang ở nền lúc đó: Android 12+ có thể ném lỗi / kiểm lại quyền micro).
 * Không export; không START_STICKY (tiến trình chết = WebView chết = cuộc gọi đã mất, không có gì để giữ).
 */
public class OngoingCallService extends Service {

    private static final String TAG = "PawNailOngoingCall";

    static final String ACTION_START = "com.bitpawos.app.action.CALL_ONGOING";
    static final String ACTION_HANG_UP = "com.bitpawos.app.action.CALL_HANG_UP";
    static final String EXTRA_PEER = "peer";
    static final String EXTRA_VIDEO = "video";
    static final String EXTRA_STATE = "state";
    static final String EXTRA_SINCE = "since";

    static final int NOTIFICATION_ID = 0x0CA11;
    /** Web không tự tắt service sau khi bấm "Kết thúc" (JS đã chết / bị treo) → tự tắt sau ngần này. */
    private static final long HANG_UP_FALLBACK_MS = 5000;
    private static final long START_WAIT_MS = 1500;

    private static volatile boolean running = false;
    /** Thông báo CallStyle (Android 12+) được nhận; bị từ chối một lần → dùng kiểu thường cho tới hết cuộc gọi. */
    private static volatile boolean callStyle = true;
    private static volatile CountDownLatch startLatch;
    private static volatile boolean startOk;

    private final Handler main = new Handler(Looper.getMainLooper());

    /**
     * TẮT từ versionCode 5 (11/2026): Play Console bắt tờ khai "Foreground service permissions" (Microphone) KÈM video
     * minh hoạ, chưa có video → bản 1.3.1 bỏ service khỏi manifest (cùng 2 quyền FOREGROUND_SERVICE*), cuộc gọi khi rời
     * app chạy như 1.2.0. Bật lại: ENABLED = true + trả lại thẻ service và 2 quyền trong AndroidManifest + nộp tờ khai.
     * start() trả false → web coi như không có "đang trong cuộc gọi" native (lib/calls/nativeCallBridge).
     */
    static final boolean ENABLED = false;

    static boolean isRunning() {
        return running;
    }

    /**
     * Bật (gọi từ luồng plugin, KHÔNG phải luồng chính): startService khi app đang ở tiền cảnh (cuộc gọi vừa bắt đầu bằng
     * 1 lần chạm), rồi chờ service báo startForeground có được không (tối đa 1.5 s). Đang chạy → chỉ cập nhật thông báo.
     */
    static boolean start(Context ctx, String peer, boolean video, String state, long since) {
        if (!ENABLED) return false;
        if (running) return update(ctx, peer, video, state, since);
        Context app = ctx.getApplicationContext();
        Intent i = new Intent(app, OngoingCallService.class)
            .setAction(ACTION_START)
            .putExtra(EXTRA_PEER, peer)
            .putExtra(EXTRA_VIDEO, video)
            .putExtra(EXTRA_STATE, CallLogic.normState(state))
            .putExtra(EXTRA_SINCE, since);
        CountDownLatch latch = new CountDownLatch(1);
        startLatch = latch;
        startOk = false;
        callStyle = true;
        try {
            // startService (không phải startForegroundService): không có hạn "phải gọi startForeground trong 5 s" — nếu
            // Android từ chối foreground (app vừa sang nền, thiếu quyền) thì service chỉ tự dừng, không làm sập app.
            app.startService(i);
        } catch (IllegalStateException | SecurityException e) {
            Log.w(TAG, "start refused: " + e.getClass().getSimpleName());
            return false;
        }
        try {
            if (!latch.await(START_WAIT_MS, TimeUnit.MILLISECONDS)) return running;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return startOk;
    }

    /**
     * Đổi chữ của thông báo (đang gọi → đã thông + đồng hồ, thoại ↔ video): chỉ đăng lại thông báo cùng id — hệ thống giữ
     * nó là thông báo của foreground service. @return service đang chạy.
     */
    static boolean update(Context ctx, String peer, boolean video, String state, long since) {
        if (!running) return false;
        Context app = ctx.getApplicationContext();
        String name = peerName(app, peer);
        String st = CallLogic.normState(state);
        try {
            post(app, build(app, name, video, st, since, callStyle));
        } catch (RuntimeException e) {
            Log.w(TAG, "update: " + e.getClass().getSimpleName());
            if (callStyle) {
                callStyle = false;
                try {
                    post(app, build(app, name, video, st, since, false));
                } catch (RuntimeException ignored) {}
            }
        }
        return running;
    }

    static void stop(Context ctx) {
        // Ngay lập tức (onDestroy chạy sau, trên luồng chính): cuộc gọi kế tiếp bắt đầu ngay sau đó phải startService lại.
        running = false;
        Context app = ctx.getApplicationContext();
        try {
            app.stopService(new Intent(app, OngoingCallService.class));
        } catch (RuntimeException e) {
            Log.w(TAG, "stop: " + e.getClass().getSimpleName());
        }
    }

    @SuppressLint("MissingPermission") // không có quyền thông báo: hệ thống bỏ qua, service vẫn chạy
    private static void post(Context ctx, Notification n) {
        NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, n);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_HANG_UP.equals(action)) {
            // Web cúp máy (bye + reject cho bên kia) rồi tự gọi stopOngoingCall; không còn web nghe / web không tắt kịp →
            // tự tắt, trả cả chế độ âm thanh (FLAG_KEEP_SCREEN_ON được gỡ ở lần dừng / tải trang sau).
            boolean delivered = PawNailNativePlugin.emitCallAction("hangup", null);
            main.postDelayed(
                () -> {
                    CallAudio.get().end(this);
                    stopNow();
                },
                delivered ? HANG_UP_FALLBACK_MS : 0
            );
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) {
            stopNow();
            return START_NOT_STICKY;
        }
        boolean ok = goForeground(intent);
        CountDownLatch latch = startLatch;
        startOk = ok;
        if (latch != null) latch.countDown();
        if (!ok) stopNow();
        return START_NOT_STICKY;
    }

    private boolean goForeground(Intent intent) {
        String peer = peerName(this, intent.getStringExtra(EXTRA_PEER));
        boolean video = intent.getBooleanExtra(EXTRA_VIDEO, false);
        String state = CallLogic.normState(intent.getStringExtra(EXTRA_STATE));
        long since = intent.getLongExtra(EXTRA_SINCE, 0);
        int type = CallLogic.serviceTypes(Build.VERSION.SDK_INT, granted(Manifest.permission.RECORD_AUDIO));
        if (type < 0) return false;
        // CallStyle (Android 12+) trước; bị từ chối → thông báo thường.
        boolean[] styles = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new boolean[] { true, false } : new boolean[] { false };
        for (boolean styled : styles) {
            try {
                Notification n = build(this, peer, video, state, since, styled);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && type > 0) startForeground(NOTIFICATION_ID, n, type);
                else startForeground(NOTIFICATION_ID, n);
                callStyle = styled;
                running = true;
                return true;
            } catch (RuntimeException e) {
                // SecurityException / ForegroundServiceStartNotAllowedException / InvalidForegroundServiceTypeException /
                // IllegalArgumentException (CallStyle)
                Log.w(TAG, "startForeground(" + type + (styled ? ", CallStyle" : "") + ") refused: " + e.getClass().getSimpleName());
            }
        }
        return false;
    }

    private boolean granted(String perm) {
        return ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED;
    }

    private void stopNow() {
        main.removeCallbacksAndMessages(null);
        running = false;
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        } catch (RuntimeException ignored) {}
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Vuốt app khỏi đa nhiệm: WebView (và cuộc gọi trong nó) đã bị huỷ.
        CallAudio.get().end(this);
        stopNow();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        main.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ---------------------------------------------------------------------------------

    private static String peerName(Context ctx, String peer) {
        String p = ChatNotifications.cleanName(peer, 60);
        return p.isEmpty() ? ctx.getString(R.string.app_name) : p;
    }

    static Notification build(Context ctx, String peer, boolean video, String state, long since, boolean callStyle) {
        ChatNotifications.ensureChannelsOnce(ctx);
        int accent = ContextCompat.getColor(ctx, R.color.pn_notification_accent);
        String title;
        if (CallLogic.STATE_CALLING.equals(state)) title = ctx.getString(R.string.call_ongoing_calling, peer);
        else if (CallLogic.STATE_CONNECTING.equals(state)) title = ctx.getString(R.string.call_ongoing_connecting, peer);
        else title = ctx.getString(video ? R.string.call_ongoing_video_title : R.string.call_ongoing_title, peer);
        boolean connected = CallLogic.STATE_CONNECTED.equals(state) && since > 0;

        // Chạm → đưa app (đang giữ cuộc gọi) lên trước; không mang pn_url nên không điều hướng gì.
        Intent back = new Intent(ctx, MainActivity.class)
            .setAction(ACTION_RETURN)
            .setData(Uri.parse("pawnail-call://ongoing"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(ctx, 0x0CA1, back, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent hang = new Intent(ctx, OngoingCallService.class).setAction(ACTION_HANG_UP);
        PendingIntent hangUp = PendingIntent.getService(ctx, 0x0CA2, hang, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification publicVersion = new NotificationCompat.Builder(ctx, ChatNotifications.CHANNEL_CALL_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setContentTitle(ctx.getString(R.string.call_ongoing_public))
            .setContentText(ctx.getString(R.string.call_ongoing_text))
            .build();

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ChatNotifications.CHANNEL_CALL_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setContentTitle(title)
            .setContentText(ctx.getString(R.string.call_ongoing_text))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(connected)
            .setUsesChronometer(connected)
            .setWhen(connected ? since : System.currentTimeMillis())
            .setContentIntent(content)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            // Android 12+ hoãn thông báo của foreground service ~10 s — cuộc gọi phải hiện ngay.
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        if (callStyle && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // CallStyle tự thêm nút "Kết thúc" (chữ của hệ thống, theo ngôn ngữ máy) — được phép vì đây là thông báo của
            // foreground service.
            Person person = new Person.Builder()
                .setName(peer)
                .setKey("call:" + peer)
                .setIcon(IconCompat.createWithBitmap(ChatAvatars.initialsCircle(peer, "call:" + peer, ChatAvatars.PERSON_PX)))
                .setImportant(true)
                .build();
            b.setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp).setIsVideo(video));
        } else {
            b.addAction(R.drawable.ic_stat_pawnail, ctx.getString(R.string.call_hang_up), hangUp);
        }
        return b.build();
    }

    static final String ACTION_RETURN = "com.bitpawos.app.action.RETURN_TO_CALL";
}
