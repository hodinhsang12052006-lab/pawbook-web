// Nguồn dữ liệu dùng chung cho khảo sát 5 câu "chẩn đoán nỗi đau" của Chủ
// tiệm (OwnerRegisterForm) và trang Admin Lead Radar (app/admin/leads).

export interface SurveyQuestion {
  key: string;
  title: string;
  question: string;
  optionA: string;
  optionB: string;
  tag: string;
}

export const SURVEY: SurveyQuestion[] = [
  {
    key: "booking",
    title: "Smart Booking & Khóa lịch tự động",
    question: "Cuối tuần tiệm đông, khách hẹn trước có hay bị trùng giờ, thợ trở tay không kịp làm khách phàn nàn không?",
    optionA: "Có, ghi sổ tay/nhắn tin dễ lộn xộn, khách phải ngồi đợi quạu quọ.",
    optionB: "Tiệm có hệ thống tự khóa lịch khi thợ bận, không bao giờ trùng.",
    tag: "NEED_AUTO_BOOKING",
  },
  {
    key: "turn_tip",
    title: "Xoay tua thợ & POS tính tip minh bạch",
    question: "Thợ trong tiệm có hay tị nạnh nhau từng lượt khách, nhìn ngó ai làm khách sộp rồi cãi vã mất vui không?",
    optionA: "Có, thợ hay soi turn nhau, chia bằng tay rất mệt mỏi và đau đầu.",
    optionB: "Có bảng chia turn tự động trên màn hình, thợ tự xem không ai cãi ai.",
    tag: "NEED_TURN_AND_TIP_POS",
  },
  {
    key: "supply_bill",
    title: "Trừ chi phí supply trên bill & In bill nhiệt",
    question: "Cuối tuần tính lương, bạn có phải ngồi bấm máy tính tới khuya để trừ tiền bột đá, lo thợ thắc mắc không?",
    optionA: "Rất ngán khoản này, bấm máy tính mỏi mắt mà thợ vẫn hay nghi ngờ trừ sai.",
    optionB: "Tiệm in bill nhiệt, tự trừ tiền supply trực tiếp trên từng hóa đơn.",
    tag: "NEED_SUPPLY_BILL_PRINT",
  },
  {
    key: "gps_refund",
    title: "Chấm công GPS & Quản lý hoàn tiền",
    question: "Thợ đi trễ về sớm hoặc khách làm xong vài ngày quay lại đòi trả tiền (refund) tiệm xử lý thế nào?",
    optionA: "Khó kiểm soát giờ giấc thợ; khách đòi tiền thì bấm bụng chịu vì sợ bị 1 sao.",
    optionB: "Thợ chấm công GPS chuẩn giờ; có mã bill rõ ràng để đối chất chống quỵt.",
    tag: "NEED_GPS_REFUND",
  },
  {
    key: "crm_qr",
    title: "QR Check-in, CRM & AI nhắc dặm gel",
    question: "Những ngày đầu tuần (Thứ 2 - Thứ 4) tiệm vắng, bạn làm gì để kéo khách cũ quay lại?",
    optionA: "Thợ ngồi bấm điện thoại chờ khách walk-in, không ai rảnh nhắn tin gọi khách.",
    optionB: "Có hệ thống tự bắn tin nhắn SMS nhắc khách sau 3 tuần đi dặm lại móng.",
    tag: "NEED_AI_CRM_QR",
  },
];

export interface PainTagMeta {
  tag: string;
  label: string;
  shortLabel: string;
  color: "red" | "purple" | "orange" | "yellow" | "blue";
  classes: string; // border+bg+text Tailwind classes cho badge
  // Dùng cho màn hình chẩn đoán sau đăng ký (SalonDiagnosticModal) — phản
  // chiếu đúng nỗi đau họ vừa chọn kèm giải pháp tương ứng.
  problem: string;
  solution: string;
  // "Trojan Horse" — lời mời kích hoạt nhanh 1 tính năng cụ thể ngay dưới
  // giải pháp, thay vì chỉ nói chung chung "có giải pháp cho vấn đề này".
  trojanHorse: string;
  // Dùng trong UnlockChatModal — bước "khảo sát chuyên sâu" bắt buộc trước
  // khi mở khóa nhắn tin/gọi 1 thợ cụ thể, cá nhân hoá theo đúng pain tag
  // chủ tiệm đã chọn lúc đăng ký.
  unlockQuestion: string;
  unlockCheckboxLabel: string;
}

