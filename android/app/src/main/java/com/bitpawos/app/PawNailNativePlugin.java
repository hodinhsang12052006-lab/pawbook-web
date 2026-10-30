package com.bitpawos.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Cho web (lib/nativePush.ts) biết bản app đang chạy có cấu hình Firebase hay
// không. Thiếu android/app/google-services.json mà vẫn gọi
// PushNotifications.register() thì FirebaseMessaging.getInstance() ném
// IllegalStateException và app CRASH. Bản build cũ không có plugin này → web
// coi như chưa hỗ trợ thông báo đẩy native.
@CapacitorPlugin(name = "PawNailNative")
public class PawNailNativePlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        Context ctx = getContext();
        // Plugin com.google.gms.google-services sinh chuỗi google_app_id từ
        // google-services.json; Firebase tự khởi tạo từ chính chuỗi này.
        int firebaseAppId = ctx.getResources().getIdentifier("google_app_id", "string", ctx.getPackageName());
        JSObject ret = new JSObject();
        ret.put("firebase", firebaseAppId != 0);
        call.resolve(ret);
    }
}
