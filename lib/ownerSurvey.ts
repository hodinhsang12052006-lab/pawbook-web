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
    title: "Đặt lịch thông minh & tự khóa lịch",
    question: "Cuối tuần đông khách, lịch hẹn có hay bị trùng giờ khiến khách phải chờ lâu không?",
    optionA: "Có, ghi sổ hoặc nhắn tin dễ bị sót lịch.",
    optionB: "Tiệm đã có hệ thống tự khóa lịch khi thợ bận, không bị trùng giờ.",
    tag: "NEED_AUTO_BOOKING",
  },
  {
    key: "turn_tip",
    title: "Chia turn & tính tip minh bạch",
    question: "Chia turn và tip trong tiệm có rõ ràng, công bằng với thợ không?",
    optionA: "Chưa, đang chia bằng tay nên dễ nhầm và mất thời gian.",
    optionB: "Có, tiệm dùng bảng chia turn tự động, thợ tự xem được.",
    tag: "NEED_TURN_AND_TIP_POS",
  },
  {
    key: "supply_bill",
    title: "Theo dõi chi phí vật tư & in hóa đơn",
    question: "Bạn có theo dõi được chi phí vật tư (bột, gel, đá…) theo từng dịch vụ không?",
    optionA: "Chưa, đang ghi tay nên tốn thời gian và khó biết chính xác.",
    optionB: "Có, tiệm theo dõi chi phí vật tư và in hóa đơn cho từng khách.",
    tag: "NEED_SUPPLY_BILL_PRINT",
  },
  {
    key: "gps_refund",
    title: "Chấm công & xử lý hoàn tiền",
    question: "Tiệm theo dõi giờ làm của thợ và xử lý yêu cầu hoàn tiền của khách thế nào?",
    optionA: "Chưa có cách theo dõi rõ ràng; hoàn tiền xử lý tùy từng trường hợp.",
    optionB: "Thợ chấm công tại tiệm; có mã hóa đơn rõ ràng khi khách yêu cầu hoàn tiền.",
    tag: "NEED_GPS_REFUND",
  },
  {
    key: "crm_qr",
    title: "Check-in bằng mã QR, chăm sóc khách & nhắc lịch dặm",
    question: "Những ngày vắng khách (Thứ 2 – Thứ 4), tiệm làm gì để mời khách cũ quay lại?",
    optionA: "Chủ yếu chờ khách vãng lai, chưa có ai nhắn tin cho khách cũ.",
    optionB: "Có hệ thống tự gửi tin nhắn nhắc khách hẹn dặm lại sau 3 tuần (khách đồng ý nhận tin).",
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
  // (Trước đây dùng trong UnlockChatModal — đã bỏ.) Bước "khảo sát chuyên sâu"
  // khi mở khóa nhắn tin/gọi 1 thợ cụ thể, cá nhân hoá theo đúng pain tag
  // chủ tiệm đã chọn lúc đăng ký.
  unlockQuestion: string;
  unlockCheckboxLabel: string;
}

