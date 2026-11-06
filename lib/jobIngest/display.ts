// Làm gọn tin TỔNG HỢP (tool cào) lúc HIỂN THỊ — không ghi đè dữ liệu gốc (đổi lại được bất cứ lúc nào).
// Tin đã lưu trước 17/10/2026 còn lỗi: lương lấy nhầm từ SĐT / tiền thuê, tên tiệm kiểu "(tên người đăng)",
// thành phố thừa chữ cái đầu. Tin chủ tiệm tự đăng giữ nguyên.
// 17/10/2026 (soi dữ liệu thật): tên tiệm kiểu lời khen ("Salon Sạch Sẽ") → lấy tên thật trong bài ("Dorado Nail
// Bar"); thiếu thành phố → lấy từ "thành phố Billings, bang Montana"; bỏ chữ "Xem thêm" / "Ẩn bớt" của Facebook.
import { cityFromText, cleanCity, cleanSalonName, findSalary, findSalonName, safeToolSalary, zipStateInText } from "@/lib/jobIngest/parse";
import { dropContacts } from "@/lib/jobFeeds/normalize";

const FB_TAIL = /\s*(?:…|\.{3})?\s*(?:Xem thêm|Ẩn bớt|See more|See less)\s*$/i;

export function tidyIngestJob<T extends { source?: string | null; salonName: string; city: string | null; state: string | null; salaryAmount: string | null; description: string | null; market?: string | null }>(job: T): T {
  if (job.source !== "ingest") return job;
  const text = job.description || "";
  // Mã ZIP ghi trong bài là bằng chứng mạnh nhất về bang ("HILO, HAWAII 96720" mà tool gửi bang "IN").
  const zipState = job.market !== "AU" ? zipStateInText(text) : null;
  const state = zipState && zipState !== job.state ? zipState : job.state;
  const city = (state === job.state ? cleanCity(job.city) : "") || cityFromText(text) || "";
  const parsed = findSalary(text, job.market === "AU" ? "AU" : "US").salaryAmount;
  const salaryAmount = parsed !== "Thỏa thuận" ? parsed : safeToolSalary(job.salaryAmount || "", text) ?? "Thỏa thuận";
  let salonName = cleanSalonName(job.salonName, city, state);
  if (/^Tiệm nail( |$)/.test(salonName)) {
    const real = findSalonName(text);
    if (real) salonName = real;
  }
  const description = job.description ? job.description.replace(FB_TAIL, "").trimEnd() : job.description;
  return { ...job, state, city, salonName, salaryAmount, description };
}

// ===== Dữ liệu CÔNG KHAI của 1 tin (/api/jobs, /api/jobs/:id) =====
// Tin TỔNG HỢP từ bài đăng công khai ("ingest") phải theo đúng quy tắc của tin bên ngoài:
//   - ghi NGUỒN + link về bài gốc (sourceLink) — tin không có link bài gốc thì đã bị activeJobWhere ẩn;
//   - KHÔNG hiện SĐT lấy từ bài đăng (không "Gọi ngay"), mô tả bỏ SĐT / email và chỉ là đoạn trích ≤ 500 ký tự —
//     người xem mở bài gốc để liên hệ tiệm.
// Tin tự đăng / đăng hộ theo yêu cầu tiệm: giữ nguyên (SĐT do tiệm cung cấp). Khoá nội bộ (sourceKey, sourceFbHash) và
// link bài gốc thô không bao giờ trả ra.
export type SourceLink = { href: string; name: string };
const SNIPPET_MAX = 500;

/** Link bài gốc an toàn để hiện (chỉ https) + tên nguồn ("Facebook" / tên miền). */
export function sourceLinkOf(url: string | null | undefined): SourceLink | null {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.toLowerCase().replace(/^(?:www|m|mbasic|web)\./, "");
    return { href: u.toString(), name: /(^|\.)(facebook\.com|fb\.com)$/.test(host) ? "Facebook" : host };
  } catch {
    return null;
  }
}

/** Bỏ SĐT / email (giữ xuống dòng) rồi cắt thành đoạn trích. */
export function contactFreeSnippet(text: string | null | undefined, max = SNIPPET_MAX): string {
  const s = String(text || "").split("\n").map((l) => dropContacts(l)).filter(Boolean).join("\n").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

type PublicJobInput = { source?: string | null; sourceUrl?: string | null; sourceKey?: string | null; sourceFbHash?: string | null; phone: string; salonName: string; city: string | null; state: string | null; salaryAmount: string | null; description: string | null; market?: string | null };
export function publicJob<T extends PublicJobInput>(job: T): Omit<T, "sourceUrl" | "sourceKey" | "sourceFbHash"> & { sourceLink: SourceLink | null } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sourceUrl, sourceKey, sourceFbHash, ...rest } = job;
  const tidy = tidyIngestJob(rest);
  if (job.source !== "ingest") return { ...tidy, sourceLink: null };
  return { ...tidy, phone: "", description: contactFreeSnippet(tidy.description), sourceLink: sourceLinkOf(sourceUrl) };
}
