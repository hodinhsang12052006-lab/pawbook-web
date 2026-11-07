import crypto from "crypto";

// Thông báo đẩy cho APP NATIVE (Android/iOS qua Firebase Cloud Messaging HTTP v1).
// Web push (trình duyệt/PWA) vẫn đi đường VAPID trong lib/push.ts.
// Bật bằng FIREBASE_SERVICE_ACCOUNT = nội dung file JSON service account
// (Firebase Console → Project settings → Service accounts → Generate key).
// Kiểm thử local: FCM_ALLOW_TEST=1 + FCM_TEST_BASE=http://127.0.0.1:PORT
// (máy chủ giả đóng vai cả oauth2.googleapis.com lẫn fcm.googleapis.com).
//
// HAI DẠNG TIN (xem buildFcmMessage):
//  - Tin nhắn chat tới app Android ĐỦ MỚI (build ≥ richChatMinBuild()) → tin DATA-ONLY, ưu tiên cao: app tự vẽ
//    thông báo kiểu Messenger (MessagingStyle, trả lời nhanh, bong bóng chat) bằng service riêng
//    (android/.../PawNailMessagingService). FCM không tự hiện gì cho tin data-only.
//  - Mọi thứ khác (bản app cũ / chưa rõ build, thông báo không phải chat) → tin "notification" như trước, kèm
//    android.notification.channel_id ("general" hoặc "calls"); app cũ chưa có kênh đó thì FCM tự rơi về kênh mặc định.
//    Bản app cũ KHÔNG BAO GIỜ được nhận data-only: plugin gốc không hiện gì cho loại tin này.

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

let sa: ServiceAccount | null | undefined;
function account(): ServiceAccount | null {
  if (sa !== undefined) return sa;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const parsed = raw ? (JSON.parse(raw) as ServiceAccount) : null;
    sa = parsed?.project_id && parsed.client_email && parsed.private_key ? { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") } : null;
  } catch (err) {
    console.error("FIREBASE_SERVICE_ACCOUNT không đọc được:", err);
    sa = null;
  }
  return sa;
}

const testBase = () => (process.env.FCM_ALLOW_TEST === "1" && process.env.FCM_TEST_BASE ? process.env.FCM_TEST_BASE.replace(/\/$/, "") : null);
const tokenUrl = () => (testBase() ? `${testBase()}/token` : "https://oauth2.googleapis.com/token");
const sendUrl = (project: string) => `${testBase() ?? "https://fcm.googleapis.com"}/v1/projects/${project}/messages:send`;

export const fcmEnabled = () => account() !== null;

// Access token Google (hạn 1 giờ) — ký JWT RS256 bằng khoá service account.
let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string | null> {
  const a = account();
  if (!a) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), a.private_key).toString("base64url");
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(10_000),
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !d.access_token) {
    console.error("FCM token error:", res.status);
    return null;
  }
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return cached.token;
}

// ---------------------------------------------------------------------------
// Bản build của app native (lưu trong PushSubscription.p256dh = "native:<build>" — app/api/push/native)
// ---------------------------------------------------------------------------

export const MAX_NATIVE_BUILD = 100_000;

/** Số build hợp lệ (số nguyên 0..100000) hoặc null. */
export function validNativeBuild(v: unknown): number | null {
  const n = typeof v === "string" && /^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_NATIVE_BUILD ? n : null;
}

/** Giá trị cột p256dh cho thiết bị native: "native:<build>", hoặc "native" khi chưa biết build. */
export const nativeP256dh = (build: number | null) => (build === null ? "native" : `native:${build}`);

/** "native:3" → 3 · "native" (bản ghi cũ) / chuỗi lạ → null (= chưa biết build → dạng tin cũ, an toàn). */
export function parseNativeBuild(p256dh: string | null | undefined): number | null {
  const m = /^native:(\d{1,6})$/.exec(p256dh || "");
  return m ? validNativeBuild(Number(m[1])) : null;
}

