import webpush from "web-push";
import prisma from "@/lib/prisma";
import { clipText, fcmEnabled, parseNativeBuild, sendFcm, type FcmChannel, type FcmChat } from "@/lib/fcm";
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
  en?: { title?: string; body?: string };
  /** Kênh thông báo Android cho dạng tin thường ("general" mặc định; cuộc gọi: "calls"). */
  channel?: FcmChannel;
  /**
   * Tin nhắn chat: app Android đủ mới (lib/fcm.ts richChatMinBuild) nhận tin data-only và tự vẽ thông báo kiểu
   * Messenger. Nội dung ("text") lấy từ body đã theo ngôn ngữ người nhận. Web push / iPhone bỏ qua trường này.
   */
  chat?: FcmChat;
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

/** Gửi tới mọi thiết bị của 1 hoặc nhiều người. Không bao giờ ném lỗi. */
export async function sendPush(userIds: string | string[], payload: PushPayload): Promise<number> {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  const web = ready();
  const android = fcmEnabled();
  const ios = apnsEnabled();
  if ((!web && !android && !ios) || ids.length === 0) return 0;
  try {
    const subsAll = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } }, take: 2000 });
    if (!subsAll.length) return 0;
    // Mỗi người nhận đọc thông báo bằng ngôn ngữ của họ: chia thiết bị theo ngôn ngữ đã lưu.
    const { en, ...vi } = payload;
    if (!en) return await sendToSubs(subsAll, vi, web, android, ios);
    const locales = await getUserLocales([...new Set(subsAll.map((s) => s.userId))]);
    const enPayload: PushPayload = { ...vi, title: en.title ?? vi.title, body: en.body ?? vi.body };
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

type Sub = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };

/** Web push giữ nguyên dạng cũ (worker/index.js chỉ đọc title/body/url/tag/icon) — bỏ phần chỉ dành cho app native. */
export function webPushBody(p: Omit<PushPayload, "en">): string {
  return JSON.stringify({ icon: p.icon || "/icons/icon-192.webp", title: clipText(p.title, 80), body: clipText(p.body, 180), url: p.url, tag: p.tag });
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
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: "high" });
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
