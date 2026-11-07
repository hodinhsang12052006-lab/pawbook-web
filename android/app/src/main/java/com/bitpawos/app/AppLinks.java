package com.bitpawos.app;

import android.net.Uri;
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

    /** Thêm vào User-Agent của WebView: máy chủ nhận ra request từ app (giống capacitor.config.ts). */
    static final String UA_APP = "PawNailApp";
    static final String UA_BUBBLE = "PawNailBubble";

    private static final Pattern CONVERSATION_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");

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
        return "/messages?c=" + Uri.encode(cid);
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

    /** Trang chat (EN hoặc /vi) — được phép ở lại trong cửa sổ bong bóng. */
    static boolean isChatPath(String path) {
        if (path == null) return false;
        String p = path;
        int cut = indexOfAny(p, '?', '#');
        if (cut >= 0) p = p.substring(0, cut);
        if (p.startsWith("/vi/")) p = p.substring(3);
        return p.equals("/messages") || p.startsWith("/messages/");
    }

    private static int indexOfAny(String s, char a, char b) {
        int i = s.indexOf(a);
        int j = s.indexOf(b);
        if (i < 0) return j;
        if (j < 0) return i;
        return Math.min(i, j);
    }
}
