// "Mẹo hôm nay" — mỗi ngày đổi 1 mẹo theo vai trò, cho người dùng lý do nhỏ
// để mở app mỗi ngày (và nội dung hữu ích thật, không chỉ là danh sách tin).
export interface DailyTip {
  title: string;
  body: string;
}

const TECH_TIPS: DailyTip[] = [
  { title: "Ảnh portfolio quyết định 80%", body: "Chụp móng dưới ánh sáng tự nhiên, nền trơn, cận cảnh 1 bàn tay. Chủ tiệm lướt rất nhanh — ảnh rõ nét được bấm xem gấp nhiều lần." },
  { title: "Hỏi rõ cách chia turn", body: "Trước khi nhận việc, hỏi tiệm chia turn theo thứ tự hay theo khách quen, tip trả tiền mặt hay qua thẻ, và trừ phí thẻ bao nhiêu %." },
  { title: "Ghi thu nhập mỗi tối", body: "Dùng Bảng tính thu nhập để ghi turn + tip ngay sau ca. Cuối tuần đối chiếu phiếu lương sẽ biết ngay có bị tính thiếu không." },
  { title: "Bật trạng thái \"Tìm việc gấp\"", body: "Hồ sơ ở trạng thái gấp được ưu tiên hiển thị cho chủ tiệm đang thiếu thợ trong khu vực của bạn." },
  { title: "Xem Nail Radar trước khi dời bang", body: "So mức bao lương và tỉ lệ chia giữa các bang để thương lượng có cơ sở, tránh nhận mức thấp hơn mặt bằng." },
  { title: "Trả lời tin nhắn trong 1 giờ", body: "Tiệm cần thợ gấp thường chốt người trả lời sớm nhất. Bật thông báo để không lỡ tin." },
  { title: "Giữ an toàn khi đi làm xa", body: "Hỏi kỹ chỗ ở, xe đưa đón và thoả thuận lương bằng tin nhắn trong app để có bằng chứng khi cần." },
];

const OWNER_TIPS: DailyTip[] = [
  { title: "Tin có mức lương rõ được gọi nhiều hơn", body: "Ghi cụ thể \"$1,200–1,500/tuần\" hoặc \"60/40\" thay vì \"thoả thuận\" — thợ ưu tiên gọi tin minh bạch trước." },
  { title: "Nêu rõ quyền lợi", body: "Chỗ ở, xe đưa đón, hỗ trợ đổi bang là lý do lớn để thợ chọn tiệm của bạn thay vì tiệm bên cạnh." },
  { title: "Đăng ảnh tiệm thật", body: "Bài \"Khoe tay nghề / tiệm\" với ảnh không gian tiệm sạch đẹp giúp thợ tin tưởng trước khi gọi." },
  { title: "Phản hồi trong ngày", body: "Thợ giỏi thường nhận nhiều lời mời cùng lúc. Nhắn lại trong vài giờ đầu giúp bạn giữ được người." },
  { title: "Tham khảo Nail Radar", body: "Đặt mức lương sát mặt bằng bang của bạn để tin không bị lướt qua." },
  { title: "Cập nhật chính sách tiệm", body: "Chính sách chia turn và loại khách hiển thị trên hồ sơ — thợ hợp ý sẽ tự tìm đến." },
  { title: "Đánh giá thợ sau khi làm việc", body: "Đánh giá công bằng giúp cộng đồng minh bạch và tăng uy tín cho chính tiệm của bạn." },
];

export function getDailyTip(role?: string, date = new Date()): DailyTip {
  const list = role === "OWNER" ? OWNER_TIPS : TECH_TIPS;
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return list[dayIndex % list.length];
}
