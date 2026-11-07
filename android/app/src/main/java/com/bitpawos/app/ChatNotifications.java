package com.bitpawos.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;
import androidx.core.content.LocusIdCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Thông báo tin nhắn kiểu Messenger: MessagingStyle (avatar, nhiều tin nối nhau, tên nhóm),
 * hội thoại Android 11+ (lối tắt dài hạn + LocusId), bong bóng chat (BubbleActivity),
 * trả lời nhanh / đánh dấu đã đọc (ChatActionReceiver), 1 thông báo cho mỗi hội thoại và
 * 1 thông báo tổng khi có từ 2 hội thoại.
 *
 * Định danh: tag "pn-chat-<cid>", id 0 — trùng đúng tag mà dạng tin "notification" cũ của
 * máy chủ dùng (FCM tự vẽ với id 0), nên thông báo mới thay thế thông báo cũ cùng hội thoại.
 */
final class ChatNotifications {

    private static final String TAG = "PawNailChat";

    static final String CHANNEL_MESSAGES = "messages";
    static final String CHANNEL_CALLS = "calls";
    static final String CHANNEL_GENERAL = "general";

    static final String TAG_PREFIX = "pn-chat-";
    static final int CHAT_ID = 0;
    private static final String SUMMARY_TAG = "pn-chat-summary";
    private static final int SUMMARY_ID = 0x5EED;
    static final String GROUP_KEY = "com.bitpawos.app.CHAT";
    static final String SHORTCUT_PREFIX = "conv_";

    /** Intent extra (String): id hội thoại — MainActivity xoá thông báo của hội thoại vừa mở. */
    static final String EXTRA_CID = "pn_cid";
    static final String ACTION_OPEN_CHAT = "com.bitpawos.app.action.OPEN_CHAT";

    private static final int BUBBLE_HEIGHT_DP = 600;
    private static final long SHORTCUT_REFRESH_MS = 6L * 60 * 60 * 1000;
    private static final int TEXT_MAX = 1000;

    enum Mode {
        /** Tin mới: kêu, rung, hiện nổi (heads-up), bong bóng có chấm + chữ bay ra. */
        ALERT,
        /** Cập nhật im lặng (app đang mở, bong bóng đang mở, vừa trả lời nhanh). */
        SILENT,
        /** Đã đọc nhưng đang là bong bóng: ẩn khỏi khay, giữ bong bóng. */
        HIDDEN
    }

    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

    private ChatNotifications() {}

    static void runAsync(Runnable r) {
        WORKER.execute(() -> {
            try {
                r.run();
            } catch (Throwable t) {
                Log.w(TAG, "background task failed", t);
            }
        });
    }

    static String tagFor(String cid) {
        return TAG_PREFIX + cid;
    }

    // ---------------------------------------------------------------------------------
    // Kênh thông báo — tạo lúc mở app và trong service (trước khi FCM tự vẽ tin "notification").
    // Mức quan trọng KHÔNG đổi được sau khi tạo: giữ nguyên id kênh.
    // ---------------------------------------------------------------------------------

    private static volatile boolean channelsReady = false;

    /** Lần đầu trong tiến trình (service / receiver) — MainActivity luôn gọi ensureChannels. */
    static void ensureChannelsOnce(Context ctx) {
        if (!channelsReady) ensureChannels(ctx);
    }

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        int accent = ContextCompat.getColor(ctx, R.color.pn_notification_accent);

