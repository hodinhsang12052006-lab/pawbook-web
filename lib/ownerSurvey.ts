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
    question: "Khách đặt hẹn trước (Appointment) tại tiệm đang được ghi nhận thế nào?",
    optionA: "Ghi sổ tay hoặc tin nhắn; thỉnh thoảng bị trùng giờ hoặc thợ bận không kịp làm.",
    optionB: "Đã có hệ thống Booking online tự động khóa lịch khi thợ đang bận.",
    tag: "NEED_AUTO_BOOKING",
  },
  {
    key: "turn_tip",
    title: "Xoay tua thợ & POS tính tip minh bạch",
    question: "Việc chia lượt làm (xoay tua) cho thợ và tính tiền tip tại quầy đang xử lý ra sao?",
    optionA: "Xếp lượt thủ công, thợ đôi lúc tị nạnh nhau; tiền tip tính tay dễ nhầm lẫn.",
    optionB: "Có máy POS tự động xoay tua thợ công bằng và hiển thị tip rõ ràng, minh bạch.",
    tag: "NEED_TURN_AND_TIP_POS",
  },
  {
    key: "supply_bill",
    title: "Trừ chi phí supply trên bill & In bill nhiệt",
    question: "Tiền vật tư (supply) khấu trừ vào thợ và khâu in hóa đơn tại tiệm thực hiện thế nào?",
    optionA: "Cuối tuần ngồi cộng tay/trừ tay tiền bột, đá; viết hóa đơn tay hoặc không in bill.",
    optionB: "Phần mềm tự trừ chi phí supply trực tiếp trên bill tính tiền và in ngay hóa đơn giấy nhiệt.",
    tag: "NEED_SUPPLY_BILL_PRINT",
  },
  {
    key: "gps_refund",
    title: "Chấm công GPS & Quản lý hoàn tiền",
    question: "Khâu quản lý giờ giấc thợ và giải quyết khiếu nại hoàn tiền (refund) của khách ra sao?",
    optionA: "Khó kiểm soát chính xác giờ thợ đến/về; khách đòi trả tiền/khiếu nại xử lý theo cảm tính.",
    optionB: "Thợ chấm công chuẩn bằng định vị GPS tại tiệm; hoàn tiền/hủy đơn chuẩn theo mã đơn rõ ràng.",
    tag: "NEED_GPS_REFUND",
  },
  {
    key: "crm_qr",
    title: "QR Check-in, CRM & AI nhắc dặm gel",
    question: "Khâu tiếp đón khách tại cửa và chăm sóc khách cũ quay lại tiệm đang làm gì?",
    optionA: "Khách vào tự ngồi chờ; không lưu lịch sử làm móng; không có ai nhắn khách đi dặm lại.",
    optionB: "Khách quét QR check-in xem menu; có hệ thống lưu lịch sử + tích điểm SĐT và AI tự động nhắc khách dặm gel.",
    tag: "NEED_AI_CRM_QR",
  },
];

export interface PainTagMeta {
  tag: string;
  label: string;
  shortLabel: string;
  color: "red" | "purple" | "orange" | "yellow" | "blue";
  classes: string; // border+bg+text Tailwind classes cho badge
}

export const PAIN_TAG_META: Record<string, PainTagMeta> = {
  NEED_AUTO_BOOKING: {
    tag: "NEED_AUTO_BOOKING",
    label: "Bị trùng lịch, ghi sổ tay",
    shortLabel: "Auto Booking",
    color: "red",
    classes: "border-red-500/40 bg-red-500/10 text-red-400",
  },
  NEED_TURN_AND_TIP_POS: {
    tag: "NEED_TURN_AND_TIP_POS",
    label: "Thợ cãi nhau vì turn, nhầm tip",
    shortLabel: "Turn & Tip POS",
    color: "purple",
    classes: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  },
  NEED_SUPPLY_BILL_PRINT: {
    tag: "NEED_SUPPLY_BILL_PRINT",
    label: "Trừ supply tay, viết giấy",
    shortLabel: "Supply & Bill",
    color: "orange",
    classes: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  },
  NEED_GPS_REFUND: {
    tag: "NEED_GPS_REFUND",
    label: "Thợ đi trễ về sớm, hoàn tiền rối",
    shortLabel: "GPS & Refund",
    color: "yellow",
    classes: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  },
  NEED_AI_CRM_QR: {
    tag: "NEED_AI_CRM_QR",
    label: "Khách vắng, không ai chăm",
    shortLabel: "AI CRM & QR",
    color: "blue",
    classes: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  },
};

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
