package com.bitpawos.app;

import android.util.Log;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Nhận MỌI tin FCM của app (thay service của plugin @capacitor/push-notifications — manifest
 * gỡ service gốc bằng tools:node="remove"; kế thừa nó nên onNewToken vẫn tới plugin/JS).
 *
 *  - data.type == "chat" (tin DATA-ONLY, máy chủ chỉ gửi cho app build ≥ 3): tự vẽ thông báo
 *    kiểu Messenger (ChatNotifications) — chạy được cả khi app ở nền hay đã bị tắt. KHÔNG chuyển
 *    cho JS: web không nghe pushNotificationReceived (tin mới tới web qua Pusher), mà plugin giữ
 *    lại mọi sự kiện chưa ai nghe (retainUntilConsumed) → nội dung từng tin nằm mãi trong bộ nhớ.
 *  - data.type == "read" (+ ts = mốc đọc, ms): hội thoại đã được đọc ở thiết bị khác → gỡ các
 *    tin cũ hơn mốc đó khỏi thông báo.
 *  - Mọi tin khác: giữ nguyên hành vi của plugin (FCM tự hiện tin "notification" khi app ở
 *    nền, kênh theo android.notification.channel_id hoặc mặc định "general"; app đang mở →
 *    sự kiện JS).
 */
public class PawNailMessagingService extends MessagingService {

    private static final String TAG = "PawNailFCM";

    @Override
    public void onCreate() {
        super.onCreate();
        // Kênh phải có TRƯỚC khi FCM tự vẽ tin "notification" (nó chạy trong chính service này).
        try {
            ChatNotifications.ensureChannels(this);
        } catch (RuntimeException e) {
            Log.w(TAG, "channels: " + e.getClass().getSimpleName());
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");
        boolean dataOnly = remoteMessage.getNotification() == null;

        if (dataOnly && "chat".equals(type)) {
            try {
                ChatNotifications.onIncoming(getApplicationContext(), data);
            } catch (Throwable t) {
                // Không bao giờ để một payload lạ làm sập tiến trình.
                Log.w(TAG, "chat notification failed: " + t.getClass().getSimpleName());
            }
            return;
        }
        if (dataOnly && "read".equals(type)) {
            String cid = data.get("cid");
            if (AppLinks.isConversationId(cid)) {
                try {
                    ChatNotifications.onRead(getApplicationContext(), cid, parseTs(data.get("ts")));
                } catch (Throwable t) {
                    Log.w(TAG, "read sync failed: " + t.getClass().getSimpleName());
                }
            }
            return;
        }
        super.onMessageReceived(remoteMessage);
    }

    private static long parseTs(String s) {
        try {
            return s == null ? 0 : Long.parseLong(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