/** Bản app Android đầu tiên có service tự vẽ thông báo chat (versionCode 3). Đổi được qua NATIVE_RICH_CHAT_MIN_BUILD. */
export const RICH_CHAT_MIN_BUILD = 3;
export function richChatMinBuild(): number {
  const n = Number(process.env.NATIVE_RICH_CHAT_MIN_BUILD);
  return Number.isInteger(n) && n > 0 ? n : RICH_CHAT_MIN_BUILD;
}

// ---------------------------------------------------------------------------
// Cắt chuỗi an toàn: không bao giờ cắt đôi cặp surrogate (emoji) — có Intl.Segmenter thì giữ nguyên cả cụm
// grapheme (cờ, emoji ghép ZWJ 👩‍👩‍👧, chữ có dấu tổ hợp).
// ---------------------------------------------------------------------------
const segmenter: Intl.Segmenter | null = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Tối đa `max` đơn vị UTF-16; bị cắt thì thêm "…" (vẫn nằm trong `max`). */
export function clipText(input: string | null | undefined, max: number, ellipsis = "…"): string {
  const s = String(input ?? "");
  if (s.length <= max) return s;
  const room = Math.max(0, max - ellipsis.length);
  let out = "";
  if (segmenter) {
    for (const { segment } of segmenter.segment(s)) {
      if (out.length + segment.length > room) break;
      out += segment;
    }
  } else {
    let cut = room;
    const code = s.charCodeAt(cut - 1);
    if (cut > 0 && code >= 0xd800 && code <= 0xdbff) cut--; // không để lại nửa cặp surrogate
    out = s.slice(0, cut);
  }
  return out.replace(/\s+$/, "") + ellipsis;
}

// ---------------------------------------------------------------------------
// Dạng tin
// ---------------------------------------------------------------------------

/** Thông tin tin nhắn chat — chỉ app Android đủ mới dùng (lib/push.ts PushPayload.chat). */
export interface FcmChat {
  cid: string; // conversationId
  mid: string; // messageId
  senderId: string;
  senderName: string;
  avatar: string; // URL https tuyệt đối đã lọc an toàn, hoặc ""
  group: boolean;
  title: string; // tên nhóm (nhóm) hoặc tên người gửi (1-1)
  ts: number; // epoch ms
}

export type FcmChannel = "general" | "calls";

export interface FcmPayload {
  title: string;
  body: string; // đã theo ngôn ngữ người nhận — với chat đây chính là "text"
  url: string;
  tag?: string;
  /** Kênh thông báo Android cho dạng tin "notification" (mặc định "general"; tag pn-call → "calls"). */
  channel?: FcmChannel;
  chat?: FcmChat;
}

/** Một thiết bị Android: token FCM + build app (null = chưa biết). */
export interface FcmTarget { token: string; build: number | null }

export const CHAT_TEXT_MAX = 300;
/** Ngân sách byte cho phần data (FCM giới hạn 4096 byte) — chừa chỗ cho token và phần bao. */
export const CHAT_DATA_BUDGET = 3400;

const channelFor = (p: FcmPayload): FcmChannel => p.channel ?? (p.tag === "pn-call" || p.tag?.startsWith("pn-call-") ? "calls" : "general");

/** Đường dẫn trong app: phải bắt đầu bằng 1 dấu "/" (không "//", không scheme) — app Android chỉ mở đúng dạng này. */
export const safeAppPath = (u: string) => (typeof u === "string" && u.startsWith("/") && !u.startsWith("//") && !/[\s\\]/.test(u) ? u : "/messages");

const dataBytes = (d: Record<string, string>) => Buffer.byteLength(JSON.stringify(d), "utf8");

