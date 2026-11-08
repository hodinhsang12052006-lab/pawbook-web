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
const { APP_ORIGIN, chatPushAvatar, chatPushLegacyTitle, chatPushTitle, chatPushUrl, cleanDisplayName, isUnnamedGroup } = await import("../../lib/chatPush");
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
    ok(id, `Chat tới app build ${b} → dạng notification như cũ (title/body + data url/tag) + android.notification.channel_id "messages" (app chưa có kênh → FCM tự về kênh mặc định) + tag`,
      m.notification?.title === "Lan Nguyen" && m.notification?.body === "Chị ơi mai 10h còn chỗ không?" && m.data.url === `/messages?c=${CID}` && m.data.tag === `pn-chat-${CID}` &&
        m.android.priority === "high" && m.android.notification?.channel_id === "messages" && m.android.notification?.tag === `pn-chat-${CID}` && m.android.notification?.sound === "default" && !("type" in m.data),
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
    // Trên chính bitpawos.com chỉ được là ĐƯỜNG DẪN ẢNH: điện thoại người nhận tải kèm cookie phiên của họ.
    "/api/auth/signout",
    "/api/messages?x=1",
    "/auth/login",
    "/profile/abc",
    "/admin/a.png",
    "/uploads/../api/x.png",
    "https://www.bitpawos.com/api/messages",
    "https://bitpawos.com/auth/x.png",
    "",
    null,
  ];
  const leaks = rejected.filter((u) => chatPushAvatar(u) !== "");
  ok("F23", "data: / dicebear SVG / ui-avatars / host lạ / http / '//' / SVG / video / có user:pass / /api /auth /profile của bitpawos / rỗng → \"\" (app tự vẽ chữ cái đầu)", leaks.length === 0, leaks);
  ok("F24", "Tiêu đề: 1-1 = tên người gửi; nhóm có tên = tên nhóm; nhóm chưa đặt tên = 'Lan, Mai, Hoa +1'",
    chatPushTitle({ isGroup: false }, "Lan") === "Lan" && chatPushTitle({ isGroup: true, name: " Thợ Q7 " }, "Lan") === "Thợ Q7" &&
      chatPushTitle({ isGroup: true, name: null, participants: [{ id: "1", name: "Lan Nguyen" }, { id: "2", name: "Mai" }, { id: "3", name: "Hoa Tran" }, { id: "4", name: "Kim" }] }, "Lan") === "Lan, Mai, Hoa +1" &&
      chatPushTitle({ isGroup: true, participants: [] }, "Lan") === "Lan");
  ok("F25", "Link chat: /messages?c=<id> (mã hoá ký tự lạ)", chatPushUrl("abc") === "/messages?c=abc" && chatPushUrl("a&b") === "/messages?c=a%26b");
  const unnamed = { isGroup: true, name: null, participants: [{ id: "k", name: "Kim Le" }, { id: "a", name: "Ava" }, { id: "l", name: "Lan" }] };
  ok("F28", "Nhóm chưa đặt tên nhìn từ người nhận: bỏ chính người nhận ('Kim, Lan' cho Ava); dạng cũ 'Kim Le · Lan' (không lặp người gửi, không có người nhận); nhóm có tên giữ 'Người gửi · Nhóm'",
    chatPushTitle(unnamed, "Kim Le", "a") === "Kim, Lan" && chatPushLegacyTitle(unnamed, "Kim Le", "k", "a") === "Kim Le · Lan" &&
      chatPushLegacyTitle({ isGroup: true, participants: [{ id: "k", name: "Kim" }, { id: "a", name: "Ava" }] }, "Kim", "k", "a") === "Kim" &&
      chatPushLegacyTitle({ isGroup: true, name: "Saturday Crew" }, "Kim", "k", "a") === "Kim · Saturday Crew" && chatPushLegacyTitle({ isGroup: false }, "Kim", "k", "a") === "Kim" &&
      isUnnamedGroup(unnamed) && !isUnnamedGroup({ isGroup: true, name: "X" }) && !isUnnamedGroup({ isGroup: false }),
    [chatPushTitle(unnamed, "Kim Le", "a"), chatPushLegacyTitle(unnamed, "Kim Le", "k", "a")]);
  ok("F29", "Tên tự đặt mất ký tự bidi / độ rộng 0 (giả mạo thứ tự hiển thị), giữ ZWJ của emoji ghép",
    cleanDisplayName("Ad\u202Emin\u200B\uFEFF") === "Admin" && chatPushTitle({ isGroup: true, name: "\u2066Crew\u2069" }, "x") === "Crew" && cleanDisplayName("Kim 👩‍👩‍👧") === "Kim 👩‍👩‍👧",
    cleanDisplayName("Ad\u202Emin"));
}