        NotificationChannel messages = new NotificationChannel(
            CHANNEL_MESSAGES,
            ctx.getString(R.string.channel_messages_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        messages.setDescription(ctx.getString(R.string.channel_messages_desc));
        messages.setShowBadge(true);
        messages.enableVibration(true);
        messages.enableLights(true);
        messages.setLightColor(accent);
        messages.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) messages.setAllowBubbles(true);

        NotificationChannel calls = new NotificationChannel(
            CHANNEL_CALLS,
            ctx.getString(R.string.channel_calls_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        calls.setDescription(ctx.getString(R.string.channel_calls_desc));
        calls.setShowBadge(true);
        calls.enableVibration(true);
        calls.setVibrationPattern(new long[] { 0, 600, 400, 600, 400, 600 });
        calls.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationChannel general = new NotificationChannel(
            CHANNEL_GENERAL,
            ctx.getString(R.string.channel_general_name),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        general.setDescription(ctx.getString(R.string.channel_general_desc));
        general.setShowBadge(true);

        List<NotificationChannel> all = new ArrayList<>();
        all.add(messages);
        all.add(calls);
        all.add(general);
        // Tạo lại kênh đã có chỉ cập nhật tên/mô tả (đổi ngôn ngữ máy), không đè lựa chọn của người dùng.
        nm.createNotificationChannels(all);
        channelsReady = true;
    }

    static boolean canPost(Context ctx) {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return false;
        }
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    // ---------------------------------------------------------------------------------
    // Tin đến (PawNailMessagingService, data.type == "chat")
    // ---------------------------------------------------------------------------------

    /** @return false nếu payload không hợp lệ (bỏ qua). */
    static boolean onIncoming(Context ctx, Map<String, String> d) {
        String cid = d.get("cid");
        if (!AppLinks.isConversationId(cid)) return false;
        boolean group = "1".equals(d.get("group")) || "true".equalsIgnoreCase(d.get("group"));
        String sender = clean(d.get("sender"), 80);
        String title = clean(d.get("title"), 80);
        if (sender.isEmpty()) sender = title.isEmpty() ? ctx.getString(R.string.app_name) : title;
        if (title.isEmpty()) title = group ? ctx.getString(R.string.chat_group_fallback) : sender;
        String url = d.get("url");
        if (!AppLinks.isSafePath(url)) url = AppLinks.conversationPath(cid);

        ChatStore.Msg m = new ChatStore.Msg();
        m.mid = nonNull(d.get("mid"));
        m.senderId = nonNull(d.get("senderId"));
        m.sender = sender;
        m.avatar = nonNull(d.get("avatar"));
        m.text = clean(d.get("text"), TEXT_MAX);
        if (m.text.isEmpty()) m.text = ctx.getString(R.string.chat_new_message);
        m.ts = parseLong(d.get("ts"), System.currentTimeMillis());

        // Tải avatar người gửi TRƯỚC (mạng, tối đa ~5 s) để phần vẽ chỉ đọc cache.
        ChatAvatars.loadSquare(ctx, m.avatar, true);

        ChatStore.Conv c = ChatStore.addIncoming(ctx, cid, title, group, url, m);
        if (c == null) return true; // tin trùng (FCM gửi lại)

        // Đang mở đúng hội thoại này trong app: web đã hiện tin, không báo gì thêm.
        if (AppState.isViewingInMain(cid)) {
            clear(ctx, cid);
            return true;
        }
        // App đang mở (trang khác): web tự hiện toast + âm thanh → chỉ cập nhật khay, im lặng.
        // Bong bóng của hội thoại đang mở: web trong bong bóng đã hiện tin.
        Mode mode = (AppState.isMainResumed() || AppState.isBubbleOpen(cid)) ? Mode.SILENT : Mode.ALERT;
        post(ctx, cid, mode);
        return true;
    }

    // ---------------------------------------------------------------------------------
    // Vẽ + đăng
    // ---------------------------------------------------------------------------------

    private static final Object POST_LOCK = new Object();

    /**
     * Đăng (lại) thông báo của hội thoại từ trạng thái MỚI NHẤT đã lưu (service, nút trả lời,
     * plugin có thể gọi cùng lúc: tuần tự hoá để bản cũ không đè bản mới). Chỉ dùng avatar đã
     * cache — không có mạng ở đây.
     */
    static void post(Context ctx, String cid, Mode mode) {
        if (!canPost(ctx)) return;
        synchronized (POST_LOCK) {
            ChatStore.Conv c = ChatStore.get(ctx, cid);
            if (c == null) return;
            try {
                render(ctx, c, mode);
            } catch (RuntimeException | OutOfMemoryError e) {
                Log.w(TAG, "render failed: " + e.getClass().getSimpleName());
            }
        }
    }

    private static void render(Context ctx, ChatStore.Conv c, Mode mode) {
        ensureChannelsOnce(ctx);
        String cid = c.cid;

        List<ChatStore.Msg> shown = c.visible();
        if (shown.isEmpty()) {
            ChatStore.Msg last = c.last();
            if (last == null) return;
            shown = Collections.singletonList(last);
        }

        Person me = new Person.Builder().setName(ctx.getString(R.string.chat_you)).setKey("me").build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me);
        if (c.group) style.setConversationTitle(c.title);
        style.setGroupConversation(c.group);

        Map<String, Person> people = new HashMap<>();
        Map<String, Bitmap> squares = new HashMap<>();
        ChatStore.Msg partner = null; // người gửi tin đến gần nhất (1-1: chính là người kia)
        for (ChatStore.Msg m : c.msgs) if (!m.me) partner = m;
        CharSequence lastText = "";
        long lastTs = 0;
        for (ChatStore.Msg m : shown) {
            Person who = null;
            if (!m.me) {
                String key = personKey(m);
                who = people.get(key);
                if (who == null) {
                    Bitmap sq = ChatAvatars.loadSquare(ctx, m.avatar, false);
                    if (sq != null) squares.put(key, sq);
                    who = buildPerson(m, sq);
                    people.put(key, who);
                }
            }
            CharSequence text = m.failed ? ctx.getString(R.string.chat_not_sent, m.text) : m.text;
            style.addMessage(new NotificationCompat.MessagingStyle.Message(text, m.ts > 0 ? m.ts : System.currentTimeMillis(), who));
            lastText = m.me ? text : (c.group ? m.sender + ": " + text : text);
            lastTs = m.ts;
        }

        // Ảnh hội thoại (lối tắt, bong bóng): 1-1 = avatar người kia; nhóm = chữ cái đầu tên nhóm.
        Bitmap partnerSquare = null;
        if (!c.group && partner != null) {
            partnerSquare = squares.get(personKey(partner));
            if (partnerSquare == null) partnerSquare = ChatAvatars.loadSquare(ctx, partner.avatar, false);
        }
        IconCompat convIcon;
        if (partnerSquare != null) {
            convIcon = IconCompat.createWithAdaptiveBitmap(ChatAvatars.adaptive(partnerSquare, ChatAvatars.ADAPTIVE_PX));
        } else {
            String name = c.group || partner == null ? c.title : partner.sender;
            String key = c.group || partner == null ? cid : personKey(partner);
            convIcon = IconCompat.createWithAdaptiveBitmap(ChatAvatars.initialsAdaptive(name, key, ChatAvatars.ADAPTIVE_PX));
        }

        String shortcutId = SHORTCUT_PREFIX + cid;
        Person partnerPerson = !c.group && partner != null ? people.get(personKey(partner)) : null;
        if (!c.group && partner != null && partnerPerson == null) partnerPerson = buildPerson(partner, partnerSquare);
        boolean hasShortcut = ensureShortcut(ctx, c, shortcutId, convIcon, partnerPerson, partner);

        int accent = ContextCompat.getColor(ctx, R.color.pn_notification_accent);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setStyle(style)
            .setContentTitle(c.title)
            .setContentText(lastText)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openIntent(ctx, c))
            .setDeleteIntent(broadcast(ctx, ChatActionReceiver.ACTION_DISMISS, cid, 2, false))
            .setAutoCancel(true)
            .setGroup(GROUP_KEY)
            .setWhen(lastTs > 0 ? lastTs : System.currentTimeMillis())
            .setShowWhen(true)
            .setNumber(c.unreadCount())
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion(ctx, accent))
            .setOnlyAlertOnce(mode != Mode.ALERT)
            .setSilent(mode != Mode.ALERT)
            .addAction(replyAction(ctx, cid))
            .addAction(markReadAction(ctx, cid));
        if (!c.error.isEmpty()) b.setSubText(c.error);
        if (hasShortcut) {
            b.setShortcutId(shortcutId);
            b.setLocusId(new LocusIdCompat(shortcutId));
        }
        // Android < 9 không vẽ avatar trong MessagingStyle → dùng large icon.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P && partner != null && !c.group) {
            b.setLargeIcon(
                partnerSquare != null
                    ? ChatAvatars.circle(partnerSquare, ChatAvatars.PERSON_PX)
                    : ChatAvatars.initialsCircle(partner.sender, personKey(partner), ChatAvatars.PERSON_PX)
            );
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && hasShortcut) {
            b.setBubbleMetadata(
                new NotificationCompat.BubbleMetadata.Builder(bubbleIntent(ctx, c), convIcon)
                    .setDesiredHeight(BUBBLE_HEIGHT_DP)
                    .setAutoExpandBubble(false)
                    .setSuppressNotification(mode == Mode.HIDDEN)
                    .build()
            );
        }

