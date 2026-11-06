// MỘT bộ từ vựng nghề nail cho cả app: kỹ năng, quyền lợi, vị trí cần tuyển, hình thức lương.
// Đăng ký thợ, sửa hồ sơ, bộ lọc thợ, đăng tin tuyển và báo việc đều dùng các hằng số ở đây — trước đây
// form đăng ký lưu "Bột (Acrylic/Ombre)", "Design nghệ thuật", "Gel-X/Biab" còn hồ sơ / bộ lọc dùng
// "Bột/Acrylic", "Design", "Gel-X" → thợ đăng ký bằng tiếng Việt không thấy kỹ năng nào được chọn trong hồ
// sơ và không khớp bộ lọc.
//
// GIÁ TRỊ lưu DB giữ nguyên dạng đã có trên production (bộ lọc, báo việc, tín hiệu xu hướng dựa vào đó);
// chỉ NHÃN hiển thị được chuẩn hoá. Giá trị cũ được quy về giá trị chuẩn bằng canonicalSkill() /
// canonicalBenefit() lúc lưu và lúc đọc. THUẦN — dùng được ở máy chủ và trình duyệt.

export type Market = "US" | "AU";
type Label = { vi: string; en: string };

// ---- Kỹ năng ----
export const SKILLS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"] as const;
/** Kỹ năng thợ chọn lúc đăng ký (5 món chính). */
export const SIGNUP_SKILLS = ["Bột/Acrylic", "Dip/SNS", "Chân tay nước", "Design", "Gel-X"] as const;

const SKILL_LABEL: Record<string, Label> = {
  "Bột/Acrylic": { vi: "Bột / Acrylic", en: "Acrylic" },
  "Dip/SNS": { vi: "Dip / SNS", en: "Dip / SNS" },
  "Gel-X": { vi: "Gel-X / BIAB", en: "Gel-X / BIAB" },
  "Design": { vi: "Vẽ móng / Nail art", en: "Nail art" },
  "Chân tay nước": { vi: "Chân tay nước", en: "Mani-pedi" },
  "Wax": { vi: "Wax", en: "Waxing" },
  "Mi/Lông mày": { vi: "Mi / Lông mày", en: "Lashes / Brows" },
};
// Giá trị cũ (form đăng ký trước 11/2026) → giá trị chuẩn.
const LEGACY_SKILL: Record<string, string> = {
  "Bột (Acrylic/Ombre)": "Bột/Acrylic",
  "Bột": "Bột/Acrylic",
  "Acrylic": "Bột/Acrylic",
  "Design nghệ thuật": "Design",
  "Vẽ móng": "Design",
  "Gel-X/Biab": "Gel-X",
  "Gel-X/BIAB": "Gel-X",
  "Dip": "Dip/SNS",
};

export const canonicalSkill = (v: string): string => LEGACY_SKILL[v.trim()] ?? v.trim();
/** Danh sách kỹ năng → giá trị chuẩn, bỏ trùng, giữ thứ tự. */
export function canonicalSkills(list: readonly string[] | string | null | undefined): string[] {
  const arr = Array.isArray(list) ? list : String(list ?? "").split(",");
  return [...new Set(arr.map((s) => canonicalSkill(String(s))).filter(Boolean))];
}

// ---- Quyền lợi ----
export const VISA_US = "Hỗ trợ bảo lãnh EB-3";
export const VISA_AU = "Hỗ trợ visa 482";
export const VISA_LEGACY = "Hỗ trợ Visa 482/EB3";
/** Quyền lợi chủ tiệm chọn khi đăng tin — visa theo đúng thị trường (482 là visa Úc, EB-3 là visa Mỹ). */
export const jobBenefits = (market: Market): string[] => ["Có chỗ ở", "Bao lương", "Hỗ trợ đổi bang", market === "AU" ? VISA_AU : VISA_US, "Tip cao", "Xe đưa đón"];
/** Mong muốn của thợ lúc đăng ký. */
export const techBenefits = (market: Market): string[] => ["Có chỗ ở", "Hỗ trợ đổi bang", market === "AU" ? "Cần bảo lãnh visa 482" : "Cần bảo lãnh EB-3"];

const LEGACY_BENEFIT: Record<string, string> = {
  "Có chỗ ở (Housing)": "Có chỗ ở",
  "Hỗ trợ dời bang": "Hỗ trợ đổi bang",
  "Hỗ trợ chuyển bang": "Hỗ trợ đổi bang",
};
export const canonicalBenefit = (v: string): string => LEGACY_BENEFIT[v.trim()] ?? v.trim();
export function canonicalBenefits(list: readonly string[] | string | null | undefined): string[] {
  const arr = Array.isArray(list) ? list : String(list ?? "").split(",");
  return [...new Set(arr.map((s) => canonicalBenefit(String(s))).filter(Boolean))];
}

