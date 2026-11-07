package com.bitpawos.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Đường dẫn trong app (thông báo, lối tắt hội thoại, bong bóng chat) luôn là PATH của
 * https://www.bitpawos.com, không bao giờ là URL đầy đủ: payload đẩy hay intent từ ngoài
 * không thể đưa WebView sang host khác.
 */
final class AppLinks {

    static final String ORIGIN = "https://www.bitpawos.com";
    static final String HOST = "www.bitpawos.com";
    static final String BARE_HOST = "bitpawos.com";

    /** Intent extra (String): path trong app cần mở, ví dụ "/messages?c=abc". */
    static final String EXTRA_URL = "pn_url";

    /**
     * Intent extra (String): khoá ngẫu nhiên của bản cài này (launchKey). MainActivity được export (launcher, App
     * Links) nên app KHÁC cũng gửi được intent có pn_url: không có khoá đúng thì chỉ mở trang một cuộc trò chuyện
     * (/messages?c=<id>), không mở path tuỳ ý (/admin, /api/…) trong WebView đã đăng nhập.
     */
    static final String EXTRA_KEY = "pn_key";

    /** Thêm vào User-Agent của WebView: máy chủ nhận ra request từ app (giống capacitor.config.ts). */
    static final String UA_APP = "PawNailApp";
    static final String UA_BUBBLE = "PawNailBubble";

    private static final Pattern CONVERSATION_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final String PREFS = "pn_app";
    private static final String KEY_LAUNCH = "launch_key";
    private static volatile String launchKey;

    private AppLinks() {}

    /**
     * Path an toàn: bắt đầu bằng đúng một "/", không có scheme/host, không dấu "\", chỉ ký tự
     * ASCII in được (không khoảng trắng / ký tự điều khiển), dài dưới 2048.
     */
    static boolean isSafePath(String p) {
        if (p == null || p.isEmpty() || p.length() >= 2048) return false;
        if (p.charAt(0) != '/' || p.startsWith("//")) return false;
        for (int i = 0; i < p.length(); i++) {
            char c = p.charAt(i);
            if (c <= 0x20 || c >= 0x7f || c == '\\') return false;
        }
        return true;
    }

    static String absolute(String path) {
        return ORIGIN + path;
    }

    static boolean isConversationId(String id) {
        return id != null && CONVERSATION_ID.matcher(id).matches();
    }

    /** Đường dẫn mở đúng hội thoại (cả nhóm): /messages?c=<id>. */
    static String conversationPath(String cid) {
        // id hội thoại chỉ gồm [A-Za-z0-9_-] (isConversationId) → không cần mã hoá; vẫn mã hoá cho chắc.
        return "/messages?c=" + (isConversationId(cid) ? cid : Uri.encode(cid));
    }

    static boolean isOwnHost(Uri u) {
        if (u == null || !"https".equalsIgnoreCase(u.getScheme())) return false;
        String host = u.getHost();
        return host != null && (host.equalsIgnoreCase(HOST) || host.equalsIgnoreCase(BARE_HOST));
    }

    /** Path + query (+ fragment) của một URL bitpawos.com, hoặc null nếu không an toàn. */
    static String pathOf(Uri u) {
        if (!isOwnHost(u)) return null;
        String path = u.getEncodedPath();
        if (path == null || path.isEmpty()) path = "/";
        String q = u.getEncodedQuery();
        String f = u.getEncodedFragment();
        String out = path + (q != null ? "?" + q : "") + (f != null ? "#" + f : "");
        return isSafePath(out) ? out : null;
    }

    /** Trang chat (EN hoặc /vi): /messages, /messages/…, /vi/messages… */
    static boolean isChatPath(String path) {
        if (path == null) return false;
        String p = basePath(path);
        if (p.startsWith("/vi/")) p = p.substring(3);
        return p.equals("/messages") || p.startsWith("/messages/");
    }

