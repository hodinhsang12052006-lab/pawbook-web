// "Nail Radar" — ước tính mức bao lương/chia turn tham khảo theo tiểu bang
// + kỹ năng chính. KHÔNG phải số liệu thống kê chính thức hay lấy từ
// nguồn POS/booking thật (hệ thống chưa có nguồn dữ liệu đó) — đây là mức
// tham khảo tổng hợp theo kinh nghiệm phổ biến của cộng đồng ngành nail
// US/AU, dùng để người xem CÓ MỘT MỐC để đối chiếu khi thỏa thuận với chủ
// tiệm mới, không phải con số cam kết chính xác. Luôn hiển thị kèm
// disclaimer ở UI, không bao giờ trình bày như dữ liệu "live"/chính xác.

export type Market = "US" | "AU";
export type SkillKey = "BOT" | "DIP" | "TAY_NUOC";

export const SKILL_LABELS: Record<SkillKey, string> = {
  BOT: "Thợ Bột/Acrylic",
  DIP: "Thợ Dip/SNS",
  TAY_NUOC: "Thợ Chân Tay Nước",
};

export const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];

type Tier = "high" | "mid" | "low";

const US_STATE_TIER: Record<string, Tier> = {
  CA: "high", NY: "high", WA: "high",
  TX: "mid", FL: "mid", IL: "mid", VA: "mid", AZ: "mid",
  GA: "low", NC: "low",
};

const AU_STATE_TIER: Record<string, Tier> = {
  NSW: "high", ACT: "high",
  VIC: "mid", QLD: "mid", WA: "mid",
  SA: "low",
};

// Mức bao lương/tuần tham khảo theo tier chi phí sinh hoạt của bang.
const US_BASE_RANGE: Record<Tier, [number, number]> = {
  high: [1500, 1900],
  mid: [1300, 1650],
  low: [1100, 1400],
};
const AU_BASE_RANGE: Record<Tier, [number, number]> = {
  high: [1600, 2000],
  mid: [1400, 1750],
  low: [1200, 1500],
};

// Hệ số theo kỹ năng — Bột/Acrylic đòi hỏi kỹ thuật cao nhất nên thường
// bao lương nhỉnh hơn, Chân tay nước thường thấp hơn (nhưng bù lại tip đều).
const SKILL_MULTIPLIER: Record<SkillKey, number> = {
  BOT: 1.08,
  DIP: 1.0,
  TAY_NUOC: 0.85,
};

function roundTo25(n: number) {
  return Math.round(n / 25) * 25;
}

const TURN_SPLIT_BY_SKILL: Record<SkillKey, string[]> = {
  BOT: ["6/4 (thợ nhận 60%) — phổ biến nhất", "7/3 nếu thợ có sẵn khách quen đông"],
  DIP: ["6/4 (thợ nhận 60%) — phổ biến nhất", "Bao lương cố định, không chia turn theo doanh thu"],
  TAY_NUOC: ["6/4 (thợ nhận 60%)", "Trả theo giờ + tip 100% cho thợ"],
};

const SUPPLY_POLICY_BY_SKILL: Record<SkillKey, string> = {
  BOT: "Chủ thường bao supply cơ bản (bột, dung dịch); thợ tự sắm đồ nghề tay (giũa, cọ, máy mài riêng).",
  DIP: "Chủ thường bao supply cơ bản (bột dip, top/base); thợ tự sắm đồ nghề tay.",
  TAY_NUOC: "Chủ thường bao toàn bộ supply (sơn, dụng cụ ngâm/tẩy tế bào chết dùng chung).",
};

export const NEGOTIATION_TIPS = [
  "Xin xem ảnh/video tiệm thật (không phải ảnh mạng) trước khi quyết định bay xa.",
  "Hỏi rõ mức bao lương là bao nhiêu TUẦN đầu và có giảm sau đó không.",
  "Xác nhận bằng tin nhắn/văn bản mức chia turn và ai bao supply — tránh thỏa thuận miệng.",
  "Hỏi thẳng: tiệm đông khách loại nào (walk-in, khách hẹn, khách sang) để ước lượng tip thực tế.",
  "Nếu được bao chỗ ở, hỏi rõ: ở chung hay riêng, có tính phí trừ lương không.",
  "Hỏi lịch nghỉ, số ngày làm/tuần trước khi nhận lời — tránh hiểu lầm giờ giấc.",
];

export const OWNER_CHECKLIST = [
  "Bao lương $___/tuần trong bao nhiêu tuần đầu?",
  "Chia turn tỉ lệ bao nhiêu (6/4, 7/3...) sau giai đoạn bao lương?",
  "Ai bao supply — chủ hay thợ tự mua?",
  "Có chỗ ở/bao ăn ở cho thợ ở xa không? Có trừ vào lương không?",
  "Tiệm đông khách loại nào — walk-in hay khách hẹn trước?",
  "Lịch làm việc: mấy ngày/tuần, giờ mở-đóng cửa cụ thể?",
];

export interface RadarResult {
  market: Market;
  state: string;
  skill: SkillKey;
  skillLabel: string;
  rateMin: number;
  rateMax: number;
  currency: "USD" | "AUD";
  turnSplitOptions: string[];
  supplyPolicy: string;
  negotiationTips: string[];
  ownerChecklist: string[];
}

export function getRadarEstimate(market: Market, state: string, skill: SkillKey): RadarResult | null {
  const tierMap = market === "US" ? US_STATE_TIER : AU_STATE_TIER;
  const baseRangeMap = market === "US" ? US_BASE_RANGE : AU_BASE_RANGE;
  const tier = tierMap[state];
  if (!tier) return null;

  const [baseMin, baseMax] = baseRangeMap[tier];
  const mult = SKILL_MULTIPLIER[skill];

  return {
    market,
    state,
    skill,
    skillLabel: SKILL_LABELS[skill],
    rateMin: roundTo25(baseMin * mult),
    rateMax: roundTo25(baseMax * mult),
    currency: market === "US" ? "USD" : "AUD",
    turnSplitOptions: TURN_SPLIT_BY_SKILL[skill],
    supplyPolicy: SUPPLY_POLICY_BY_SKILL[skill],
    negotiationTips: NEGOTIATION_TIPS,
    ownerChecklist: OWNER_CHECKLIST,
  };
}
