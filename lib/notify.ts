import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { sendPush } from "@/lib/push";

// Báo realtime cho chuông 🔔 của người nhận (kênh riêng private-chat-<id>).
// Chỉ là tín hiệu "có thông báo mới" — nội dung đầy đủ client tự tải lại từ
// /api/notifications, nên payload gọn và không lộ dữ liệu thừa. Lỗi Pusher
// không được làm hỏng thao tác chính (thích/bình luận...) nên nuốt lỗi.
export async function notifyUser(userId: string | null | undefined, actorId: string, text: string, url = "/", textEn?: string) {
  if (!userId || userId === actorId) return;
  try {
    await getPusherServer()?.trigger(chatChannelName(userId), "notification", { text: text.slice(0, 120), textEn: (textEn ?? text).slice(0, 120) });
  } catch (err) {
    console.error("notifyUser error:", err);
  }
  // Thông báo đẩy: tới được cả khi người nhận đã đóng app. Service worker tự
  // bỏ qua nếu họ đang mở app (đã có chuông + âm thanh trong app).
  await sendPush(userId, { title: "PawNail", body: text, url, tag: "pn-notify" });
}
