// "Nhịp đau tuần" — mỗi tuần 1 câu hỏi bấm-1-lần cho thợ và cho chủ tiệm.
// Đây là nguồn dữ liệu GỐC, THẬT về nỗi đau và xu hướng của ngành (không
// phải đoán, không phải cào mạng xã hội) — kết quả quay lại thành nội dung:
// "62% thợ ở Texas gặp khó vì chia turn tuần này".

export interface PulseOption {
  id: string;
  label: string;
}
export interface PulseQuestion {
  id: string;
  role: "TECHNICIAN" | "OWNER";
  question: string;
  /** Tiêu đề khi đăng kết quả, VD "Điều làm thợ mệt nhất tuần này". */
  topic: string;
  options: PulseOption[];
}

const o = (id: string, label: string): PulseOption => ({ id, label });

export const PULSE_QUESTIONS: Record<"TECHNICIAN" | "OWNER", PulseQuestion[]> = {
  TECHNICIAN: [
    {
      id: "tech_pain", role: "TECHNICIAN", topic: "Điều làm thợ mệt nhất tuần này",
      question: "Tuần này điều gì làm bạn mệt nhất ở tiệm?",
      options: [o("turn", "Chia turn không công bằng"), o("pay_late", "Lương / tip trả trễ"), o("slow", "Ít khách, ngồi chờ"), o("overtime", "Làm quá giờ, không nghỉ"), o("coworker", "Đồng nghiệp khó chịu"), o("ok", "Mọi thứ ổn 👍")],
    },
    {
      id: "tech_skill", role: "TECHNICIAN", topic: "Kỹ năng thợ muốn học nhất",
      question: "Bạn muốn học thêm kỹ năng nào nhất?",
      options: [o("gelx", "Gel-X"), o("dip", "Dip / SNS"), o("art", "Design vẽ tay"), o("builder", "Builder gel"), o("pedi", "Pedicure spa"), o("wax", "Wax / Mi")],
    },
    {
      id: "tech_move", role: "TECHNICIAN", topic: "Lý do thợ đổi tiệm",
      question: "Điều gì sẽ khiến bạn chuyển sang tiệm mới?",
      options: [o("pay", "Lương cao hơn"), o("fair_turn", "Chia turn công bằng"), o("housing", "Gần nhà / có chỗ ở"), o("respect", "Chủ tiệm tôn trọng"), o("tips", "Khách sang, tip cao"), o("stay", "Không muốn đổi")],
    },
    {
      id: "tech_trend", role: "TECHNICIAN", topic: "Kiểu móng khách chọn nhiều nhất tuần này",
      question: "Tuần này khách hay chọn kiểu móng nào nhất?",
      options: [o("gelx_long", "Gel-X dài"), o("dip_solid", "Dip màu trơn"), o("french", "French"), o("chrome", "Chrome / mắt mèo"), o("seasonal", "Design theo mùa"), o("short", "Móng ngắn tự nhiên")],
    },
  ],
  OWNER: [
    {
      id: "owner_pain", role: "OWNER", topic: "Điều làm chủ tiệm đau đầu nhất tuần này",
      question: "Tuần này tiệm đau đầu nhất chuyện gì?",
      options: [o("no_tech", "Thiếu thợ giỏi"), o("quit", "Thợ nghỉ ngang"), o("slow_days", "Khách vắng đầu tuần"), o("supply_cost", "Giá vật tư tăng"), o("bad_review", "Review xấu online"), o("paperwork", "Giấy tờ / thuế")],
    },
    {
      id: "owner_need", role: "OWNER", topic: "Kỹ năng chủ tiệm đang thiếu thợ nhất",
      question: "Tiệm bạn đang thiếu thợ kỹ năng nào nhất?",
      options: [o("gelx", "Gel-X"), o("dip", "Dip / SNS"), o("acrylic", "Bột / Acrylic"), o("art", "Design"), o("pedi", "Chân tay nước"), o("wax", "Wax / Mi")],
    },
    {
      id: "owner_retain", role: "OWNER", topic: "Cách chủ tiệm giữ chân thợ",
      question: "Bạn đang giữ chân thợ bằng cách nào?",
      options: [o("split", "Tăng % ăn chia"), o("salary", "Bao lương"), o("auto_turn", "Chia turn tự động"), o("housing", "Lo chỗ ở"), o("bonus", "Thưởng theo doanh số"), o("none", "Chưa có cách nào")],
    },
    {
      id: "owner_channel", role: "OWNER", topic: "Kênh mang khách mới nhiều nhất",
      question: "Kênh nào mang khách mới cho tiệm nhiều nhất?",
      options: [o("maps", "Google Maps / Yelp"), o("fb_ig", "Facebook / Instagram"), o("tiktok", "TikTok"), o("referral", "Khách quen giới thiệu"), o("walkin", "Khách vãng lai"), o("other", "Kênh khác")],
    },
  ],
};

/** Tuần ISO, VD "2026-W40" — câu hỏi đổi mỗi thứ Hai (UTC). */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function previousWeekKey(d = new Date()): string {
  return weekKey(new Date(d.getTime() - 7 * 86_400_000));
}

export function questionFor(role: string, week = weekKey()): PulseQuestion | null {
  const list = role === "OWNER" ? PULSE_QUESTIONS.OWNER : role === "TECHNICIAN" ? PULSE_QUESTIONS.TECHNICIAN : null;
  if (!list) return null;
  const n = Number(week.split("-W")[1]) || 0;
  return list[n % list.length];
}

export function findQuestion(id: string): PulseQuestion | null {
  return [...PULSE_QUESTIONS.TECHNICIAN, ...PULSE_QUESTIONS.OWNER].find((q) => q.id === id) ?? null;
}

/** Dưới ngưỡng này thì chưa công bố % (mẫu quá nhỏ dễ gây hiểu lầm). */
export const PULSE_MIN_VOTES = 5;
