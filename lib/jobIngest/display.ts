// Làm gọn tin TỪ NHÓM (bot gửi vào) lúc HIỂN THỊ — không ghi đè dữ liệu gốc (đổi lại được bất cứ lúc nào).
// Tin đã lưu trước 17/10/2026 còn lỗi: lương lấy nhầm từ SĐT / tiền thuê, tên tiệm kiểu "(tên người đăng)",
// thành phố thừa chữ cái đầu. Tin chủ tiệm tự đăng giữ nguyên.
// 17/10/2026 (soi dữ liệu thật): tên tiệm kiểu lời khen ("Salon Sạch Sẽ") → lấy tên thật trong bài ("Dorado Nail
// Bar"); thiếu thành phố → lấy từ "thành phố Billings, bang Montana"; bỏ chữ "Xem thêm" / "Ẩn bớt" của Facebook.
import { cityFromText, cleanCity, cleanSalonName, findSalary, findSalonName, safeToolSalary, zipStateInText } from "@/lib/jobIngest/parse";

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
// Tin TỪ NHÓM CỘNG ĐỒNG PAWNAIL ("ingest" — tiệm đăng trong các nhóm Facebook của chủ PawNail và nhờ chia sẻ):
//   - GIỮ SĐT của tiệm (nút "Gọi ngay") và mô tả ĐẦY ĐỦ (chỉ làm gọn bằng tidyIngestJob) — quyết định của chủ 06/11/2026;
//   - ghi nguồn: sourceLink = link "Xem bài gốc" khi bài có link https; không có link thì tin VẪN hiện (sourceLink null).
// Tin tự đăng / đăng hộ theo yêu cầu tiệm: giữ nguyên. Khoá nội bộ (sourceKey, sourceFbHash) và link bài gốc THÔ
// (sourceUrl) không bao giờ trả ra — chỉ trả bản đã lọc (https, không tài khoản trong URL, bỏ tham số theo dõi).
export type SourceLink = { href: string; name: string };

const FB_HOST = /(^|\.)(facebook\.com|fb\.com)$/;
// Tham số cần để mở đúng bài trên Facebook (permalink.php?story_fbid=…&id=…, photo.php?fbid=…). Còn lại (__cft__,
// __tn__, mibextid, rdid, share_url…) là mã theo dõi / phiên → bỏ.
const FB_KEEP = new Set(["story_fbid", "id", "fbid", "set", "multi_permalinks", "post_id", "comment_id", "v"]);

/** Link bài gốc an toàn để hiện (chỉ https, không user:pass) + tên nguồn ("Facebook" / tên miền). */
export function sourceLinkOf(url: string | null | undefined): SourceLink | null {
  try {
    const u = new URL(String(url || "").trim());
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    const host = u.hostname.toLowerCase().replace(/^(?:www|m|mbasic|web)\./, "");
    const isFb = FB_HOST.test(host);
    if (isFb) {
      for (const k of [...u.searchParams.keys()]) if (!FB_KEEP.has(k)) u.searchParams.delete(k);
      u.hash = "";
    }
    return { href: u.toString(), name: isFb ? "Facebook" : host };
  } catch {
    return null;
  }
}

type PublicJobInput = { source?: string | null; sourceUrl?: string | null; sourceKey?: string | null; sourceFbHash?: string | null; phone: string; salonName: string; city: string | null; state: string | null; salaryAmount: string | null; description: string | null; market?: string | null };
export function publicJob<T extends PublicJobInput>(job: T): Omit<T, "sourceUrl" | "sourceKey" | "sourceFbHash"> & { sourceLink: SourceLink | null } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sourceUrl, sourceKey, sourceFbHash, ...rest } = job;
  const tidy = tidyIngestJob(rest);
  return { ...tidy, sourceLink: job.source === "ingest" ? sourceLinkOf(sourceUrl) : null };
}