/** Phần `data` của tin chat data-only — mọi giá trị là chuỗi, tổng < CHAT_DATA_BUDGET byte. */
export function chatData(p: FcmPayload & { chat: FcmChat }): Record<string, string> {
  const c = p.chat;
  const d: Record<string, string> = {
    type: "chat",
    v: "1",
    cid: String(c.cid),
    mid: String(c.mid),
    title: clipText(c.title || c.senderName, 80),
    sender: clipText(c.senderName, 80),
    senderId: String(c.senderId),
    avatar: c.avatar && c.avatar.length <= 1024 && /^https:\/\//.test(c.avatar) ? c.avatar : "",
    group: c.group ? "1" : "0",
    text: clipText(p.body, CHAT_TEXT_MAX),
    ts: String(Math.trunc(Number(c.ts) || Date.now())),
    url: safeAppPath(p.url),
    tag: p.tag || `pn-chat-${c.cid}`,
  };
  // Văn bản nhiều byte (emoji, chữ CJK) → thu ngắn dần cho tới khi vừa ngân sách; cuối cùng bỏ ảnh đại diện.
  for (let max = CHAT_TEXT_MAX - 60; dataBytes(d) > CHAT_DATA_BUDGET && max >= 40; max -= 60) d.text = clipText(p.body, max);
  if (dataBytes(d) > CHAT_DATA_BUDGET) d.avatar = "";
  return d;
}

/** Thân `message` gửi lên FCM HTTP v1 cho 1 thiết bị (hàm thuần — scripts/qa/fcm_payload_unit.mts). */
export function buildFcmMessage(target: FcmTarget, p: FcmPayload): Record<string, unknown> {
  if (p.chat && target.build !== null && target.build >= richChatMinBuild()) {
    // Data-only + ưu tiên cao: tới được cả khi app đã tắt; app tự vẽ (MessagingStyle / bong bóng / trả lời nhanh).
    // KHÔNG đặt collapse_key: mỗi tin là 1 dòng trong khung chat của thông báo, không đè nhau.
    return { token: target.token, data: chatData(p as FcmPayload & { chat: FcmChat }), android: { priority: "high", ttl: "86400s" } };
  }
  return {
    token: target.token,
    notification: { title: clipText(p.title, 80), body: clipText(p.body, 180) },
    data: { url: safeAppPath(p.url), tag: p.tag ?? "" },
    android: { priority: "high", notification: { ...(p.tag ? { tag: p.tag } : {}), sound: "default", channel_id: channelFor(p) } },
    apns: { payload: { aps: { sound: "default", "thread-id": p.tag ?? "pawnail" } } },
  };
}

/** Phản hồi lỗi của FCM có nghĩa là token không còn dùng được (app đã gỡ / token rác)? */
export function isDeadTokenError(status: number, body: string): boolean {
  if (status === 404 || /UNREGISTERED|registration-token-not-registered/.test(body)) return true;
  return /INVALID_ARGUMENT/.test(body) && /registration token|message\.token/i.test(body);
}

/** Gửi tới các thiết bị Android. Trả về danh sách token đã hết hạn (để dọn khỏi DB). */
export async function sendFcm(targets: (FcmTarget | string)[], p: FcmPayload): Promise<{ sent: number; dead: string[] }> {
  const a = account();
  if (!a || !targets.length) return { sent: 0, dead: [] };
  const token = await accessToken();
  if (!token) return { sent: 0, dead: [] };
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    targets.map(async (raw) => {
      const target: FcmTarget = typeof raw === "string" ? { token: raw, build: null } : raw;
      try {
        const res = await fetch(sendUrl(a.project_id), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: buildFcmMessage(target, p) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) sent++;
        else {
          const body = await res.text().catch(() => "");
          // Token hết hạn / app đã gỡ → dọn khỏi DB. INVALID_ARGUMENT chỉ tính là token chết khi lỗi nói về
          // chính token — lỗi do THÂN TIN (vd sai trường) không được xoá oan mọi thiết bị.
          if (isDeadTokenError(res.status, body)) dead.push(target.token);
          else console.error("FCM send error:", res.status, body.slice(0, 200));
        }
      } catch (err) {
        console.error("FCM send error:", (err as Error).message);
      }
    })
  );
  return { sent, dead };
}
