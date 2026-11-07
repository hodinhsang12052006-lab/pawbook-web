package com.bitpawos.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Lịch sử ngắn của từng hội thoại đang có thông báo, để tin mới NỐI vào thông báo cũ như
 * Messenger (MessagingStyle cần cả danh sách tin mỗi lần đăng lại). Lưu trong
 * SharedPreferences (bản thân nó đã cache trong bộ nhớ) vì tiến trình có thể bị hệ thống
 * giết giữa 2 tin. Chỉ giữ vài tin gần nhất, vài chục hội thoại.
 *
 * Thứ tự / "đã đọc" dùng số thứ tự cục bộ (seq), KHÔNG dùng giờ: giờ máy chủ (tin đến) và
 * giờ máy (tin mình trả lời) có thể lệch nhau.
 */
final class ChatStore {

    static final int MAX_MESSAGES = 6;
    private static final int MAX_CONVERSATIONS = 30;
    private static final String PREFS = "pn_chat_notifications";
    private static final String KEY_PREFIX = "c:";
    private static final Object LOCK = new Object();

    static final class Msg {
        String mid = "";
        String senderId = "";
        String sender = "";
        String avatar = "";
        String text = "";
        long ts;
        long seq;
        boolean me;
        boolean failed;
    }

    static final class Conv {
        String cid = "";
        String title = "";
        boolean group;
        String url = "";
        long nextSeq = 1;
        long readSeq = 0;
        long updated;
        /** Lỗi gửi trả lời gần nhất (hiện ở dòng phụ) — xoá khi có tin mới đến. */
        String error = "";
        String shortcutSig = "";
        long shortcutAt;
        final List<Msg> msgs = new ArrayList<>();

        /** Tin chưa đọc + tin mình vừa trả lời (seq > readSeq), theo thứ tự đến. */
        List<Msg> visible() {
            List<Msg> out = new ArrayList<>();
            for (Msg m : msgs) if (m.seq > readSeq) out.add(m);
            return out;
        }

        int unreadCount() {
            int n = 0;
            for (Msg m : msgs) if (m.seq > readSeq && !m.me) n++;
            return n;
        }

        Msg last() {
            return msgs.isEmpty() ? null : msgs.get(msgs.size() - 1);
        }
    }

    private ChatStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static Conv get(Context ctx, String cid) {
        synchronized (LOCK) {
            return read(prefs(ctx), cid);
        }
    }

