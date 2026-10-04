import { tr } from "./tr";

// Giá trị lưu DB (kỹ năng, quyền lợi, hình thức lương…) giữ nguyên tiếng Việt vì
// bộ lọc/tín hiệu dựa vào đó — chỉ NHÃN hiển thị đổi theo VI/EN. Giá trị lạ
// (người dùng tự gõ) hiển thị nguyên văn.
const EN: Record<string, string> = {
  // kỹ năng
  "Bột/Acrylic": "Acrylic",
  "Bột (Acrylic/Ombre)": "Acrylic / Ombre",
  "Chân tay nước": "Mani-pedi",
  "Mi/Lông mày": "Lashes/Brows",
  "Design": "Nail art",
  "Design nghệ thuật": "Nail art",
  "Gel-X/Biab": "Gel-X / BIAB",
  // quyền lợi
  "Có chỗ ở": "Housing provided",
  "Có chỗ ở (Housing)": "Housing provided",
  "Bao lương": "Guaranteed pay",
  "Hỗ trợ đổi bang": "Relocation help",
  "Hỗ trợ dời bang": "Relocation help",
  "Hỗ trợ Visa 482/EB3": "Visa 482/EB3 support",
  "Cần bảo lãnh Visa (EB-3/482)": "Needs visa sponsorship (EB-3/482)",
  "Tip cao": "High tips",
  "Xe đưa đón": "Transport provided",
  // vị trí cần tuyển (form đăng ký chủ tiệm)
  "Thợ Bột": "Acrylic tech",
  "Thợ Dip": "Dip tech",
  "Thợ Nước": "Mani-pedi tech",
  // hình thức lương
  "Ăn chia %": "Commission %",
  "Bao lương tuần": "Weekly guaranteed",
  "% Ăn chia": "Commission split",
  "Theo giờ AUD": "Hourly AUD",
  "Theo tuần AUD": "Weekly AUD",
};

export function valueLabel(v: string): string {
  const en = EN[v];
  return en ? tr(v, en) : v;
}
