// Kiểm thử THUẦN (không mạng, không DB) cho thông báo đẩy app native:
//   dạng tin FCM (chat data-only cho app Android build ≥ 3 · dạng notification + kênh cho bản cũ / thông báo khác ·
//   cuộc gọi → kênh "calls") · ngân sách byte · cắt chuỗi không vỡ emoji · build lưu trong p256dh ("native:<build>") ·
//   ảnh đại diện an toàn · tiêu đề / link mở đúng cuộc trò chuyện · web push không mang phần dành cho app.
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/fcm_payload_unit.mts
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
  console.error("Bỏ TURSO_* trước khi chạy (env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …) — bài này không cần DB.");
  process.exit(2);
}
const {
  buildFcmMessage,
  buildFcmReadMessage,
  chatData,
  clipText,
  isDeadTokenError,
  nativeP256dh,
  parseNativeBuild,
  richChatMinBuild,
  safeAppPath,
  validNativeBuild,
  CHAT_TEXT_MAX,
  RICH_CHAT_MIN_BUILD,
} = await import("../../lib/fcm");
const { APP_ORIGIN, chatPushAvatar, chatPushTitle, chatPushUrl } = await import("../../lib/chatPush");
type FcmPayload = import("../../lib/fcm").FcmPayload;

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};
const bytes = (o: unknown) => Buffer.byteLength(JSON.stringify(o), "utf8");
type Msg = { token: string; notification?: { title: string; body: string }; data: Record<string, string>; android: Record<string, unknown> & { notification?: Record<string, unknown> } };
const build = (token: string, b: number | null, p: FcmPayload) => buildFcmMessage({ token, build: b }, p) as unknown as Msg;

const CID = "cmh1abcdefghijklmnopqrstu";
const chatPayload = (over: Partial<FcmPayload> = {}, chatOver: Partial<NonNullable<FcmPayload["chat"]>> = {}): FcmPayload => ({
  title: "Lan Nguyen",
  body: "Chị ơi mai 10h còn chỗ không?",
  url: chatPushUrl(CID),
  tag: `pn-chat-${CID}`,
  chat: { cid: CID, mid: "c0123456789abcdef01234567", senderId: "user_lan", senderName: "Lan Nguyen", avatar: "https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_256,h_256,q_auto,f_jpg/v1/a.jpg", group: false, title: "Lan Nguyen", ts: 1_762_500_000_000, ...chatOver },
  ...over,
});

// ---------- 1. Chat → data-only cho app Android đủ mới ----------
ok("F0", "Mốc build mặc định = 3 (versionCode 3 là bản đầu có service tự vẽ thông báo chat)", RICH_CHAT_MIN_BUILD === 3 && richChatMinBuild() === 3);
{
  const m = build("tokA", 3, chatPayload());
  const d = m.data;
  const KEYS = ["type", "v", "cid", "mid", "title", "sender", "senderId", "avatar", "group", "text", "ts", "url", "tag"];
  ok("F1", "Build 3 + chat → KHÔNG có notification (data-only), đủ 13 khoá đúng hợp đồng",
    !("notification" in m) && KEYS.every((k) => k in d) && Object.keys(d).length === KEYS.length, Object.keys(d));
  ok("F2", "Mọi giá trị data là chuỗi", Object.values(d).every((v) => typeof v === "string"), d);
  ok("F3", "type=chat v=1 cid/mid/senderId/ts đúng; group=0; text = body đã theo ngôn ngữ; url mở đúng cuộc trò chuyện; tag pn-chat-<cid>",
    d.type === "chat" && d.v === "1" && d.cid === CID && d.mid === "c0123456789abcdef01234567" && d.senderId === "user_lan" && d.ts === "1762500000000" &&
      d.group === "0" && d.text === "Chị ơi mai 10h còn chỗ không?" && d.url === `/messages?c=${CID}` && d.tag === `pn-chat-${CID}` && d.sender === "Lan Nguyen" && d.title === "Lan Nguyen", d);
  ok("F4", "android: priority high, ttl 86400s, KHÔNG collapse_key, KHÔNG android.notification",
    m.android.priority === "high" && m.android.ttl === "86400s" && !("collapse_key" in m.android) && !("notification" in m.android), m.android);
  ok("F5", "Tổng thân tin < 3.5 KB", bytes({ message: m }) < 3500, bytes({ message: m }));
  const g = build("tokA", 7, chatPayload({}, { group: true, title: "Tiệm Lan · Thợ", senderName: "Mai" })).data;
  ok("F6", "Nhóm: group=1, title = tên nhóm, sender = người gửi (build 7 cũng nhận data-only)", g.group === "1" && g.title === "Tiệm Lan · Thợ" && g.sender === "Mai", g);
}