    /**
     * Thêm tin đến. Trả về null nếu tin trùng (FCM có thể gửi lại cùng một tin) — khi đó
     * không đăng lại thông báo.
     */
    static Conv addIncoming(Context ctx, String cid, String title, boolean group, String url, Msg m) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(ctx);
            Conv c = read(p, cid);
            if (c == null) {
                c = new Conv();
                c.cid = cid;
            }
            for (Msg old : c.msgs) {
                if (!old.me && !m.mid.isEmpty() && m.mid.equals(old.mid)) return null;
            }
            c.title = title;
            c.group = group;
            c.url = url;
            c.error = "";
            // Tin đã đọc không cần giữ nữa: thông báo mới chỉ hiện tin chưa đọc.
            List<Msg> keep = new ArrayList<>();
            for (Msg old : c.msgs) if (old.seq > c.readSeq) keep.add(old);
            c.msgs.clear();
            c.msgs.addAll(keep);
            m.seq = c.nextSeq++;
            c.msgs.add(m);
            trim(c);
            c.updated = System.currentTimeMillis();
            write(p, c);
            return c;
        }
    }

    /** Thêm tin mình trả lời từ thông báo (gửi được hoặc lỗi). */
    static Conv addOutgoing(Context ctx, String cid, String text, boolean failed, String error) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(ctx);
            Conv c = read(p, cid);
            if (c == null) return null;
            Msg m = new Msg();
            m.mid = "local";
            m.me = true;
            m.failed = failed;
            m.text = text;
            m.ts = System.currentTimeMillis();
            m.seq = c.nextSeq++;
            c.msgs.add(m);
            c.error = error == null ? "" : error;
            trim(c);
            c.updated = System.currentTimeMillis();
            write(p, c);
            return c;
        }
    }

    /** Đánh dấu mọi tin hiện có là đã đọc (giữ lại để còn vẽ bong bóng). */
    static Conv markRead(Context ctx, String cid) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(ctx);
            Conv c = read(p, cid);
            if (c == null) return null;
            c.readSeq = c.nextSeq - 1;
            c.error = "";
            write(p, c);
            return c;
        }
    }

    static void remove(Context ctx, String cid) {
        synchronized (LOCK) {
            prefs(ctx).edit().remove(KEY_PREFIX + cid).commit();
        }
    }

    static void setShortcut(Context ctx, String cid, String sig) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(ctx);
            Conv c = read(p, cid);
            if (c == null) return;
            c.shortcutSig = sig;
            c.shortcutAt = System.currentTimeMillis();
            write(p, c);
        }
    }

    private static void trim(Conv c) {
        while (c.msgs.size() > MAX_MESSAGES) c.msgs.remove(0);
    }

    private static Conv read(SharedPreferences p, String cid) {
        String raw = p.getString(KEY_PREFIX + cid, null);
        if (raw == null) return null;
        try {
            JSONObject o = new JSONObject(raw);
            Conv c = new Conv();
            c.cid = cid;
            c.title = o.optString("title", "");
            c.group = o.optBoolean("group", false);
            c.url = o.optString("url", "");
            c.nextSeq = o.optLong("nextSeq", 1);
            c.readSeq = o.optLong("readSeq", 0);
            c.updated = o.optLong("updated", 0);
            c.error = o.optString("error", "");
            c.shortcutSig = o.optString("scSig", "");
            c.shortcutAt = o.optLong("scAt", 0);
            JSONArray arr = o.optJSONArray("msgs");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject j = arr.optJSONObject(i);
                    if (j == null) continue;
                    Msg m = new Msg();
                    m.mid = j.optString("mid", "");
                    m.senderId = j.optString("sid", "");
                    m.sender = j.optString("name", "");
                    m.avatar = j.optString("av", "");
                    m.text = j.optString("text", "");
                    m.ts = j.optLong("ts", 0);
                    m.seq = j.optLong("seq", 0);
                    m.me = j.optBoolean("me", false);
                    m.failed = j.optBoolean("err", false);
                    c.msgs.add(m);
                }
            }
            return c;
        } catch (JSONException e) {
            return null;
        }
    }

    private static void write(SharedPreferences p, Conv c) {
        try {
            JSONObject o = new JSONObject();
            o.put("title", c.title);
            o.put("group", c.group);
            o.put("url", c.url);
            o.put("nextSeq", c.nextSeq);
            o.put("readSeq", c.readSeq);
            o.put("updated", c.updated);
            o.put("error", c.error);
            o.put("scSig", c.shortcutSig);
            o.put("scAt", c.shortcutAt);
            JSONArray arr = new JSONArray();
            for (Msg m : c.msgs) {
                JSONObject j = new JSONObject();
                j.put("mid", m.mid);
                j.put("sid", m.senderId);
                j.put("name", m.sender);
                j.put("av", m.avatar);
                j.put("text", m.text);
                j.put("ts", m.ts);
                j.put("seq", m.seq);
                j.put("me", m.me);
                j.put("err", m.failed);
                arr.put(j);
            }
            o.put("msgs", arr);
            SharedPreferences.Editor e = p.edit().putString(KEY_PREFIX + c.cid, o.toString());
            pruneOld(p, e, c.cid);
            e.commit();
        } catch (JSONException ignored) {}
    }

    /** Giữ tối đa MAX_CONVERSATIONS hội thoại: bỏ những hội thoại lâu nhất không có tin. */
    private static void pruneOld(SharedPreferences p, SharedPreferences.Editor e, String keepCid) {
        Map<String, Object> all = new HashMap<>(p.getAll());
        String keepKey = KEY_PREFIX + keepCid;
        int others = 0;
        for (String k : all.keySet()) if (k.startsWith(KEY_PREFIX) && !k.equals(keepKey)) others++;
        while (others >= MAX_CONVERSATIONS) {
            String oldestKey = null;
            long oldest = Long.MAX_VALUE;
            for (Map.Entry<String, Object> en : all.entrySet()) {
                String k = en.getKey();
                if (!k.startsWith(KEY_PREFIX) || k.equals(keepKey)) continue;
                long upd = 0;
                try {
                    upd = new JSONObject(String.valueOf(en.getValue())).optLong("updated", 0);
                } catch (JSONException ignored) {}
                if (upd < oldest) {
                    oldest = upd;
                    oldestKey = k;
                }
            }
            if (oldestKey == null) break;
            e.remove(oldestKey);
            all.remove(oldestKey);
            others--;
        }
    }
}
