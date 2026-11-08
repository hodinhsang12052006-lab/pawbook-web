package com.bitpawos.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Nút "Từ chối" trên thông báo cuộc gọi đến (CallNotifications; receiver KHÔNG export — chỉ PendingIntent của app):
 *  1. gỡ thông báo ngay (dừng chuông), nhớ cuộc gọi đã kết thúc (lượt đổ chuông / tin tới muộn không kêu lại);
 *  2. báo web nếu đang chạy (sự kiện callAction "declined" — trang đang đổ chuông trong nền dừng ngay);
 *  3. POST /api/calls {action: "reject", reason: "decline"} bằng ĐÚNG phiên đăng nhập của WebView (cookie, như trả lời
 *     nhanh tin chat — ChatApi) → người gọi thấy "đã từ chối", các máy khác của mình thôi đổ chuông.
 * Mạng chạy trên luồng nền với goAsync(); tổng thời gian dưới ~9 s.
 */
public class CallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "PawNailCallAction";

    static final String ACTION_DECLINE = "com.bitpawos.app.action.CALL_DECLINE";
    private static final long BUDGET_MS = 9000;

    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_DECLINE.equals(intent.getAction())) return;
        String callId = intent.getStringExtra(CallNotifications.EXTRA_CALL_ID);
        String callerId = intent.getStringExtra(CallNotifications.EXTRA_CALLER_ID);
        String token = intent.getStringExtra(CallNotifications.EXTRA_CALL_TOKEN);
        if (!CallLogic.isCallId(callId) || !CallLogic.isUserId(callerId) || !CallLogic.isCallToken(token)) return;
        Context app = context.getApplicationContext();
        CallNotifications.cancel(app, callId);
        CallNotifications.rememberEnded(app, callId);
        PawNailNativePlugin.emitCallAction("declined", callId);
        // CookieManager / WebSettings: gọi trên luồng chính cho chắc (như ChatActionReceiver).
        final String cookie = ChatApi.cookies();
        final String ua = ChatApi.userAgent(app);
        final PendingResult pending = goAsync();
        EXEC.execute(() -> {
            try {
                long start = SystemClock.elapsedRealtime();
                ChatApi.Result r = ChatApi.declineCall(callerId, callId, token, cookie, ua, 4000, 4000);
                if (r.status == 0 && SystemClock.elapsedRealtime() - start < BUDGET_MS - 7000) {
                    r = ChatApi.declineCall(callerId, callId, token, cookie, ua, 3000, 3000);
                }
                if (!r.ok) Log.w(TAG, "decline -> " + r.status);
            } catch (Throwable t) {
                Log.w(TAG, "decline failed: " + t.getClass().getSimpleName());
            } finally {
                pending.finish();
            }
        });
    }
}