// ---------- 2. Ngân sách byte + cắt chuỗi ----------
{
  const emojiWall = "😀".repeat(2000); // 4000 đơn vị UTF-16, 8000 byte
  const cjk = "漢".repeat(5000);
  const longName = "Ngọc Ánh 🌸".repeat(30);
  const longAvatar = "https://res.cloudinary.com/demo/image/upload/v1/" + "a".repeat(900) + ".jpg";
  for (const [id, body, name] of [["F7a", emojiWall, longName], ["F7b", cjk, longName], ["F7c", "x".repeat(10_000), "y".repeat(500)]] as const) {
    const m = build("t".repeat(180), 3, chatPayload({ body }, { senderName: name, title: name, avatar: longAvatar }));
    const d = m.data;
    ok(id, `Nội dung khổng lồ (${body.length} ký tự) → text ≤ ${CHAT_TEXT_MAX}, title/sender ≤ 80, phần data ≤ 3400 byte, cả tin < 3.5 KB`,
      d.text.length <= CHAT_TEXT_MAX && d.title.length <= 80 && d.sender.length <= 80 && bytes(d) <= 3400 && bytes({ message: m }) < 3500 && d.text.endsWith("…"),
      { text: d.text.length, data: bytes(d), all: bytes({ message: m }) });
  }
  const d = chatData(chatPayload({ body: "😀".repeat(400) }) as FcmPayload & { chat: NonNullable<FcmPayload["chat"]> });
  ok("F8", "Không bao giờ còn nửa cặp surrogate trong text / title", !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(d.text + d.title), d.text.slice(-6));
  const fam = "👩‍👩‍👧‍👦";
  const clipped = clipText("ab" + fam.repeat(5), 14);
  ok("F9", "clipText giữ nguyên cụm emoji ghép (ZWJ), dài ≤ max, có '…'", clipped.length <= 14 && clipped.endsWith("…") && clipped.replace(/…$/, "").replace(/^ab/, "").split(fam).every((x) => x === ""), clipped);
  ok("F10", "clipText: ngắn hơn max → giữ nguyên; 'a😀b' cắt 2 → 'a…'", clipText("hello", 5) === "hello" && clipText("a😀b", 2) === "a…" && clipText(null, 5) === "" && clipText("🇻🇳🇺🇸🇦🇺", 5) === "🇻🇳…", [clipText("a😀b", 2), clipText("🇻🇳🇺🇸🇦🇺", 5)]);
  const bad = build("t", 3, chatPayload({}, { avatar: "http://evil.example/a.png" })).data;
  ok("F11", "avatar không phải https:// → \"\" ; url lạ ('//evil', 'https://…') → /messages", bad.avatar === "" && safeAppPath("//evil.com/x") === "/messages" && safeAppPath("https://evil.com") === "/messages" && safeAppPath("/messages?c=1") === "/messages?c=1", bad.avatar);
}

