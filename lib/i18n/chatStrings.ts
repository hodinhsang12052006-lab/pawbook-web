import { tr } from "@/lib/i18n/tr";

// Chuỗi MỚI của Messenger V2 (06/11/2026) — tách file riêng để không đụng chuỗi cũ mà nhánh viết lại chữ đang sửa.
// Dùng dạng hàm để đổi theo VI/EN lúc render.
export const CS = {
  unread: () => tr("Tin chưa đọc", "Unread messages"),
  connecting: () => tr("Đang kết nối…", "Connecting…"),
  sending: () => tr("Đang gửi", "Sending"),
  notSent: () => tr("Chưa gửi được", "Not sent"),
  seen: () => tr("Đã xem", "Seen"),
  sent: () => tr("Đã gửi", "Sent"),
  you: () => tr("Bạn", "You"),
  jumpToLatest: () => tr("Xuống tin mới nhất", "Jump to latest"),
  attach: () => tr("Đính kèm ảnh, GIF, ghi âm", "Attach photo, GIF, voice"),
  record: () => tr("Ghi âm tin nhắn thoại", "Record a voice message"),
  openImage: () => tr("Mở ảnh toàn màn hình", "Open image full screen"),
  joined: (when: string) => tr(`Tham gia ${when}`, `Joined ${when}`),
  safetyTitle: () => tr("Nhắn tin an toàn", "Message safely"),
  safetyBody: () =>
    tr(
      "Đừng chuyển tiền cọc trước khi gặp mặt. Giữ mọi thoả thuận (lương, giờ, chỗ ở) ngay trong chat để có bằng chứng.",
      "Never send a deposit before meeting in person. Keep every agreement (pay, hours, housing) in this chat as a record."
    ),
  report: () => tr("Báo cáo", "Report"),
  dismiss: () => tr("Đóng", "Dismiss"),
  stickerCredit: () => tr("Emoji động: Noto Emoji Animation (Google) · CC BY 4.0", "Animated emoji: Noto Emoji Animation (Google) · CC BY 4.0"),
};
