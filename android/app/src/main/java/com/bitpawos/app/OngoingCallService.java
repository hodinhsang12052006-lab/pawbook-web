package com.bitpawos.app;

import android.Manifest;
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
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * "Đang trong cuộc gọi" (versionCode 4+): foreground service loại microphone (+ camera khi camera của mình đang bật) để
 * Android KHÔNG tắt micro / camera của cuộc gọi WebRTC trong WebView khi người dùng rời app hay tắt màn hình (trước đây
 * bên kia thấy "X đã rời app — có thể không nghe được bạn").
 *
 * Web bật / cập nhật / tắt qua PawNailNative.startOngoingCall / updateOngoingCall / stopOngoingCall (CallManager.tsx).
 * Thông báo bắt buộc của foreground service (chính sách Play): "Cuộc gọi với X · Chạm để quay lại cuộc gọi" + nút
 * "Kết thúc" → báo web (sự kiện callAction "hangup") để cúp máy đúng cách (gửi bye / reject cho bên kia).
 * Không export; không START_STICKY (tiến trình chết = WebView chết = cuộc gọi đã mất, không có gì để giữ).
 */
public class OngoingCallService extends Service {

    private static final String TAG = "PawNailOngoingCall";

    static final String ACTION_START = "com.bitpawos.app.action.CALL_ONGOING";
    static final String ACTION_HANG_UP = "com.bitpawos.app.action.CALL_HANG_UP";
    static final String EXTRA_PEER = "peer";
    static final String EXTRA_VIDEO = "video";
    static final String EXTRA_CAMERA = "camera";
    static final String EXTRA_STATE = "state";
    static final String EXTRA_SINCE = "since";

    static final int NOTIFICATION_ID = 0x0CA11;
    /** Web không tự tắt service sau khi bấm "Kết thúc" (JS đã chết / bị treo) → tự tắt sau ngần này. */
    private static final long HANG_UP_FALLBACK_MS = 5000;
    private static final long START_WAIT_MS = 1500;

    private static volatile boolean running = false;
    private static volatile CountDownLatch startLatch;
    private static volatile boolean startOk;

    private final Handler main = new Handler(Looper.getMainLooper());

    static boolean isRunning() {
        return running;
    }

    /**
     * Bật / cập nhật (gọi từ luồng plugin, KHÔNG phải luồng chính): startService khi app đang ở tiền cảnh (cuộc gọi vừa
     * bắt đầu bằng 1 lần chạm), rồi chờ service báo startForeground có được không (tối đa 1.5 s).
     */
    static boolean start(Context ctx, String peer, boolean video, boolean camera, String state, long since) {
        Context app = ctx.getApplicationContext();
        Intent i = new Intent(app, OngoingCallService.class)
            .setAction(ACTION_START)
            .putExtra(EXTRA_PEER, peer)
            .putExtra(EXTRA_VIDEO, video)
            .putExtra(EXTRA_CAMERA, camera)
            .putExtra(EXTRA_STATE, CallLogic.normState(state))
            .putExtra(EXTRA_SINCE, since);
        CountDownLatch latch = new CountDownLatch(1);
        startLatch = latch;
        startOk = false;
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

    static void stop(Context ctx) {
        Context app = ctx.getApplicationContext();
        try {
            app.stopService(new Intent(app, OngoingCallService.class));
        } catch (RuntimeException e) {
            Log.w(TAG, "stop: " + e.getClass().getSimpleName());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_HANG_UP.equals(action)) {
            // Web cúp máy (bye + reject cho bên kia) rồi tự gọi stopOngoingCall; không còn web nghe → tắt luôn.
            boolean delivered = PawNailNativePlugin.emitCallAction("hangup", null);
            main.postDelayed(this::stopNow, delivered ? HANG_UP_FALLBACK_MS : 0);
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
        String peer = ChatNotifications.cleanName(intent.getStringExtra(EXTRA_PEER), 60);
        if (peer.isEmpty()) peer = getString(R.string.app_name);
        boolean video = intent.getBooleanExtra(EXTRA_VIDEO, false);
        boolean camera = intent.getBooleanExtra(EXTRA_CAMERA, false);
        String state = CallLogic.normState(intent.getStringExtra(EXTRA_STATE));
        long since = intent.getLongExtra(EXTRA_SINCE, 0);
        int types = CallLogic.serviceTypes(Build.VERSION.SDK_INT, granted(Manifest.permission.RECORD_AUDIO), camera, granted(Manifest.permission.CAMERA));
        if (types < 0) return false;
        Notification n = build(this, peer, video, state, since);
        for (int t : CallLogic.serviceTypeAttempts(types)) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && t > 0) startForeground(NOTIFICATION_ID, n, t);
                else startForeground(NOTIFICATION_ID, n);
                running = true;
                return true;
            } catch (RuntimeException e) {
                // SecurityException / ForegroundServiceStartNotAllowedException / InvalidForegroundServiceTypeException
                Log.w(TAG, "startForeground(" + t + ") refused: " + e.getClass().getSimpleName());
            }
        }
        return running; // lần cập nhật bị từ chối khi đã chạy: thông báo cũ vẫn giữ
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

    static Notification build(Context ctx, String peer, boolean video, String state, long since) {
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
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(R.drawable.ic_stat_pawnail, ctx.getString(R.string.call_hang_up), hangUp);
        return b.build();
    }

    static final String ACTION_RETURN = "com.bitpawos.app.action.RETURN_TO_CALL";
}