export const PAIN_TAG_META: Record<string, PainTagMeta> = {
  NEED_AUTO_BOOKING: {
    tag: "NEED_AUTO_BOOKING",
    label: "Lịch hẹn hay bị trùng",
    shortLabel: "Đặt lịch tự động",
    color: "red",
    classes: "border-red-500/40 bg-red-500/10 text-red-400",
    problem: "Lịch hẹn giờ cao điểm dễ bị trùng, thợ quá tải hoặc khách phải chờ lâu.",
    solution: "Đặt lịch trực tuyến tự khóa giờ khi thợ đang có khách và gửi tin nhắn xác nhận lịch hẹn.",
    trojanHorse: "Báo tôi khi tính năng đặt lịch thông minh ra mắt",
    unlockQuestion: "Tiệm bạn hay bị trùng lịch giờ cao điểm. Bạn có muốn bật đặt lịch thông minh tự khóa giờ khi thợ này bắt đầu làm không?",
    unlockCheckboxLabel: "Cần hỗ trợ cài đặt ngay.",
  },
  NEED_TURN_AND_TIP_POS: {
    tag: "NEED_TURN_AND_TIP_POS",
    label: "Chia turn & tip chưa rõ ràng",
    shortLabel: "Chia turn & tip",
    color: "purple",
    classes: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    problem: "Chia turn bằng tay và tính tip dễ nhầm, ảnh hưởng đến sự gắn bó của thợ.",
    solution: "Hệ thống chia turn công bằng theo giá trị hóa đơn, tách riêng tip tiền mặt và tip thẻ trên màn hình. Thợ tự xem được.",
    trojanHorse: "Báo tôi khi bảng chia turn ra mắt",
    unlockQuestion: "Tiệm bạn muốn chia turn rõ ràng hơn. Bạn có muốn dùng bảng chia turn minh bạch khi nhận thợ này không?",
    unlockCheckboxLabel: "Cần hỗ trợ cài đặt ngay.",
  },
  NEED_SUPPLY_BILL_PRINT: {
    tag: "NEED_SUPPLY_BILL_PRINT",
    label: "Chưa theo dõi được chi phí vật tư",
    shortLabel: "Vật tư & hóa đơn",
    color: "orange",
    classes: "border-orange-500/40 bg-orange-500/10 text-orange-400",
    problem: "Khó biết chi phí vật tư thực tế của từng dịch vụ, tốn thời gian cộng sổ cuối tuần.",
    solution: "Theo dõi chi phí vật tư theo từng dịch vụ để biết lãi thực tế; in hóa đơn cho khách bằng một chạm.",
    trojanHorse: "Báo tôi khi tính năng theo dõi chi phí vật tư ra mắt",
    unlockQuestion: "Tiệm bạn muốn theo dõi chi phí vật tư. Bạn có muốn dùng công cụ theo dõi vật tư theo từng dịch vụ không?",
    unlockCheckboxLabel: "Cần trải nghiệm giải pháp này.",
  },
  NEED_GPS_REFUND: {
    tag: "NEED_GPS_REFUND",
    label: "Chấm công & hoàn tiền chưa rõ ràng",
    shortLabel: "Chấm công & hoàn tiền",
    color: "yellow",
    classes: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    problem: "Khó theo dõi giờ làm của thợ; yêu cầu hoàn tiền của khách chưa có quy trình rõ ràng.",
    solution: "Chấm công ngay tại tiệm; hoàn tiền và hủy dịch vụ theo mã hóa đơn rõ ràng.",
    trojanHorse: "Báo tôi khi tính năng chấm công & mã hóa đơn ra mắt",
    unlockQuestion: "Tiệm bạn muốn theo dõi giờ làm và xử lý hoàn tiền rõ ràng. Bạn có muốn bật chấm công và mã hóa đơn cho thợ này không?",
    unlockCheckboxLabel: "Kích hoạt giải pháp này.",
  },
  NEED_AI_CRM_QR: {
    tag: "NEED_AI_CRM_QR",
    label: "Chưa chăm sóc khách cũ",
    shortLabel: "Chăm sóc khách & QR",
    color: "blue",
    classes: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    problem: "Khách làm xong ít quay lại; những ngày Thứ 2 – Thứ 4 tiệm vắng khách.",
    solution: "Check-in bằng mã QR, tích điểm theo số điện thoại và tự gửi tin nhắn nhắc khách hẹn dặm lại sau 3 tuần (khách đồng ý nhận tin).",
    trojanHorse: "Báo tôi khi check-in QR & nhắc lịch dặm ra mắt",
    unlockQuestion: "Bạn có muốn tự gửi tin nhắn mời khách cũ (đã đồng ý nhận tin) quay lại vào Thứ 2 – Thứ 4 không?",
    unlockCheckboxLabel: "Kích hoạt giải pháp giữ chân khách.",
  },
};

export interface HiringTimelineOption {
  value: string;
  label: string;
}

// (Không còn dùng trong app — giữ để đọc dữ liệu cũ trong Lead Radar.)
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
    NEED_TURN_AND_TIP_POS: `${ownerFirstName} ơi, bên em thấy tiệm mình ở ${city} đang tuyển ${role}. Chia turn rõ ràng giúp thợ yên tâm gắn bó — bên em có bảng chia turn minh bạch trên màn hình, tip tiền mặt và tip thẻ của từng thợ hiện rõ ràng. Em cài tặng ${salon} xài thử nhé, đảm bảo thợ mình thấy công bằng là gắn bó lâu hơn.`,
    NEED_SUPPLY_BILL_PRINT: `Chào ${ownerFirstName}, ${salon} đang cần ${role} đúng không ạ? Nhiều tiệm mất cả buổi cuối tuần để cộng chi phí vật tư — bên em có công cụ theo dõi chi phí vật tư theo từng dịch vụ và in hóa đơn cho khách, đỡ phải tính sổ tay. ${ownerFirstName} cho em 5 phút demo thử được không?`,
    NEED_GPS_REFUND: `${ownerFirstName} ơi, bên em thấy ${salon} ở ${city} đang tuyển ${role} gấp. Em biết quản lý giờ thợ với xử lý hoàn tiền khách hay đau đầu — bên em có chấm công GPS ngay tại tiệm, thợ đi trễ về sớm là biết liền, hoàn tiền/hủy đơn cũng có mã rõ ràng khỏi cãi nhau với khách. Để em setup thử cho tiệm mình nhé.`,
    NEED_AI_CRM_QR: `Chào ${ownerFirstName}, ${salon} đang cần thêm ${role} phải không ạ? Em thấy nhiều tiệm khách làm xong là mất luôn, không ai nhắc quay lại dặm gel — bên em có QR check-in cho khách quét lúc vào cửa, lưu lịch sử làm móng, hệ thống AI tự nhắn nhắc khách đi dặm lại đúng lịch. Tiệm mình thử 1 tuần miễn phí xem sao nhé ${ownerFirstName}?`,
  };

  return scripts[tag] || `Chào ${ownerFirstName}, bên em thấy ${salon} ở ${city} đang cần ${role}. Bên em có bộ giải pháp quản lý tiệm nail (booking, POS, chấm công, CRM) — để em giới thiệu nhanh cho ${ownerFirstName} nhé?`;
}