export const PAIN_TAG_META: Record<string, PainTagMeta> = {
  NEED_AUTO_BOOKING: {
    tag: "NEED_AUTO_BOOKING",
    label: "Bị trùng lịch, ghi sổ tay",
    shortLabel: "Auto Booking",
    color: "red",
    classes: "border-red-500/40 bg-red-500/10 text-red-400",
    problem: "Khách đặt hẹn bị chồng chéo giờ cao điểm, thợ bị quá tải hoặc để khách đợi lâu.",
    solution: "Smart Booking Online tự động khóa lịch khi thợ đang có khách, gửi SMS xác nhận lịch hẹn chuẩn giờ.",
    trojanHorse: "Bật Smart Booking khóa lịch tự động cho tiệm ngay hôm nay (không cần cài đặt gì thêm)",
    unlockQuestion: "Tiệm bạn đang gặp vấn đề trùng lịch hẹn giờ cao điểm. Bạn có muốn kích hoạt Smart Booking khóa lịch tự động ngay khi thợ này bắt đầu làm không?",
    unlockCheckboxLabel: "Cần hỗ trợ cài đặt ngay.",
  },
  NEED_TURN_AND_TIP_POS: {
    tag: "NEED_TURN_AND_TIP_POS",
    label: "Thợ cãi nhau vì turn, nhầm tip",
    shortLabel: "Turn & Tip POS",
    color: "purple",
    classes: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    problem: "Nguy cơ mất thợ giỏi và mâu thuẫn nội bộ do chia turn thủ công, tính tip dễ nhầm lẫn.",
    solution: "Hệ thống POS tự động xoay tua thợ công bằng theo giá trị bill. Tách bạch 100% Cash Tip & Credit Tip trên màn hình iPad. Thợ tự xem, không tị nạnh.",
    trojanHorse: "Tặng tiệm 14 ngày dùng thử Bảng Chia Turn Công Bằng trên iPad (cài đặt trong 30 giây)",
    unlockQuestion: "Tiệm bạn đang gặp vấn đề thợ tị nạnh chia turn. Bạn có muốn kích hoạt công cụ Chia Turn Minh Bạch trên iPad khi nhận thợ này không?",
    unlockCheckboxLabel: "Cần hỗ trợ cài đặt ngay.",
  },
  NEED_SUPPLY_BILL_PRINT: {
    tag: "NEED_SUPPLY_BILL_PRINT",
    label: "Trừ supply tay, viết giấy",
    shortLabel: "Supply & Bill",
    color: "orange",
    classes: "border-orange-500/40 bg-orange-500/10 text-orange-400",
    problem: "Thất thoát chi phí vật tư và tốn thời gian bấm máy tính cộng trừ tiền bột/đá cuối tuần.",
    solution: "Tự động khấu trừ chi phí supply trực tiếp trên từng hóa đơn tính tiền. Xuất bill in nhiệt chuyên nghiệp 1-click.",
    trojanHorse: "Bật tính năng Tự động khấu trừ Supply trên Bill tính tiền cho tiệm",
    unlockQuestion: "Tiệm bạn đang mất thời gian trừ supply và in bill. Bạn có muốn tự động khấu trừ vật tư khi thợ này làm móng không?",
    unlockCheckboxLabel: "Cần trải nghiệm giải pháp này.",
  },
  NEED_GPS_REFUND: {
    tag: "NEED_GPS_REFUND",
    label: "Thợ đi trễ về sớm, hoàn tiền rối",
    shortLabel: "GPS & Refund",
    color: "yellow",
    classes: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    problem: "Khó kiểm soát giờ giấc ra vào của thợ, xử lý khách khiếu nại hoàn tiền dễ thất thoát.",
    solution: "Chấm công bằng định vị GPS chuẩn xác ngay tại tiệm. Cơ chế hoàn tiền/hủy đơn chuẩn theo mã hóa đơn.",
    trojanHorse: "Kích hoạt Chấm công GPS & Mã bill chống quỵt cho tiệm ngay",
    unlockQuestion: "Tiệm bạn đang khó kiểm soát giờ giấc & xử lý hoàn tiền. Bạn có muốn bật Chấm công GPS & mã bill chống quỵt cho thợ này không?",
    unlockCheckboxLabel: "Kích hoạt giải pháp này.",
  },
  NEED_AI_CRM_QR: {
    tag: "NEED_AI_CRM_QR",
    label: "Khách vắng, không ai chăm",
    shortLabel: "AI CRM & QR",
    color: "blue",
    classes: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    problem: "Khách làm xong rồi quên quay lại; ngày Thứ 2 - Thứ 4 tiệm vắng thợ ngồi bấm điện thoại.",
    solution: "QR Check-in tích điểm theo SĐT + AI tự động gửi SMS nhắc khách quay lại dặm gel sau 3 tuần.",
    trojanHorse: "Tải mẫu QR Check-in để bàn tiệm & Tự động nhắc khách dặm gel",
    unlockQuestion: "Bạn có muốn hệ thống tự động bắn SMS kéo khách cũ cho thợ này làm vào Thứ 2 - Thứ 4 không?",
    unlockCheckboxLabel: "Kích hoạt giải pháp giữ chân khách.",
  },
};