    /**
     * Ở lại trong cửa sổ bong bóng của hội thoại `cid`: chỉ trang chat CÓ ?c=<cid> (đúng hội thoại của bong bóng).
     * /messages trần (danh sách), ?to=, ?c= của hội thoại khác hay mọi trang khác → mở trong app chính. Trước đây mọi
     * trang chat đều ở lại → nút "Mở PawNail" (tải /messages) quay mãi trong bong bóng.
     */
    static boolean staysInBubble(String path, String cid) {
        return isConversationId(cid) && isChatPath(path) && cid.equals(queryParam(path, "c"));
    }

    /** Đúng dạng "/messages?c=<id>" hoặc "/vi/messages?c=<id>" (không tham số khác) — mở được từ intent không có khoá. */
    static boolean isConversationOpenPath(String path) {
        if (path == null || !isSafePath(path)) return false;
        int q = path.indexOf('?');
        if (q < 0 || path.indexOf('#') >= 0) return false;
        String base = path.substring(0, q);
        if (!base.equals("/messages") && !base.equals("/vi/messages")) return false;
        String query = path.substring(q + 1);
        return query.startsWith("c=") && query.indexOf('&') < 0 && isConversationId(query.substring(2));
    }

    /** Giá trị THÔ (chưa giải mã) của tham số `name` trong query của path, hoặc null. */
    static String queryParam(String path, String name) {
        if (path == null) return null;
        int q = path.indexOf('?');
        if (q < 0) return null;
        int end = path.indexOf('#', q);
        String query = end < 0 ? path.substring(q + 1) : path.substring(q + 1, end);
        for (String part : query.split("&")) {
            int eq = part.indexOf('=');
            String k = eq < 0 ? part : part.substring(0, eq);
            if (k.equals(name)) return eq < 0 ? "" : part.substring(eq + 1);
        }
        return null;
    }

    private static String basePath(String path) {
        int cut = indexOfAny(path, '?', '#');
        return cut >= 0 ? path.substring(0, cut) : path;
    }

    private static int indexOfAny(String s, char a, char b) {
        int i = s.indexOf(a);
        int j = s.indexOf(b);
        if (i < 0) return j;
        if (j < 0) return i;
        return Math.min(i, j);
    }

    // ---------------------------------------------------------------------------------
    // Khoá mở app nội bộ (EXTRA_KEY)
    // ---------------------------------------------------------------------------------

    /** Khoá ngẫu nhiên 128 bit, tạo 1 lần cho mỗi bản cài (không sao lưu / chuyển máy — data_extraction_rules.xml). */
    static String launchKey(Context ctx) {
        String k = launchKey;
        if (k != null) return k;
        synchronized (AppLinks.class) {
            if (launchKey != null) return launchKey;
            SharedPreferences p = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            k = p.getString(KEY_LAUNCH, null);
            if (k == null || k.length() < 32) {
                byte[] b = new byte[16];
                new SecureRandom().nextBytes(b);
                StringBuilder sb = new StringBuilder();
                for (byte x : b) sb.append(String.format(java.util.Locale.ROOT, "%02x", x));
                k = sb.toString();
                p.edit().putString(KEY_LAUNCH, k).commit();
            }
            launchKey = k;
            return k;
        }
    }

    /** Gắn khoá vào intent nội bộ (thông báo, bong bóng → app chính). */
    static Intent withKey(Context ctx, Intent i) {
        return i.putExtra(EXTRA_KEY, launchKey(ctx));
    }

    /** Intent mang đúng khoá của bản cài này (so sánh thời gian hằng). */
    static boolean hasValidKey(Context ctx, Intent i) {
        String got = i == null ? null : i.getStringExtra(EXTRA_KEY);
        if (got == null) return false;
        return MessageDigest.isEqual(got.getBytes(StandardCharsets.UTF_8), launchKey(ctx).getBytes(StandardCharsets.UTF_8));
    }
}