// ---------- 3. Dạng cũ: app cũ / chưa rõ build / không phải chat ----------
{
  for (const [id, b] of [["F12a", null], ["F12b", 2], ["F12c", 0]] as const) {
    const m = build("tokOld", b, chatPayload());
    ok(id, `Chat tới app build ${b} → dạng notification như cũ (title/body + data url/tag) + android.notification.channel_id "general" + tag`,
      m.notification?.title === "Lan Nguyen" && m.notification?.body === "Chị ơi mai 10h còn chỗ không?" && m.data.url === `/messages?c=${CID}` && m.data.tag === `pn-chat-${CID}` &&
        m.android.priority === "high" && m.android.notification?.channel_id === "general" && m.android.notification?.tag === `pn-chat-${CID}` && m.android.notification?.sound === "default" && !("type" in m.data),
      m);
  }
  const other = build("tokNew", 3, { title: "PawNail", body: "Ai đó thích bài của bạn", url: "/profile", tag: "pn-notify" });
  ok("F13", "Thông báo KHÔNG phải chat tới app mới → vẫn dạng notification, kênh general", !!other.notification && other.android.notification?.channel_id === "general" && other.data.url === "/profile", other);
  const call = build("tokNew", 3, { title: "Incoming call", body: "Lan is calling you", url: "/messages?to=u1", tag: "pn-call" });
  const call2 = build("tokOld", null, { title: "Incoming call", body: "x", url: "/messages?to=u1", tag: "x", channel: "calls" });
  ok("F14", "Cuộc gọi (tag pn-call hoặc channel: 'calls') → kênh \"calls\", dạng notification", call.android.notification?.channel_id === "calls" && !!call.notification && call2.android.notification?.channel_id === "calls", [call.android, call2.android]);
  const long = build("tokOld", null, { title: "T".repeat(200), body: "😀".repeat(200), url: "/x" });
  ok("F15", "Dạng notification: title ≤ 80, body ≤ 180, không vỡ emoji; không có tag thì không đặt android.notification.tag",
    long.notification!.title.length <= 80 && long.notification!.body.length <= 180 && !/[\uD800-\uDBFF]…$/.test(long.notification!.body) && !("tag" in long.android.notification!), long.notification);
  process.env.NATIVE_RICH_CHAT_MIN_BUILD = "5";
  const four = build("t", 4, chatPayload());
  const five = build("t", 5, chatPayload());
  process.env.NATIVE_RICH_CHAT_MIN_BUILD = "abc";
  const fallback = richChatMinBuild();
  delete process.env.NATIVE_RICH_CHAT_MIN_BUILD;
  ok("F16", "NATIVE_RICH_CHAT_MIN_BUILD=5 → build 4 nhận dạng cũ, build 5 nhận data-only; giá trị rác → 3", !!four.notification && !("notification" in five) && five.data.type === "chat" && fallback === 3);
}

// ---------- 4. Build lưu trong p256dh ----------
ok("F17", "parseNativeBuild: native:3 → 3, native:0 → 0, native:100000 → 100000; native / native:abc / native:-1 / native:100001 / '' / web key → null",
  parseNativeBuild("native:3") === 3 && parseNativeBuild("native:0") === 0 && parseNativeBuild("native:100000") === 100000 &&
    [parseNativeBuild("native"), parseNativeBuild("native:abc"), parseNativeBuild("native:-1"), parseNativeBuild("native:100001"), parseNativeBuild(""), parseNativeBuild(null), parseNativeBuild("BElongWebPushKey_abc")].every((x) => x === null));
ok("F18", "validNativeBuild: 3 / '12' → số; 3.5 / -1 / 100001 / 'x' / null / NaN → null; nativeP256dh(null) = 'native', (3) = 'native:3'",
  validNativeBuild(3) === 3 && validNativeBuild("12") === 12 && [3.5, -1, 100001, "x", null, NaN, undefined, {}].every((v) => validNativeBuild(v) === null) && nativeP256dh(null) === "native" && nativeP256dh(3) === "native:3");
ok("F19", "Lỗi FCM: 404 / UNREGISTERED / INVALID_ARGUMENT về token → token chết; INVALID_ARGUMENT do thân tin → KHÔNG xoá token",
  isDeadTokenError(404, "") && isDeadTokenError(400, '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}') &&
    isDeadTokenError(400, '{"error":{"message":"The registration token is not a valid FCM registration token","status":"INVALID_ARGUMENT"}}') &&
    !isDeadTokenError(400, '{"error":{"message":"Invalid JSON payload received. Unknown name \\"foo\\" at \'message.android\'","status":"INVALID_ARGUMENT"}}') && !isDeadTokenError(500, "INTERNAL"));

