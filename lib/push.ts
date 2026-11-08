import webpush from "web-push";
import prisma from "@/lib/prisma";
import { clipText, fcmEnabled, parseNativeBuild, richChatMinBuild, sendFcm, sendFcmRead, type FcmChannel, type FcmChat } from "@/lib/fcm";
import { apnsEnabled, sendApns } from "@/lib/apns";
import { getUserLocales } from "@/lib/userLocale";

// Thông báo đẩy (Web Push chuẩn VAPID) — tới được người dùng KỂ CẢ khi đã
// đóng tab/app: Chrome/Edge máy tính, Android, iPhone (iOS 16.4+, khi đã
// "Thêm vào màn hình chính"). Không cần Firebase.
// Chưa cấu hình khoá (VAPID_*) hoặc chưa tạo bảng PushSubscription → mọi hàm
// ở đây tự bỏ qua, không làm hỏng luồng chính (thích, nhắn tin, đăng tin…).

export interface PushPayload {
  title: string;
  body: string;
  url: string; // mở trang này khi bấm vào thông báo
  tag?: string; // cùng tag → thay thế thông báo cũ thay vì chồng thêm
  icon?: string;
  /** Bản tiếng Anh — người nhận dùng EN (mặc định) thấy bản này; người dùng VI thấy title/body. */
  en?: { title?: string; body?: string; stale?: { title: string; body: string } };
  /** Kênh thông báo Android cho dạng tin thường ("general" mặc định; cuộc gọi: "calls"). */
  channel?: FcmChannel;
  /**
   * Tin nhắn chat: app Android đủ mới (lib/fcm.ts richChatMinBuild) nhận tin data-only và tự vẽ thông báo kiểu
   * Messenger. Nội dung ("text") lấy từ body đã theo ngôn ngữ người nhận. Web push / iPhone bỏ qua trường này.
   */
  chat?: FcmChat;
  /**
   * Bao lâu dịch vụ đẩy được giữ tin cho máy đang offline (giây). Mặc định 24 h. Cuộc gọi đến: 60 s (lib/calls/callPush.ts)
   * — trước đây FCM giữ tới 28 ngày, web push 24 h → "X đang gọi cho bạn" tới muộn hàng giờ.
   */
  ttlSec?: number;
  /** Mã gộp theo sự kiện (FCM collapse_key · APNs apns-collapse-id · Web Push Topic): tin chưa giao cùng mã bị tin mới thay. */
  collapseKey?: string;
  /** Gợi ý cho service worker: "call" (cuộc gọi đến) / "call-end" (thay / đóng thông báo cuộc gọi đó, không kêu lại). */
  kind?: "call" | "call-end";
  /** Cuộc gọi đến: mốc (epoch ms) sau đó thông báo "đang gọi" đã cũ → service worker hiện bản `stale` thay vào. */
  exp?: number;
  /** Nội dung thay thế khi thông báo cuộc gọi tới muộn (quá exp) — "Cuộc gọi nhỡ từ X". */
  stale?: { title: string; body: string };
  /** call-end "đã trả lời / từ chối ở máy khác": chỉ thay thông báo đang có, không tự hiện nếu đang mở PawNail. */
  quiet?: boolean;
}

/** Web Push "Topic" header: ≤ 32 ký tự base64url (RFC 8030). */
const WEB_PUSH_TOPIC_RE = /^[A-Za-z0-9_-]{1,32}$/;
const DEFAULT_TTL_SEC = 60 * 60 * 24;

/** Tuỳ chọn gửi web push (thuần — scripts/qa/fcm_payload_unit.mts). */
export function webPushOptions(p: Pick<PushPayload, "ttlSec" | "collapseKey">): { TTL: number; urgency: "high"; topic?: string } {
  const ttl = Number.isInteger(p.ttlSec) && (p.ttlSec as number) >= 0 ? (p.ttlSec as number) : DEFAULT_TTL_SEC;
  return { TTL: ttl, urgency: "high", ...(p.collapseKey && WEB_PUSH_TOPIC_RE.test(p.collapseKey) ? { topic: p.collapseKey } : {}) };
}

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@bitpawsoftware.com", pub, priv);
    configured = true;
  } catch (err) {
    console.error("VAPID config error:", err);
    configured = false;
  }
  return configured;
}

export const pushEnabled = () => ready();

function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

/**
 * Gửi tới mọi thiết bị của 1 hoặc nhiều người. Không bao giờ ném lỗi.
 * opts.exceptEndpoints: bỏ qua các thiết bị này (vd. máy vừa tự trả lời / từ chối cuộc gọi — lib/calls/callPush.ts).
 */
