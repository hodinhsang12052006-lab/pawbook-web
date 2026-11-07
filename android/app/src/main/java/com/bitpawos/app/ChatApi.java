package com.bitpawos.app;

import android.content.Context;
import android.os.Build;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Gọi API chat của bitpawos.com từ native (trả lời nhanh, đánh dấu đã đọc) bằng ĐÚNG phiên
 * đăng nhập của WebView: cookie lấy từ CookieManager (gồm cả cookie HttpOnly và cookie
 * next-auth bị chia khúc .0/.1). Thân request giống hệt web (components/chat/MessagesContent.tsx).
 * KHÔNG ghi cookie / nội dung tin ra log.
 */
final class ChatApi {

    private static final String TAG = "PawNailChatApi";

    static final class Result {
        final int status; // mã HTTP; 0 = lỗi mạng
        final boolean ok;
        /** Phản hồi là JSON của chính API (không phải trang HTML của Cloudflare / WAF / trang lỗi). */
        final boolean json;

        Result(int status) {
            this(status, false);
        }

        Result(int status, boolean json) {
            this.status = status;
            this.ok = status >= 200 && status < 300;
            this.json = json;
        }
    }

    private static final String PREFS = "pn_app";
    private static final String KEY_UA = "webview_ua";
    private static volatile String cachedUa;

    private ChatApi() {}

    /** Cookie của www.bitpawos.com, hoặc null (chưa đăng nhập / WebView đang cập nhật). Gọi trên luồng chính. */
    static String cookies() {
        try {
            String c = CookieManager.getInstance().getCookie(AppLinks.ORIGIN);
            return c == null || c.isEmpty() ? null : c;
        } catch (Throwable t) {
            return null;
        }
    }

    /**
     * User-Agent như WebView của app (Cloudflare không chặn), kèm "PawNailApp". Có thể nạp thư viện WebView (chậm vài
     * trăm ms lần đầu) → nhớ lại trong bộ nhớ + SharedPreferences cho lần sau (service chạy khi app đã tắt).
     */
    static String userAgent(Context ctx) {
        String ua = cachedUa;
        if (ua != null) return ua;
        try {
            ua = WebSettings.getDefaultUserAgent(ctx) + " " + AppLinks.UA_APP;
            cachedUa = ua;
            ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_UA, ua).apply();
            return ua;
        } catch (Throwable t) {
            return fallbackUserAgent();
        }
    }

    /** UA đã lưu (không nạp WebView — dùng trong service tải ảnh đại diện), hoặc UA dựng tay. */
    static String cachedUserAgent(Context ctx) {
        String ua = cachedUa;
        if (ua != null) return ua;
        try {
            ua = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_UA, null);
        } catch (RuntimeException ignored) {}
        if (ua != null && !ua.isEmpty()) {
            cachedUa = ua;
            return ua;
        }
        return fallbackUserAgent();
    }

    private static String fallbackUserAgent() {
        return "Mozilla/5.0 (Linux; Android " + Build.VERSION.RELEASE + "; " + Build.MODEL + ") " + AppLinks.UA_APP;
    }

    /** POST /api/messages — tin nhắn văn bản vào hội thoại (cả 1-1 lẫn nhóm). */
    static Result sendText(String cid, String text, String clientId, String cookie, String ua, int connectMs, int readMs) {
        try {
            JSONObject body = new JSONObject();
            body.put("conversationId", cid);
            body.put("content", text);
            body.put("type", "TEXT");
            body.put("clientId", clientId);
            return post("/api/messages", body, cookie, ua, connectMs, readMs);
        } catch (JSONException e) {
            return new Result(0);
        }
    }

    /** POST /api/messages/seen — giống markSeen() của web. */
    static Result markSeen(String cid, String cookie, String ua, int connectMs, int readMs) {
        try {
            JSONObject body = new JSONObject();
            body.put("conversationId", cid);
            return post("/api/messages/seen", body, cookie, ua, connectMs, readMs);
        } catch (JSONException e) {
            return new Result(0);
        }
    }

    private static Result post(String path, JSONObject body, String cookie, String ua, int connectMs, int readMs) {
        if (cookie == null) return new Result(401);
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(AppLinks.ORIGIN + path).openConnection();
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setUseCaches(false);
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(connectMs);
            c.setReadTimeout(readMs);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("Cookie", cookie);
            c.setRequestProperty("Origin", AppLinks.ORIGIN);
            c.setRequestProperty("Referer", AppLinks.ORIGIN + "/messages");
            c.setRequestProperty("User-Agent", ua);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = c.getOutputStream()) {
                out.write(bytes);
            }
            int code = c.getResponseCode();
            String type = c.getContentType();
            boolean json = type != null && type.toLowerCase(java.util.Locale.ROOT).contains("application/json");
            drain(c, code);
            if (code >= 300) Log.w(TAG, "POST " + path + " -> " + code);
            return new Result(code, json);
        } catch (IOException e) {
            Log.w(TAG, "POST " + path + " failed: " + e.getClass().getSimpleName());
            return new Result(0);
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static void drain(HttpURLConnection c, int code) {
        try (InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream()) {
            if (in == null) return;
            byte[] buf = new byte[4096];
            int total = 0;
            int n;
            while ((n = in.read(buf)) != -1 && total < 64 * 1024) total += n;
        } catch (IOException ignored) {}
    }
}
