package com.bitpawos.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Nút trên thông báo chat (receiver KHÔNG export — chỉ PendingIntent của chính app gọi được):
 *  - Trả lời: gửi tin qua POST /api/messages bằng phiên WebView, rồi đăng lại thông báo có
 *    câu trả lời (im lặng) hoặc dòng "Chưa gửi được" + lý do. Phải đăng lại trong mọi
 *    trường hợp, nếu không ô trả lời cứ quay vòng.
 *  - Đánh dấu đã đọc: gỡ thông báo ngay, rồi POST /api/messages/seen.
 *  - Vuốt bỏ: quên lịch sử của hội thoại.
 * Mạng chạy trên luồng nền với goAsync(); tổng thời gian giữ dưới ~9 s.
 */
public class ChatActionReceiver extends BroadcastReceiver {

    private static final String TAG = "PawNailChatAction";

    static final String ACTION_REPLY = "com.bitpawos.app.action.CHAT_REPLY";
    static final String ACTION_MARK_READ = "com.bitpawos.app.action.CHAT_MARK_READ";
    static final String ACTION_DISMISS = "com.bitpawos.app.action.CHAT_DISMISS";
    static final String KEY_REPLY = "pn_reply_text";

    /** Giới hạn tin TEXT của máy chủ (app/api/messages/route.ts). */
    private static final int MAX_TEXT = 5000;
    private static final long BUDGET_MS = 9000;

    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String cid = intent.getStringExtra(ChatNotifications.EXTRA_CID);
        if (!AppLinks.isConversationId(cid)) return;
        Context app = context.getApplicationContext();
        String action = intent.getAction();

        final String text;
        final String cookie;
        final String ua;
        if (ACTION_REPLY.equals(action)) {
            Bundle results = RemoteInput.getResultsFromIntent(intent);
            CharSequence cs = results != null ? results.getCharSequence(KEY_REPLY) : null;
            text = cs == null ? "" : cs.toString().trim();
            // CookieManager / WebSettings: gọi trên luồng chính cho chắc.
            cookie = ChatApi.cookies();
            ua = ChatApi.userAgent(app);
        } else if (ACTION_MARK_READ.equals(action)) {
            text = null;
            cookie = ChatApi.cookies();
            ua = ChatApi.userAgent(app);
        } else if (ACTION_DISMISS.equals(action)) {
            text = null;
            cookie = null;
            ua = null;
        } else {
            return;
        }

        final PendingResult pending = goAsync();
        EXEC.execute(() -> {
            try {
                if (ACTION_REPLY.equals(action)) reply(app, cid, text, cookie, ua);
                else if (ACTION_MARK_READ.equals(action)) markRead(app, cid, cookie, ua);
                else ChatNotifications.forget(app, cid);
            } catch (Throwable t) {
                Log.w(TAG, "action failed: " + t.getClass().getSimpleName());
            } finally {
                pending.finish();
            }
        });
    }

    private static void reply(Context app, String cid, String rawText, String cookie, String ua) {
        long start = SystemClock.elapsedRealtime();
        if (rawText.isEmpty()) {
            repost(app, cid);
            return;
        }
        String text = ChatNotifications.clean(rawText, MAX_TEXT);
        // Cùng clientId cho lần thử lại: máy chủ chống gửi trùng theo (người gửi, clientId).
        String clientId = UUID.randomUUID().toString();
        ChatApi.Result r = ChatApi.sendText(cid, text, clientId, cookie, ua, 4000, 5000);
        if (r.status == 0 && SystemClock.elapsedRealtime() - start < 2500) {
            r = ChatApi.sendText(cid, text, clientId, cookie, ua, 3000, 3000);
        }

        ChatStore.Conv c;
        if (r.ok) {
            c = ChatStore.addOutgoing(app, cid, text, false, "");
            // Trả lời = đã đọc (như Messenger). Chỉ khi còn thời gian.
            long left = BUDGET_MS - (SystemClock.elapsedRealtime() - start);
            if (left > 2500) {
                int t = (int) Math.min(2500, left / 2);
                ChatApi.markSeen(cid, cookie, ua, t, t);
            }
        } else {
            c = ChatStore.addOutgoing(app, cid, text, true, app.getString(errorText(r.status)));
        }
        if (c != null) {
            ChatNotifications.post(app, cid, ChatNotifications.Mode.SILENT);
        } else if (r.ok) {
            // Không còn lịch sử (đã bị xoá): gỡ thông báo cho ô trả lời khỏi quay.
            NotificationManagerCompat.from(app).cancel(ChatNotifications.tagFor(cid), ChatNotifications.CHAT_ID);
        }
    }

    private static int errorText(int status) {
        if (status == 401) return R.string.chat_error_signin;
        if (status == 403) return R.string.chat_error_blocked;
        if (status == 429) return R.string.chat_error_limit;
        return R.string.chat_error_network;
    }

    private static void repost(Context app, String cid) {
        ChatStore.Conv c = ChatStore.get(app, cid);
        if (c != null) ChatNotifications.post(app, cid, ChatNotifications.Mode.SILENT);
    }

    private static void markRead(Context app, String cid, String cookie, String ua) {
        // Gỡ trước (nhanh, không cần mạng) để người dùng thấy phản hồi ngay; hội thoại đang là
        // bong bóng thì chỉ ẩn khỏi khay (xem ChatNotifications.clear).
        ChatNotifications.clear(app, cid);
        ChatApi.markSeen(cid, cookie, ua, 4000, 4000);
    }
}
