// Mẹo cho KHÁCH đi làm nail (không phải kiến thức nghề cho thợ) — mỗi ngày 1 mẹo, xoay vòng theo ngày.
// Nội dung chung, an toàn; KHÔNG khuyên y tế cụ thể (móng/da có vấn đề → khuyên gặp bác sĩ da liễu).
export interface ClientTip { vi: string; en: string }

export const CLIENT_TIPS: ClientTip[] = [
  { vi: "Móng gel bền nhất khi bạn tránh ngâm tay nước nóng lâu trong 24 giờ đầu sau khi làm.", en: "Gel lasts longest if you avoid long hot-water soaks for the first 24 hours." },
  { vi: "Thoa dầu dưỡng viền móng (cuticle oil) mỗi tối — móng ít xước, màu sơn bóng lâu hơn.", en: "Use cuticle oil every night — fewer hangnails and your colour stays glossy longer." },
  { vi: "Đeo găng khi rửa chén, lau nhà: hoá chất tẩy rửa làm sơn nhanh bong và móng khô.", en: "Wear gloves for dishes and cleaning — detergents lift polish and dry out nails." },
  { vi: "Đừng tự cạy gel hay bột: lớp móng thật bị bóc theo, móng yếu nhiều tuần. Nhờ tiệm tháo đúng cách.", en: "Never peel off gel or acrylic — it strips your natural nail. Have the salon remove it." },
  { vi: "Làm lại sau 2–3 tuần (gel) hoặc 2–3 tuần (fill bột) giữ móng đẹp và tránh gãy ở phần móng mọc dài.", en: "Refill gel or acrylic every 2–3 weeks to stay neat and avoid breaks as nails grow out." },
  { vi: "Gửi ảnh mẫu khi nhắn tiệm — thợ báo giá đúng ngay, không bị phát sinh khi ngồi vào ghế.", en: "Send a photo of the look when you message — you get an exact quote, no surprises at the chair." },
  { vi: "Móng ngắn, dáng tròn hoặc oval hợp người hay gõ phím, làm bếp — ít gãy, vẫn sang.", en: "Short round or oval nails suit typing and cooking — fewer breaks, still elegant." },
  { vi: "Da tay thâm hay đỏ? Tông nude hồng, đỏ rượu vang, nâu sô-cô-la thường làm tay sáng hơn.", en: "Warm or reddish skin? Pink nudes, wine reds and chocolate browns usually brighten hands." },
  { vi: "Móng có dấu hiệu đau, sưng, đổi màu bất thường → dừng làm móng và hỏi bác sĩ da liễu.", en: "Pain, swelling or unusual discolouration? Pause manicures and see a dermatologist." },
  { vi: "Hỏi tiệm có tiệt trùng dụng cụ (máy hấp / túi niêm phong) không — tiệm uy tín luôn sẵn lòng cho xem.", en: "Ask how tools are sterilised (autoclave / sealed pouches) — good salons are happy to show you." },
  { vi: "Đặt lịch giữa tuần (thứ 3–thứ 5) thường ít chờ hơn cuối tuần, thợ cũng có thời gian làm kỹ hơn.", en: "Mid-week appointments (Tue–Thu) usually mean less waiting and more unhurried work." },
  { vi: "Đi biển, hồ bơi? Phủ thêm lớp top coat trước chuyến đi — clo và nước muối làm sơn xỉn màu.", en: "Beach or pool trip? Add a fresh top coat first — chlorine and salt water dull colour." },
  { vi: "Thích mẫu nào cứ bấm Lưu — lần sau mở PawNail đưa thợ xem ngay, khỏi lục lại ảnh.", en: "Save the looks you like — show your tech straight from PawNail next time." },
  { vi: "Hài lòng thì để lại đánh giá cho thợ — đánh giá thật giúp thợ giỏi được nhiều khách biết tới.", en: "Happy with your set? Leave a review — real reviews help great techs get found." },
];

export function clientTipOfDay(d = new Date()): ClientTip {
  const day = Math.floor(d.getTime() / 86_400_000);
  return CLIENT_TIPS[day % CLIENT_TIPS.length];
}
