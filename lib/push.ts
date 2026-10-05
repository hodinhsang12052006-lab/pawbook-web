import webpush from "web-push";
import prisma from "@/lib/prisma";
import { fcmEnabled, sendFcm } from "@/lib/fcm";
import { apnsEnabled, sendApns } from "@/lib/apns";

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
}

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@bitpawos.com", pub, priv);
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
    const all = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } }, take: 2000 });
    // App native lưu endpoint "fcm:<token>" (Android) / "apns:<token>" (iPhone) — xem app/api/push/native.
    const isNative = (e: string) => e.startsWith("fcm:") || e.startsWith("apns:");
    const fcmSubs = all.filter((s) => s.endpoint.startsWith("fcm:"));
    const apnsSubs = all.filter((s) => s.endpoint.startsWith("apns:"));
    const subs = web ? all.filter((s) => !isNative(s.endpoint)) : [];
    const body = JSON.stringify({ icon: "/icons/icon-192.webp", ...payload, title: payload.title.slice(0, 80), body: payload.body.slice(0, 180) });
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
    for (const [on, list, prefix, send] of [
      [android, fcmSubs, "fcm:", sendFcm],
      [ios, apnsSubs, "apns:", sendApns],
    ] as const) {
      if (!on || !list.length) continue;
      const r = await send(list.map((s) => s.endpoint.slice(prefix.length)), payload);
      sent += r.sent;
      for (const t of r.dead) {
        const s = list.find((x) => x.endpoint === prefix + t);
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
