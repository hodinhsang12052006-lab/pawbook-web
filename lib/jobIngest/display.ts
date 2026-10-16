// Làm gọn tin TỔNG HỢP (tool cào) lúc HIỂN THỊ — không ghi đè dữ liệu gốc (đổi lại được bất cứ lúc nào).
// Tin đã lưu trước 17/10/2026 còn lỗi: lương lấy nhầm từ SĐT / tiền thuê, tên tiệm kiểu "(tên người đăng)",
// thành phố thừa chữ cái đầu. Tin chủ tiệm tự đăng giữ nguyên.
import { cleanCity, cleanSalonName, findSalary, safeToolSalary } from "@/lib/jobIngest/parse";

export function tidyIngestJob<T extends { source?: string | null; salonName: string; city: string | null; state: string | null; salaryAmount: string | null; description: string | null; market?: string | null }>(job: T): T {
  if (job.source !== "ingest") return job;
  const city = cleanCity(job.city);
  const text = job.description || "";
  const parsed = findSalary(text, job.market === "AU" ? "AU" : "US").salaryAmount;
  const salaryAmount = parsed !== "Thỏa thuận" ? parsed : safeToolSalary(job.salaryAmount || "", text) ?? "Thỏa thuận";
  return { ...job, city, salonName: cleanSalonName(job.salonName, city, job.state), salaryAmount };
}