// ---------- 6. "Đã đọc" → gỡ thông báo trên máy Android khác của chính mình ----------
{
  const r = buildFcmReadMessage("tokR", CID, 1_762_500_000_123) as unknown as Msg;
  ok("F27", "Tin 'đã đọc': data-only {type:read, v:1, cid, ts = mốc đọc ms}, ưu tiên thường, ttl 6 giờ, không notification",
    !("notification" in r) && r.data.type === "read" && r.data.v === "1" && r.data.cid === CID && r.data.ts === "1762500000123" && Object.keys(r.data).length === 4 && r.android.priority === "normal" && r.android.ttl === "21600s", r);
}

// ---------- 7. Web push giữ nguyên dạng cũ ----------
{
  const { webPushBody } = await import("../../lib/push");
  const w = JSON.parse(webPushBody({ ...chatPayload(), channel: "general" }));
  ok("F26", "Web push: chỉ icon/title/body/url/tag — không mang chat/channel", Object.keys(w).sort().join() === "body,icon,tag,title,url" && w.url === `/messages?c=${CID}` && w.tag === `pn-chat-${CID}`, w);
}

// ---------- 8. Cuộc gọi: TTL ngắn, tag + mã gộp riêng từng cuộc gọi, tin kết thúc THAY tin "đang gọi" ----------
{
  const { incomingCallPush, callEndPush, followUpFor, createFollowUpGate, ownDeviceEndpoints, CALL_PUSH_TTL_SEC, FOLLOW_UP_WINDOW_MS } = await import("../../lib/calls/callPush");
  const { webPushBody, webPushOptions } = await import("../../lib/push");
  type AnyMsg = Msg & { apns: { headers?: Record<string, string>; payload: unknown } };
  const NOW = 1_800_000_000_000;
  const inc = incomingCallPush({ callId: "abc123xyz", callType: "video", callerId: "u_caller", callerName: "Lan  Nguyen", now: NOW });
  const t0 = Math.floor(Date.now() / 1000);
  const m = buildFcmMessage({ token: "tokC", build: 3 }, inc) as unknown as AnyMsg;
  const exp = Number(m.apns.headers?.["apns-expiration"]);
  ok("F30", "Cuộc gọi đến → FCM: notification (mọi build), kênh calls, tag pn-call-<callId>, android.ttl 60s, collapse_key call-<callId>, APNs hết hạn sau 60 s",
    !!m.notification && m.android.ttl === "60s" && m.android.collapse_key === "call-abc123xyz" && m.android.notification?.tag === "pn-call-abc123xyz" &&
      m.android.notification?.channel_id === "calls" && exp >= t0 + 59 && exp <= t0 + 62 && m.apns.headers?.["apns-collapse-id"] === "call-abc123xyz" && CALL_PUSH_TTL_SEC === 60, m);
  const w = webPushOptions(inc);
  const wb = JSON.parse(webPushBody(inc));
  ok("F31", "Cuộc gọi đến → web push TTL 60, Topic call-<callId> (RFC 8030 ≤ 32 ký tự base64url), thân có kind=call + exp + bản 'nhỡ' khi tới muộn",
    w.TTL === 60 && w.topic === "call-abc123xyz" && w.urgency === "high" && wb.kind === "call" && wb.exp === NOW + 60_000 && wb.tag === "pn-call-abc123xyz" &&
      wb.stale?.title === "Cuộc gọi video nhỡ từ Lan Nguyen" && inc.en?.stale?.title === "Missed video call from Lan Nguyen", { w, wb });
  const missed = callEndPush({ callId: "abc123xyz", callType: "audio", callerId: "u_caller", callerName: "Lan", outcome: "missed" });
  const mm = buildFcmMessage({ token: "tokC", build: 3 }, missed) as unknown as AnyMsg;
  ok("F32", "Cuộc gọi nhỡ → CÙNG tag + collapse_key (thay thông báo 'đang gọi'), kênh general (không đổ chuông lại), giữ 24 h, mở lại đúng cuộc trò chuyện",
    mm.android.notification?.tag === "pn-call-abc123xyz" && mm.android.collapse_key === "call-abc123xyz" && mm.android.notification?.channel_id === "general" && mm.android.ttl === "86400s" &&
      mm.notification?.title === "Cuộc gọi nhỡ từ Lan" && missed.en?.title === "Missed call from Lan" && missed.en?.body === "Tap to call back." && mm.data.url === "/messages?to=u_caller", mm);
  const ans = callEndPush({ callId: "abc123xyz", callType: "audio", callerId: "u_caller", callerName: "Lan", outcome: "answered" });
  const dec = callEndPush({ callId: "abc123xyz", callType: "audio", callerId: "u_caller", callerName: "Lan", outcome: "declined" });
  const ansWeb = JSON.parse(webPushBody(ans));
  // Device-neutral text: the device that acted can still get it (web tab, app without a saved token) — "on another
  // device" would then be false.
  ok("F33", "Đã trả lời / từ chối → cùng tag, lặng lẽ (quiet), TTL 1 h; chữ không nói 'máy khác' (EN + VI)",
    ans.tag === "pn-call-abc123xyz" && ansWeb.kind === "call-end" && ansWeb.quiet === true && webPushOptions(ans).TTL === 3600 && webPushOptions(missed).TTL === 86400 &&
      ans.en?.title === "Call with Lan" && ans.en?.body === "Answered." && ans.title === "Cuộc gọi với Lan" && ans.body === "Đã trả lời." &&
      dec.en?.title === "Call from Lan" && dec.en?.body === "Declined." && dec.title === "Cuộc gọi từ Lan" && dec.body === "Đã từ chối." &&
      !/another device|thiết bị khác/.test(JSON.stringify([ans, dec])), { ans, dec });
  const F = (a: string, r: string | null, caller: boolean) => JSON.stringify(followUpFor(a, r, caller));
  ok("F34", "Ai nhận tin kết thúc: người gọi huỷ / hết giờ → người nhận 'nhỡ'; người nhận nghe / từ chối → các máy khác của họ; bận / lỗi micro → 'nhỡ'; cúp máy khi đang nói → không gì",
    F("reject", "cancel", true) === '{"outcome":"missed","to":"target"}' && F("reject", "timeout", true) === '{"outcome":"missed","to":"target"}' &&
      F("reject", "hangup", true) === "null" && F("reject", "answered-elsewhere", true) === "null" && F("accept", null, false) === '{"outcome":"answered","to":"self"}' &&
      F("reject", "decline", false) === '{"outcome":"declined","to":"self"}' && F("busy", "busy", false) === '{"outcome":"missed","to":"self"}' &&
      F("reject", "media-error", false) === '{"outcome":"missed","to":"self"}' && F("reject", "hangup", false) === "null" && F("reject", "failed", false) === "null");
  // F36 — one follow-up per (call, recipient, outcome), only inside the call's window (a caller with a valid 3 h token
  //       cannot re-send "Missed call" pushes by POSTing reject/cancel again and again)
  {
    let t = NOW;
    const gate = createFollowUpGate({ now: () => t });
    const issuedAt = NOW - 5_000;
    const k = { callId: "abc123xyz", to: "target" as const, outcome: "missed" as const, issuedAt };
    const first = gate(k);
    const second = gate(k); // the same cancel again
    t += 10_000;
    const third = gate({ ...k }); // and again, 10 s later
    const otherOutcome = gate({ ...k, to: "self", outcome: "answered" }); // a different follow-up of the same call
    const otherCall = gate({ ...k, callId: "zzz999" });
    t = issuedAt + FOLLOW_UP_WINDOW_MS + 1;
    const late = gate({ ...k, callId: "late01" }); // first follow-up of a call, but after its window
    const lateGate = createFollowUpGate({ now: () => NOW + 3 * 3600_000 });
    const veryLate = lateGate({ ...k, callId: "tok3h", issuedAt: NOW }); // token still valid (3 h), call long over
    ok("F36", "Tin kết thúc: đúng 1 lần cho mỗi (cuộc gọi, người nhận, kết quả); huỷ lần 2, lần 3 → không gửi; sau cửa sổ 120 s → không gửi",
      first && !second && !third && otherOutcome && otherCall && !late && !veryLate && FOLLOW_UP_WINDOW_MS === 120_000,
      { first, second, third, otherOutcome, otherCall, late, veryLate });
    // many calls: memory stays bounded (old keys expire)
    let t2 = NOW;
    const g2 = createFollowUpGate({ now: () => t2 });
    let okAll = true;
    for (let i = 0; i < 20_000; i++) {
      t2 += 50;
      okAll = g2({ callId: "c" + i, to: "target", outcome: "missed", issuedAt: t2 }) && okAll;
    }
    ok("F37", "Nhiều cuộc gọi liên tục → cuộc nào cũng gửi được tin kết thúc của nó (bộ nhớ chặn trên, không chặn nhầm)", okAll);
  }
  // F38 — the device that answered / declined is left out of its own "Answered." / "Declined." follow-up
  ok("F38", "Token đẩy của chính máy vừa nghe / từ chối → loại 'fcm:<token>' + 'apns:<token>'; giá trị lạ / quá dài → không loại gì",
    JSON.stringify(ownDeviceEndpoints("tok:ABC_123-x")) === '["fcm:tok:ABC_123-x","apns:tok:ABC_123-x"]' && ownDeviceEndpoints(undefined).length === 0 &&
      ownDeviceEndpoints("").length === 0 && ownDeviceEndpoints("a b").length === 0 && ownDeviceEndpoints("x".repeat(4097)).length === 0 && ownDeviceEndpoints(42).length === 0);

  // other notifications keep their old shape (no TTL → FCM default, web 24 h, no topic)
  const other = buildFcmMessage({ token: "t", build: 3 }, { title: "x", body: "y", url: "/", tag: "pn-like" }) as unknown as AnyMsg;
  ok("F35", "Thông báo khác giữ nguyên: không android.ttl / collapse_key / apns headers; web push TTL 24 h, không Topic",
    !("ttl" in other.android) && !("collapse_key" in other.android) && !other.apns.headers && webPushOptions({}).TTL === 86400 && !("topic" in webPushOptions({})) &&
      !("topic" in webPushOptions({ collapseKey: "has space" })), other);
}

console.log(`\nfcm payload unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