export interface HiringTimelineOption {
  value: string;
  label: string;
}

// Dùng trong UnlockChatModal — câu hỏi cam kết bắt buộc trước khi mở khóa.
export const HIRING_TIMELINE_OPTIONS: HiringTimelineOption[] = [
  { value: "THIS_WEEK", label: "Tuần này" },
  { value: "NEXT_WEEK", label: "Tuần sau" },
  { value: "URGENT_24H", label: "Cần gấp trong 24h" },
];

export interface LeadLike {
  name: string;
  salonName: string;
  city: string;
  urgentRole?: string[];
}

// Gợi ý câu mở lời theo từng pain tag — cá nhân hoá bằng tên chủ/tên
// tiệm/thành phố/vị trí đang tuyển để nghe "trúng tim đen" khi gọi.
export function getSalesScript(tag: string, lead: LeadLike): string {
  const ownerFirstName = lead.name?.split(" ").slice(-1)[0] || "anh/chị";
  const role = lead.urgentRole && lead.urgentRole.length > 0 ? lead.urgentRole.join("/") : "thợ";
  const city = lead.city || "khu vực mình";
  const salon = lead.salonName || "tiệm mình";

  const scripts: Record<string, string> = {
    NEED_AUTO_BOOKING: `Chào ${ownerFirstName}, bên em thấy ${salon} ở ${city} đang cần tuyển ${role}. Em để ý tiệm mình hiện ghi lịch hẹn tay nên hay bị trùng giờ khách — bên em có app Booking tự động khóa lịch ngay khi thợ đang bận, khách đặt online là tiệm khỏi lo đụng giờ. Em cài tặng tiệm mình xài thử luôn nhé, ${ownerFirstName} rảnh chút xíu để em hướng dẫn không?`,
    NEED_TURN_AND_TIP_POS: `${ownerFirstName} ơi, bên em thấy tiệm mình ở ${city} đang tuyển ${role}. Em biết thợ hay để ý vụ chia turn lắm — bên em đang có app chạy trên iPad tự xoay tua thợ minh bạch, thợ không tị nạnh được, tiền tip cũng hiện rõ ràng từng người luôn. Em cài tặng ${salon} xài thử nhé, đảm bảo thợ mình thấy công bằng là gắn bó lâu hơn.`,
    NEED_SUPPLY_BILL_PRINT: `Chào ${ownerFirstName}, ${salon} đang cần ${role} đúng không ạ? Em thấy nhiều tiệm cuối tuần ngồi cộng tay tiền supply cực lắm — bên em có phần mềm tự trừ tiền bột/đá ngay trên bill tính tiền, in hóa đơn giấy nhiệt liền tay khách, khỏi phải ngồi tính sổ cuối tuần nữa. ${ownerFirstName} cho em 5 phút demo thử được không?`,
    NEED_GPS_REFUND: `${ownerFirstName} ơi, bên em thấy ${salon} ở ${city} đang tuyển ${role} gấp. Em biết quản lý giờ thợ với xử lý hoàn tiền khách hay đau đầu — bên em có chấm công GPS ngay tại tiệm, thợ đi trễ về sớm là biết liền, hoàn tiền/hủy đơn cũng có mã rõ ràng khỏi cãi nhau với khách. Để em setup thử cho tiệm mình nhé.`,
    NEED_AI_CRM_QR: `Chào ${ownerFirstName}, ${salon} đang cần thêm ${role} phải không ạ? Em thấy nhiều tiệm khách làm xong là mất luôn, không ai nhắc quay lại dặm gel — bên em có QR check-in cho khách quét lúc vào cửa, lưu lịch sử làm móng, hệ thống AI tự nhắn nhắc khách đi dặm lại đúng lịch. Tiệm mình thử 1 tuần miễn phí xem sao nhé ${ownerFirstName}?`,
  };

  return scripts[tag] || `Chào ${ownerFirstName}, bên em thấy ${salon} ở ${city} đang cần ${role}. Bên em có bộ giải pháp quản lý tiệm nail (booking, POS, chấm công, CRM) — để em giới thiệu nhanh cho ${ownerFirstName} nhé?`;
}
