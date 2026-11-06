// Công tắc + ghi nguồn cho tin việc từ đối tác. MẶC ĐỊNH TẮT — không có khoá / chưa bật thì mọi thứ là no-op.
//
//   EXTERNAL_JOBS_ADZUNA=on     + ADZUNA_APP_ID, ADZUNA_APP_KEY   (Vercel env; KHÔNG để trong code / log)
//   EXTERNAL_JOBS_CAREERJET=on  + CAREERJET_API_KEY
//
// ⚠ Adzuna: bản dùng thử 14 ngày CHỈ để kiểm tra độ phủ / chất lượng dữ liệu. PawNail là SaaS có thu phí nên
//   phải KÝ GIẤY PHÉP thương mại với Adzuna trước khi bật trên production. Điều khoản Adzuna cấm liên hệ các
//   công ty có tin trên Adzuna (không "nhận tiệm", không đưa vào CRM / bán hàng) và cấm dùng số liệu cho phân tích /
//   bán lại. Tắt công tắc → ẩn ngay lập tức, cron lần tới xoá sạch dữ liệu đã lưu.
// ⚠ Careerjet: chỉ tìm trực tiếp theo từng người xem (gửi IP + trình duyệt của người xem cho Careerjet — đã ghi
//   trong Chính sách quyền riêng tư), không lưu DB. Xin Careerjet xác nhận điều khoản hiển thị trước khi bật.
import type { Attribution, FeedMarket, FeedProvider } from "@/lib/jobFeeds/types";

const on = (v?: string) => /^(on|1|true|yes)$/i.test(String(v || "").trim());
const clampNum = (v: string | undefined, def: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.min(hi, Math.max(lo, n)) : def;
};

export const adzunaFlagOn = () => on(process.env.EXTERNAL_JOBS_ADZUNA);
export const careerjetFlagOn = () => on(process.env.EXTERNAL_JOBS_CAREERJET);
export function adzunaKeys(): { appId: string; appKey: string } | null {
  const appId = String(process.env.ADZUNA_APP_ID || "").trim();
  const appKey = String(process.env.ADZUNA_APP_KEY || "").trim();
  return appId && appKey ? { appId, appKey } : null;
}
export const careerjetKey = () => String(process.env.CAREERJET_API_KEY || "").trim() || null;
/** Cron có gọi Adzuna không (bật + có khoá). */
export const adzunaEnabled = () => adzunaFlagOn() && !!adzunaKeys();
/** Nút "Tìm thêm việc nail trên web" có hiện không. */
export const careerjetEnabled = () => careerjetFlagOn() && !!careerjetKey();

/** Tin Adzuna đã lưu tự hết hạn: không quá MAX_AGE_DAYS kể từ ngày đăng gốc, và không quá SEEN_TTL giờ
 *  kể từ lần cuối Adzuna còn trả tin đó (cron chạy mỗi ngày → vắng 2 lượt liên tiếp là ẩn). */
export const MAX_AGE_DAYS = 30;
export const seenTtlHours = () => clampNum(process.env.EXTERNAL_JOBS_SEEN_TTL_HOURS, 60, 24, 96);
/** Tin đã hết hạn quá N ngày → xoá hẳn (không lưu trữ dữ liệu đối tác). Thay bằng giới hạn trong giấy phép khi có. */
export const purgeAfterDays = () => clampNum(process.env.EXTERNAL_JOBS_PURGE_DAYS, 7, 0, 30);
/** Số trang (50 tin / trang) mỗi thị trường mỗi lượt cron — 2 thị trường × 10 trang = tối đa 20 lượt gọi / ngày. */
export const adzunaMaxPages = () => clampNum(process.env.ADZUNA_MAX_PAGES, 10, 1, 10);

export const PROVIDER_NAME: Record<FeedProvider, string> = { adzuna: "Adzuna", careerjet: "Careerjet" };

/** Ghi nguồn bắt buộc trên TỪNG tin: chữ / logo ≥ 116×23 px, link về trang Adzuna của đúng quốc gia.
 *  Câu chữ chính xác theo giấy phép → đổi bằng ADZUNA_ATTRIBUTION_LABEL nếu Adzuna yêu cầu khác. */
export function attributionFor(provider: FeedProvider, market: FeedMarket): Attribution {
  if (provider === "adzuna") {
    return { provider, label: String(process.env.ADZUNA_ATTRIBUTION_LABEL || "").trim().slice(0, 40) || "Jobs by Adzuna", href: market === "AU" ? "https://www.adzuna.com.au" : "https://www.adzuna.com" };
  }
  return { provider, label: "Jobs by Careerjet", href: market === "AU" ? "https://www.careerjet.com.au" : "https://www.careerjet.com" };
}
