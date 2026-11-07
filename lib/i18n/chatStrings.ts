import { tr } from "@/lib/i18n/tr";

// Chuỗi MỚI của Messenger V2 (06/11/2026) — tách file riêng để không đụng chuỗi cũ mà nhánh viết lại chữ đang sửa.
// Dùng dạng hàm để đổi theo VI/EN lúc render. Mỗi chuỗi là 1 hằng hàm riêng (scripts/i18n/check-eager.mjs
// nhận ra là lười, không gọi tr() lúc nạp module), rồi gom vào CS.
const unread = () => tr("Tin chưa đọc", "Unread messages");
const connecting = () => tr("Đang kết nối…", "Connecting…");
const sending = () => tr("Đang gửi", "Sending");
const notSent = () => tr("Chưa gửi được", "Not sent");
const seen = () => tr("Đã xem", "Seen");
const sent = () => tr("Đã gửi", "Sent");
const you = () => tr("Bạn", "You");
const jumpToLatest = () => tr("Xuống tin mới nhất", "Jump to latest");
const attach = () => tr("Đính kèm ảnh, GIF, ghi âm", "Attach photo, GIF, voice");
const record = () => tr("Ghi âm tin nhắn thoại", "Record a voice message");
const openImage = () => tr("Mở ảnh toàn màn hình", "Open image full screen");
const joined = (when: string) => tr(`Tham gia ${when}`, `Joined ${when}`);
const safetyTitle = () => tr("Nhắn tin an toàn", "Message safely");
const safetyBody = () =>
  tr(
    "Đừng chuyển tiền cọc trước khi gặp mặt. Giữ mọi thoả thuận (lương, giờ, chỗ ở) ngay trong chat để có bằng chứng.",
    "Never send a deposit before meeting in person. Keep every agreement (pay, hours, housing) in this chat as a record."
  );
const report = () => tr("Báo cáo", "Report");
const dismiss = () => tr("Đóng", "Dismiss");
const stickerCredit = () =>
  tr(
    "Emoji động: Noto Emoji Animation (Google) · CC BY 4.0 · Emoji 3D: Microsoft Fluent Emoji · MIT",
    "Animated emoji: Noto Emoji Animation (Google) · CC BY 4.0 · 3D emoji: Microsoft Fluent Emoji · MIT"
  );

export const CS = {
  unread,
  connecting,
  sending,
  notSent,
  seen,
  sent,
  you,
  jumpToLatest,
  attach,
  record,
  openImage,
  joined,
  safetyTitle,
  safetyBody,
  report,
  dismiss,
  stickerCredit,
};