// ---------- 5. Ảnh đại diện / tiêu đề / link ----------
{
  const cl = chatPushAvatar("https://res.cloudinary.com/pawnail/image/upload/v1712/avatars/abc.png");
  const clT = chatPushAvatar("https://res.cloudinary.com/pawnail/image/upload/c_scale,w_500/v1712/avatars/abc.png");
  const g = chatPushAvatar("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c");
  ok("F20", "Cloudinary → ô vuông 256 JPEG trên Cloudinary; đã có biến đổi → giữ nguyên", cl === "https://res.cloudinary.com/pawnail/image/upload/c_fill,g_face,w_256,h_256,q_auto,f_jpg/v1712/avatars/abc.png" && clT === "https://res.cloudinary.com/pawnail/image/upload/c_scale,w_500/v1712/avatars/abc.png", [cl, clT]);
  ok("F21", "Google → qua /_next/image của PawNail (máy chủ lạ không thấy IP người nhận)", g === `${APP_ORIGIN}/_next/image?url=${encodeURIComponent("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c")}&w=256&q=75`, g);
  ok("F22", "Đường dẫn tương đối → URL tuyệt đối https://www.bitpawos.com", chatPushAvatar("/uploads/a.jpg") === "https://www.bitpawos.com/uploads/a.jpg" && chatPushAvatar("https://bitpawos.com/icon.jpg") === "https://www.bitpawos.com/icon.jpg");
  const rejected = [
    "data:image/png;base64," + "A".repeat(5000),
    "https://api.dicebear.com/7.x/avataaars/svg?seed=x",
    "https://ui-avatars.com/api/?name=Lan",
    "https://tracker.evil.example/p.gif?u=1",
    "http://res.cloudinary.com/x/image/upload/v1/a.jpg",
    "//evil.example/a.jpg",
    "/icons/logo.svg",
    "https://res.cloudinary.com/x/video/upload/v1/a.mp4",
    "https://res.cloudinary.com/x/image/upload/v1/a.svg",
    "https://user:pw@res.cloudinary.com/x/image/upload/v1/a.jpg",
    "javascript:alert(1)",
    "",
    null,
  ];
  const leaks = rejected.filter((u) => chatPushAvatar(u) !== "");
  ok("F23", "data: / dicebear SVG / ui-avatars / host lạ / http / '//' / SVG / video / có user:pass / rỗng → \"\" (app tự vẽ chữ cái đầu)", leaks.length === 0, leaks);
  ok("F24", "Tiêu đề: 1-1 = tên người gửi; nhóm có tên = tên nhóm; nhóm chưa đặt tên = 'Lan, Mai, Hoa +1'",
    chatPushTitle({ isGroup: false }, "Lan") === "Lan" && chatPushTitle({ isGroup: true, name: " Thợ Q7 " }, "Lan") === "Thợ Q7" &&
      chatPushTitle({ isGroup: true, name: null, participants: [{ id: "1", name: "Lan Nguyen" }, { id: "2", name: "Mai" }, { id: "3", name: "Hoa Tran" }, { id: "4", name: "Kim" }] }, "Lan") === "Lan, Mai, Hoa +1" &&
      chatPushTitle({ isGroup: true, participants: [] }, "Lan") === "Lan");
  ok("F25", "Link chat: /messages?c=<id> (mã hoá ký tự lạ)", chatPushUrl("abc") === "/messages?c=abc" && chatPushUrl("a&b") === "/messages?c=a%26b");
}

// ---------- 6. "Đã đọc" → gỡ thông báo trên máy Android khác của chính mình ----------
{
  const r = buildFcmReadMessage("tokR", CID) as unknown as Msg;
  ok("F27", "Tin 'đã đọc': data-only {type:read, v:1, cid}, ưu tiên thường, ttl 6 giờ, không notification",
    !("notification" in r) && r.data.type === "read" && r.data.v === "1" && r.data.cid === CID && Object.keys(r.data).length === 3 && r.android.priority === "normal" && r.android.ttl === "21600s", r);
}

// ---------- 7. Web push giữ nguyên dạng cũ ----------
{
  const { webPushBody } = await import("../../lib/push");
  const w = JSON.parse(webPushBody({ ...chatPayload(), channel: "general" }));
  ok("F26", "Web push: chỉ icon/title/body/url/tag — không mang chat/channel", Object.keys(w).sort().join() === "body,icon,tag,title,url" && w.url === `/messages?c=${CID}` && w.tag === `pn-chat-${CID}`, w);
}

console.log(`\nfcm payload unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