const BENEFIT_LABEL: Record<string, Label> = {
  "Có chỗ ở": { vi: "Có chỗ ở", en: "Housing provided" },
  "Bao lương": { vi: "Bao lương", en: "Guaranteed pay" },
  "Hỗ trợ đổi bang": { vi: "Hỗ trợ chuyển bang", en: "Relocation help" },
  [VISA_US]: { vi: "Hỗ trợ bảo lãnh EB-3", en: "Visa sponsorship (EB-3)" },
  [VISA_AU]: { vi: "Hỗ trợ visa 482", en: "Visa sponsorship (subclass 482)" },
  "Cần bảo lãnh EB-3": { vi: "Cần bảo lãnh EB-3", en: "Needs visa sponsorship (EB-3)" },
  "Cần bảo lãnh visa 482": { vi: "Cần bảo lãnh visa 482", en: "Needs visa sponsorship (subclass 482)" },
  "Tip cao": { vi: "Tip cao", en: "High tips" },
  "Xe đưa đón": { vi: "Xe đưa đón", en: "Transport provided" },
};
// Giá trị cũ gộp 2 thị trường → nhãn đúng theo thị trường của tin / thợ.
const MARKET_LABEL: Record<string, Record<Market, Label>> = {
  [VISA_LEGACY]: { US: BENEFIT_LABEL[VISA_US], AU: BENEFIT_LABEL[VISA_AU] },
  "Cần bảo lãnh Visa (EB-3/482)": { US: BENEFIT_LABEL["Cần bảo lãnh EB-3"], AU: BENEFIT_LABEL["Cần bảo lãnh visa 482"] },
};

// ---- Vị trí cần tuyển (form đăng ký chủ tiệm) ----
export const POSITIONS = ["Thợ Bột", "Thợ Dip", "Thợ chân tay nước", "Thợ làm được tất cả"] as const;
const POSITION_LABEL: Record<string, Label> = {
  "Thợ Bột": { vi: "Thợ bột", en: "Acrylic tech" },
  "Thợ Dip": { vi: "Thợ dip", en: "Dip tech" },
  "Thợ chân tay nước": { vi: "Thợ chân tay nước", en: "Mani-pedi tech" },
  "Thợ Nước": { vi: "Thợ chân tay nước", en: "Mani-pedi tech" },
  "Thợ làm được tất cả": { vi: "Thợ làm được tất cả", en: "All-round tech" },
  "All-around": { vi: "Thợ làm được tất cả", en: "All-round tech" },
};

/** Vị trí cần tuyển → kỹ năng chuẩn (tin tuyển tự tạo lúc chủ tiệm đăng ký). "Làm được tất cả" → không giới hạn. */
export const POSITION_SKILL: Record<string, string | null> = {
  "Thợ Bột": "Bột/Acrylic",
  "Thợ Dip": "Dip/SNS",
  "Thợ chân tay nước": "Chân tay nước",
  "Thợ Nước": "Chân tay nước",
  "Thợ làm được tất cả": null,
  "All-around": null,
};

// ---- Hình thức lương ----
const PAY_LABEL: Record<string, Label> = {
  "Ăn chia %": { vi: "% Ăn chia", en: "Commission split" },
  "% Ăn chia": { vi: "% Ăn chia", en: "Commission split" },
  "Bao lương tuần": { vi: "Bao lương tuần", en: "Weekly guaranteed pay" },
  "Bao lương": { vi: "Bao lương", en: "Guaranteed pay" },
  // "Theo giờ" = lương giờ ở Mỹ (bộ tách tin từ nhóm: "$28-34/hr") — trước đây hiện nguyên chữ Việt ở bản EN.
  "Theo giờ": { vi: "Lương giờ", en: "Hourly" },
  "Theo giờ AUD": { vi: "Lương giờ (AUD)", en: "Hourly (AUD)" },
  "Theo tuần AUD": { vi: "Lương tuần (AUD)", en: "Weekly (AUD)" },
  "Thỏa thuận": { vi: "Thoả thuận", en: "Negotiable" },
  "Thoả thuận": { vi: "Thoả thuận", en: "Negotiable" },
};

/**
 * Nhãn hiển thị của 1 giá trị đã lưu (kỹ năng / quyền lợi / vị trí / hình thức lương). `market` chọn nhãn
 * đúng cho giá trị gộp cũ (visa). Giá trị lạ (người dùng tự gõ) → nguyên văn.
 */
export function vocabLabel(v: string, lang: "vi" | "en", market?: string | null): string {
  const key = v.trim();
  const m: Market = market === "AU" ? "AU" : "US";
  const byMarket = MARKET_LABEL[key];
  const hit =
    (byMarket && (market === "AU" || market === "US") ? byMarket[m] : undefined) ??
    SKILL_LABEL[canonicalSkill(key)] ??
    BENEFIT_LABEL[canonicalBenefit(key)] ??
    POSITION_LABEL[key] ??
    PAY_LABEL[key] ??
    (byMarket ? { vi: "Hỗ trợ visa (EB-3 / 482)", en: "Visa sponsorship (EB-3 / 482)" } : undefined);
  return hit ? hit[lang] : v;
}
