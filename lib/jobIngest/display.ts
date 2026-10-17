// Làm gọn tin TỔNG HỢP (tool cào) lúc HIỂN THỊ — không ghi đè dữ liệu gốc (đổi lại được bất cứ lúc nào).
// Tin đã lưu trước 17/10/2026 còn lỗi: lương lấy nhầm từ SĐT / tiền thuê, tên tiệm kiểu "(tên người đăng)",
// thành phố thừa chữ cái đầu. Tin chủ tiệm tự đăng giữ nguyên.
// 17/10/2026 (soi dữ liệu thật): tên tiệm kiểu lời khen ("Salon Sạch Sẽ") → lấy tên thật trong bài ("Dorado Nail
// Bar"); thiếu thành phố → lấy từ "thành phố Billings, bang Montana"; bỏ chữ "Xem thêm" / "Ẩn bớt" của Facebook.
import { cityFromText, cleanCity, cleanSalonName, findSalary, findSalonName, safeToolSalary } from "@/lib/jobIngest/parse";

const FB_TAIL = /\s*(?:…|\.{3})?\s*(?:Xem thêm|Ẩn bớt|See more|See less)\s*$/i;

export function tidyIngestJob<T extends { source?: string | null; salonName: string; city: string | null; state: string | null; salaryAmount: string | null; description: string | null; market?: string | null }>(job: T): T {
  if (job.source !== "ingest") return job;
  const text = job.description || "";
  const city = cleanCity(job.city) || cityFromText(text) || "";
  const parsed = findSalary(text, job.market === "AU" ? "AU" : "US").salaryAmount;
  const salaryAmount = parsed !== "Thỏa thuận" ? parsed : safeToolSalary(job.salaryAmount || "", text) ?? "Thỏa thuận";
  let salonName = cleanSalonName(job.salonName, city, job.state);
  if (/^Tiệm nail( |$)/.test(salonName)) {
    const real = findSalonName(text);
    if (real) salonName = real;
  }
  const description = job.description ? job.description.replace(FB_TAIL, "").trimEnd() : job.description;
  return { ...job, city, salonName, salaryAmount, description };
}