        try {
            NotificationManagerCompat.from(ctx).notify(tagFor(cid), CHAT_ID, b.build());
        } catch (RuntimeException e) {
            // SecurityException (mất quyền) / TransactionTooLarge — không bao giờ làm sập service.
            Log.w(TAG, "notify failed: " + e.getClass().getSimpleName());
            return;
        }
        updateSummary(ctx, cid, null);
    }

    private static String personKey(ChatStore.Msg m) {
        return "u:" + (m.senderId.isEmpty() ? m.sender : m.senderId);
    }

    private static Person buildPerson(ChatStore.Msg m, Bitmap square) {
        Bitmap icon = square != null
            ? ChatAvatars.circle(square, ChatAvatars.PERSON_PX)
            : ChatAvatars.initialsCircle(m.sender, personKey(m), ChatAvatars.PERSON_PX);
        return new Person.Builder().setName(m.sender).setKey(personKey(m)).setIcon(IconCompat.createWithBitmap(icon)).build();
    }

    private static Notification publicVersion(Context ctx, int accent) {
        return new NotificationCompat.Builder(ctx, CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setContentTitle(ctx.getString(R.string.app_name))
            .setContentText(ctx.getString(R.string.chat_new_message))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build();
    }

    /**
     * Lối tắt hội thoại dài hạn (Android 11+): điều kiện để thông báo vào mục "Cuộc trò
     * chuyện", có ưu tiên / bong bóng. Android < 11 không dùng → không đẩy (tránh giới hạn
     * tần suất của ShortcutManager cũ).
     */
    private static boolean ensureShortcut(
        Context ctx,
        ChatStore.Conv c,
        String shortcutId,
        IconCompat icon,
        Person partnerPerson,
        ChatStore.Msg partner
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false;
        String sig = c.title + "|" + c.group + "|" + (partner != null ? partner.avatar + "|" + partner.sender : "") + "|" + c.url;
        boolean recent = sig.equals(c.shortcutSig) && System.currentTimeMillis() - c.shortcutAt < SHORTCUT_REFRESH_MS;
        if (recent && shortcutExists(ctx, shortcutId)) return true;
        try {
            Intent open = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(AppLinks.EXTRA_URL, c.url)
                .putExtra(EXTRA_CID, c.cid);
            ShortcutInfoCompat.Builder sb = new ShortcutInfoCompat.Builder(ctx, shortcutId)
                .setShortLabel(c.title)
                .setLongLabel(c.title)
                .setIcon(icon)
                .setIntent(open)
                .setLongLived(true)
                .setLocusId(new LocusIdCompat(shortcutId))
                .setIsConversation()
                .setCategories(Collections.singleton("com.bitpawos.app.category.CONVERSATION"));
            if (partnerPerson != null) sb.setPerson(partnerPerson);
            boolean ok = ShortcutManagerCompat.pushDynamicShortcut(ctx, sb.build());
            if (ok) ChatStore.setShortcut(ctx, c.cid, sig);
            return ok || shortcutExists(ctx, shortcutId);
        } catch (RuntimeException e) {
            Log.w(TAG, "shortcut push failed: " + e.getClass().getSimpleName());
            return shortcutExists(ctx, shortcutId);
        }
    }

    private static boolean shortcutExists(Context ctx, String id) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false;
        try {
            ShortcutManager sm = ctx.getSystemService(ShortcutManager.class);
            if (sm == null) return false;
            for (ShortcutInfo s : sm.getShortcuts(ShortcutManager.FLAG_MATCH_DYNAMIC | ShortcutManager.FLAG_MATCH_CACHED)) {
                if (id.equals(s.getId())) return true;
            }
        } catch (RuntimeException ignored) {}
        return false;
    }

    // ---------------------------------------------------------------------------------
    // Intent: chạm (Activity trực tiếp — Android 12 cấm "trampoline"), bong bóng, nút bấm
    // ---------------------------------------------------------------------------------

    private static int requestCode(String cid, int kind) {
        return cid.hashCode() * 8 + kind;
    }

    static Intent openChatIntent(Context ctx, String cid, String url) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setAction(ACTION_OPEN_CHAT)
            .putExtra(AppLinks.EXTRA_URL, url)
            .putExtra(EXTRA_CID, cid)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) i.setIdentifier("chat:" + cid);
        return i;
    }

    private static PendingIntent openIntent(Context ctx, ChatStore.Conv c) {
        return PendingIntent.getActivity(
            ctx,
            requestCode(c.cid, 0),
            openChatIntent(ctx, c.cid, c.url),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static PendingIntent bubbleIntent(Context ctx, ChatStore.Conv c) {
        Intent i = new Intent(ctx, BubbleActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("pawnail-bubble://conversation/" + Uri.encode(c.cid)))
            .putExtra(AppLinks.EXTRA_URL, c.url)
            .putExtra(EXTRA_CID, c.cid);
        // Bong bóng BẮT BUỘC PendingIntent mutable (Android 12+), hệ thống gắn thêm dữ liệu.
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getActivity(ctx, requestCode(c.cid, 3), i, flags);
    }

    private static PendingIntent broadcast(Context ctx, String action, String cid, int kind, boolean mutable) {
        Intent i = new Intent(ctx, ChatActionReceiver.class)
            .setAction(action)
            .setData(Uri.parse("pawnail-notif://chat/" + Uri.encode(cid) + "/" + kind))
            .putExtra(EXTRA_CID, cid);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (mutable) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        } else {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, requestCode(cid, kind), i, flags);
    }

    private static NotificationCompat.Action replyAction(Context ctx, String cid) {
        RemoteInput input = new RemoteInput.Builder(ChatActionReceiver.KEY_REPLY)
            .setLabel(ctx.getString(R.string.chat_reply_hint))
            .build();
        // RemoteInput cần PendingIntent mutable (hệ thống điền chữ người dùng gõ vào intent).
        return new NotificationCompat.Action.Builder(
            R.drawable.ic_stat_pawnail,
            ctx.getString(R.string.chat_reply),
            broadcast(ctx, ChatActionReceiver.ACTION_REPLY, cid, 1, true)
        )
            .addRemoteInput(input)
            .setAllowGeneratedReplies(true)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .setShowsUserInterface(false)
            .build();
    }

    private static NotificationCompat.Action markReadAction(Context ctx, String cid) {
        return new NotificationCompat.Action.Builder(
            R.drawable.ic_stat_pawnail,
            ctx.getString(R.string.chat_mark_read),
            broadcast(ctx, ChatActionReceiver.ACTION_MARK_READ, cid, 4, false)
        )
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
            .setShowsUserInterface(false)
            .build();
    }

    // ---------------------------------------------------------------------------------
    // Xoá / đã đọc / thông báo tổng
    // ---------------------------------------------------------------------------------

    /**
     * Hội thoại đã được xem (mở trong app, bấm "Đánh dấu đã đọc", JS clearConversation):
     * huỷ thông báo và quên lịch sử. Riêng hội thoại đang là bong bóng: huỷ thông báo sẽ
     * xoá luôn bong bóng, nên chỉ ẩn khỏi khay (giữ bong bóng, tin cuối để vẽ lại).
     */
    static void clear(Context ctx, String cid) {
        if (!AppLinks.isConversationId(cid)) return;
        StatusBarNotification sbn = findActive(ctx, cid);
        if (sbn != null && isBubble(sbn)) {
            ChatStore.Conv c = ChatStore.markRead(ctx, cid);
            if (c != null && !c.msgs.isEmpty()) {
                post(ctx, cid, Mode.HIDDEN);
                return;
            }
        }
        NotificationManagerCompat.from(ctx).cancel(tagFor(cid), CHAT_ID);
        ChatStore.remove(ctx, cid);
        updateSummary(ctx, null, cid);
    }

    static void clearAsync(Context ctx, String cid) {
        Context app = ctx.getApplicationContext();
        runAsync(() -> clear(app, cid));
    }

    /** Người dùng vuốt bỏ thông báo: quên lịch sử để tin sau bắt đầu lại từ đầu. */
    static void forget(Context ctx, String cid) {
        ChatStore.remove(ctx, cid);
        updateSummary(ctx, null, cid);
    }

    private static boolean isBubble(StatusBarNotification sbn) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && (sbn.getNotification().flags & Notification.FLAG_BUBBLE) != 0;
    }

    private static StatusBarNotification findActive(Context ctx, String cid) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return null;
        String tag = tagFor(cid);
        try {
            for (StatusBarNotification s : nm.getActiveNotifications()) {
                if (s.getId() == CHAT_ID && tag.equals(s.getTag())) return s;
            }
        } catch (RuntimeException ignored) {}
        return null;
    }

    /** Thông báo tổng khi có từ 2 hội thoại trong nhóm; ít hơn thì gỡ. */
    static void updateSummary(Context ctx, String postedCid, String removedCid) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        Set<String> cids = new LinkedHashSet<>();
        try {
            for (StatusBarNotification s : nm.getActiveNotifications()) {
                String t = s.getTag();
                if (t == null || s.getId() != CHAT_ID || !t.startsWith(TAG_PREFIX)) continue;
                if (!GROUP_KEY.equals(s.getNotification().getGroup())) continue;
                cids.add(t.substring(TAG_PREFIX.length()));
            }
        } catch (RuntimeException e) {
            return;
        }
        // notify()/cancel() xếp hàng bất đồng bộ: danh sách vừa đọc có thể chưa phản ánh thay đổi.
        if (postedCid != null) cids.add(postedCid);
        if (removedCid != null) cids.remove(removedCid);
        NotificationManagerCompat nmc = NotificationManagerCompat.from(ctx);
        if (cids.size() < 2) {
            nmc.cancel(SUMMARY_TAG, SUMMARY_ID);
            return;
        }
        if (!canPost(ctx)) return;
        String count = ctx.getResources().getQuantityString(R.plurals.chat_summary_conversations, cids.size(), cids.size());
        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle().setSummaryText(count);
        int lines = 0;
        for (String id : cids) {
            if (lines >= 5) break;
            ChatStore.Conv c = ChatStore.get(ctx, id);
            if (c == null) continue;
            ChatStore.Msg last = c.last();
            if (last == null) continue;
            SpannableStringBuilder line = new SpannableStringBuilder(c.title);
            line.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), 0, line.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            line.append("  ").append(last.me ? ctx.getString(R.string.chat_you) + ": " + last.text : last.text);
            inbox.addLine(line);
            lines++;
        }
        int accent = ContextCompat.getColor(ctx, R.color.pn_notification_accent);
        Intent open = new Intent(ctx, MainActivity.class)
            .setAction(ACTION_OPEN_CHAT)
            .putExtra(AppLinks.EXTRA_URL, "/messages")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) open.setIdentifier("chat-summary");
        Notification summary = new NotificationCompat.Builder(ctx, CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_pawnail)
            .setColor(accent)
            .setContentTitle(ctx.getString(R.string.app_name))
            .setContentText(count)
            .setStyle(inbox)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setGroup(GROUP_KEY)
            .setGroupSummary(true)
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion(ctx, accent))
            .setContentIntent(
                PendingIntent.getActivity(ctx, 0x5EED, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
            )
            .build();
        try {
            nmc.notify(SUMMARY_TAG, SUMMARY_ID, summary);
        } catch (RuntimeException e) {
            Log.w(TAG, "summary notify failed: " + e.getClass().getSimpleName());
        }
    }

    // ---------------------------------------------------------------------------------

    private static String nonNull(String s) {
        return s == null ? "" : s;
    }

    /** Bỏ ký tự điều khiển (trừ xuống dòng), cắt dài, không cắt đôi cặp surrogate. */
    static String clean(String s, int max) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(Math.min(s.length(), max));
        for (int i = 0; i < s.length() && sb.length() < max; ) {
            int cp = s.codePointAt(i);
            int n = Character.charCount(cp);
            if (sb.length() + n > max) break;
            if (cp == '\n' || !Character.isISOControl(cp)) sb.appendCodePoint(cp);
            i += n;
        }
        return sb.toString().trim();
    }

    private static long parseLong(String s, long def) {
        try {
            long v = Long.parseLong(s);
            return v > 0 ? v : def;
        } catch (Exception e) {
            return def;
        }
    }
}