export async function sendPush(userIds: string | string[], payload: PushPayload, opts: { exceptEndpoints?: string[] } = {}): Promise<number> {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  const web = ready();
  const android = fcmEnabled();
  const ios = apnsEnabled();
  if ((!web && !android && !ios) || ids.length === 0) return 0;
  try {
    const except = new Set(opts.exceptEndpoints ?? []);
    const subsAll = (await prisma.pushSubscription.findMany({ where: { userId: { in: ids } }, take: 2000 })).filter((s) => !except.has(s.endpoint));
    if (!subsAll.length) return 0;
    // Mỗi người nhận đọc thông báo bằng ngôn ngữ của họ: chia thiết bị theo ngôn ngữ đã lưu.
    const { en, ...vi } = payload;
    if (!en) return await sendToSubs(subsAll, vi, web, android, ios);
    const locales = await getUserLocales([...new Set(subsAll.map((s) => s.userId))]);
    const enPayload: PushPayload = { ...vi, title: en.title ?? vi.title, body: en.body ?? vi.body, stale: en.stale ?? vi.stale };
    const enSubs = subsAll.filter((s) => locales.get(s.userId) !== "vi");
    const viSubs = subsAll.filter((s) => locales.get(s.userId) === "vi");
    let sent = 0;
    if (enSubs.length) sent += await sendToSubs(enSubs, enPayload, web, android, ios);
    if (viSubs.length) sent += await sendToSubs(viSubs, vi, web, android, ios);
    return sent;
  } catch (err) {
    if (!isMissingTable(err)) console.error("sendPush error:", err);
    return 0;
  }
}

/**
 * Người dùng vừa đọc cuộc trò chuyện `cid` (POST /api/messages/seen) → gỡ thông báo của cuộc đó trên các máy Android
 * (app versionCode 3+) của CHÍNH họ. Chỉ gửi khi trước lần đọc này có tin của người khác chưa đọc (tức là có thể đang
 * có thông báo) — xem lại một cuộc trò chuyện đã đọc rồi không tốn lượt đẩy nào. Không bao giờ ném lỗi.
 */
export async function sendChatReadSync(userId: string, cid: string, prevReadAt: Date | null, readAt?: Date | null): Promise<number> {
  if (!fcmEnabled() || !userId || !cid) return 0;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId, endpoint: { startsWith: "fcm:" } }, select: { id: true, endpoint: true, p256dh: true }, take: 20 });
    const min = richChatMinBuild();
    const rich = subs.filter((s) => (parseNativeBuild(s.p256dh) ?? -1) >= min);
    if (!rich.length) return 0;
    const since = prevReadAt ?? new Date(Date.now() - 7 * 86_400_000);
    const unread = await prisma.message.findFirst({ where: { conversationId: cid, senderId: { not: userId }, createdAt: { gt: since } }, select: { id: true } });
    if (!unread) return 0;
    const r = await sendFcmRead(rich.map((s) => s.endpoint.slice(4)), cid, (readAt ?? new Date()).getTime());
    const dead = rich.filter((s) => r.dead.includes(s.endpoint.slice(4))).map((s) => s.id);
    if (dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    return r.sent;
  } catch (err) {
    if (!isMissingTable(err)) console.error("sendChatReadSync error:", err);
    return 0;
  }
}

type Sub = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };

/**
 * Web push giữ nguyên dạng cũ (worker/index.js đọc title/body/url/tag/icon) — bỏ phần chỉ dành cho app native. Thông báo
 * cuộc gọi thêm kind / exp / stale / quiet (service worker cũ bỏ qua các trường lạ).
 */
export function webPushBody(p: Omit<PushPayload, "en">): string {
  const base: Record<string, unknown> = { icon: p.icon || "/icons/icon-192.webp?v=b", title: clipText(p.title, 80), body: clipText(p.body, 180), url: p.url, tag: p.tag };
  if (p.kind) base.kind = p.kind;
  if (typeof p.exp === "number") base.exp = p.exp;
  if (p.stale) base.stale = { title: clipText(p.stale.title, 80), body: clipText(p.stale.body, 180) };
  if (p.quiet) base.quiet = true;
  return JSON.stringify(base);
}

async function sendToSubs(all: Sub[], payload: Omit<PushPayload, "en">, web: boolean, android: boolean, ios: boolean): Promise<number> {
  try {
    // App native lưu endpoint "fcm:<token>" (Android) / "apns:<token>" (iPhone) — xem app/api/push/native.
    const isNative = (e: string) => e.startsWith("fcm:") || e.startsWith("apns:");
    const fcmSubs = all.filter((s) => s.endpoint.startsWith("fcm:"));
    const apnsSubs = all.filter((s) => s.endpoint.startsWith("apns:"));
    const subs = web ? all.filter((s) => !isNative(s.endpoint)) : [];
    const body = webPushBody(payload);
    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, webPushOptions(payload));
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // 404/410: trình duyệt đã huỷ đăng ký → dọn khỏi DB.
          if (code === 404 || code === 410) dead.push(s.id);
          else console.error("push send error:", code, (err as Error).message);
        }
      })
    );
    // Android: kèm build của từng thiết bị (p256dh "native:<build>") — chỉ bản đủ mới nhận tin chat data-only.
    if (android && fcmSubs.length) {
      const r = await sendFcm(fcmSubs.map((s) => ({ token: s.endpoint.slice(4), build: parseNativeBuild(s.p256dh) })), payload);
      sent += r.sent;
      for (const t of r.dead) {
        const s = fcmSubs.find((x) => x.endpoint === "fcm:" + t);
        if (s) dead.push(s.id);
      }
    }
    if (ios && apnsSubs.length) {
      const r = await sendApns(apnsSubs.map((s) => s.endpoint.slice(5)), payload);
      sent += r.sent;
      for (const t of r.dead) {
        const s = apnsSubs.find((x) => x.endpoint === "apns:" + t);
        if (s) dead.push(s.id);
      }
    }
    if (dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    return sent;
  } catch (err) {
    if (!isMissingTable(err)) console.error("sendPush error:", err);
    return 0;
  }
}
