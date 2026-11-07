package com.bitpawos.app;

import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Cầu nối nhỏ giữa web (lib/nativePush.ts, màn chat) và phần native của app.
//
// getInfo().firebase: bản app có cấu hình Firebase (google-services.json) hay không. Thiếu
// file đó mà vẫn gọi PushNotifications.register() thì FirebaseMessaging.getInstance() ném
// IllegalStateException và app CRASH. Bản build cũ không có plugin này → web coi như chưa
// hỗ trợ thông báo đẩy native.
@CapacitorPlugin(name = "PawNailNative")
public class PawNailNativePlugin extends Plugin {

    /** Phiên bản bộ vẽ thông báo chat native (tin data-only type=chat, v=1). */
    private static final int CHAT_RENDERER = 1;

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
        call.resolve(ret);
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
