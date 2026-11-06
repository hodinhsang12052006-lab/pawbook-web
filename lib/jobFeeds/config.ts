// Công tắc + giấy phép + ghi nguồn cho tin việc từ đối tác. MẶC ĐỊNH TẮT — không có khoá / chưa bật thì mọi thứ là no-op.
//
//   EXTERNAL_JOBS_ADZUNA=on     + ADZUNA_APP_ID, ADZUNA_APP_KEY   (Vercel env; KHÔNG để trong code / log)
//   ADZUNA_LICENSE_REF=<số / ngày giấy phép thương mại Adzuna>   ← BẮT BUỘC để HIỆN CÔNG KHAI
//   EXTERNAL_JOBS_CAREERJET=on  + CAREERJET_API_KEY
//   CAREERJET_TERMS_CONFIRMED=<ngày / mã thư Careerjet xác nhận điều khoản>  ← BẮT BUỘC để bật nút tìm
//
// ⚠ Adzuna: bản dùng thử 14 ngày CHỈ để kiểm tra độ phủ / chất lượng dữ liệu; sản phẩm có doanh thu (PawNail là SaaS
//   thu phí) phải có GIẤY PHÉP thương mại. Vì vậy có 2 nấc:
//     - công tắc + khoá, CHƯA có ADZUNA_LICENSE_REF → cron vẫn lấy tin vào DB để ADMIN xem độ phủ (thẻ "Nguồn việc
//       đối tác" ghi "chưa có giấy phép: chỉ kiểm tra dữ liệu"); /api/jobs/external trả enabled:false, không ai khác thấy.
//     - có thêm ADZUNA_LICENSE_REF → mới hiện trên bảng việc.
//   Điều khoản Adzuna cấm liên hệ các công ty có tin trên Adzuna (không "nhận tiệm", không đưa vào CRM / bán hàng) và
//   cấm dùng số liệu cho phân tích / bán lại. Tắt công tắc hoặc gỡ ADZUNA_LICENSE_REF → API ngừng trả tin ngay
//   (CDN giữ bản cũ tối đa ~2 phút); tắt công tắc → cron lần tới xoá sạch dữ liệu đã lưu. Muốn xoá NGAY khi giấy phép
//   kết thúc: prisma/sql/2026-11-07_external_jobs_restore.sql.
// ⚠ Careerjet: chỉ tìm trực tiếp theo từng người xem (gửi IP + trình duyệt của người xem cho Careerjet — đã ghi
//   trong Chính sách quyền riêng tư), không lưu DB. Chưa có CAREERJET_TERMS_CONFIRMED (Careerjet xác nhận BẰNG VĂN BẢN
//   điều khoản hiển thị / ghi nguồn / bộ nhớ đệm) → nút tìm không hiện, route không gọi Careerjet.
// Nếu đối tác trả phí theo lượt bấm cho PawNail: đặt EXTERNAL_JOBS_REFERRAL_FEE=on → mục tin đối tác ghi rõ
//   "PawNail có thể nhận phí giới thiệu" (FTC / ACCC về link có trả tiền).
import type { Attribution, FeedMarket, FeedProvider } from "@/lib/jobFeeds/types";

const on = (v?: string) => /^(on|1|true|yes)$/i.test(String(v || "").trim());
/** Mã tham chiếu (giấy phép / thư xác nhận): chữ thật, ≥ 3 ký tự, không phải "off/0/false/no". */
const ref = (v?: string) => {
  const s = String(v || "").trim();
  return s.length >= 3 && !/^(off|0|false|no|none|null)$/i.test(s) ? s.slice(0, 80) : null;
};
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
/** Mã giấy phép thương mại Adzuna (không có → chỉ kiểm tra dữ liệu, không hiện công khai). */
export const adzunaLicenseRef = () => ref(process.env.ADZUNA_LICENSE_REF);
/** Careerjet đã xác nhận bằng văn bản điều khoản hiển thị / ghi nguồn / bộ nhớ đệm. */
export const careerjetTermsRef = () => ref(process.env.CAREERJET_TERMS_CONFIRMED);
/** Cron có gọi Adzuna không (bật + có khoá) — kể cả khi chưa có giấy phép (để admin kiểm tra độ phủ). */
export const adzunaEnabled = () => adzunaFlagOn() && !!adzunaKeys();
/** Tin Adzuna có được HIỆN CÔNG KHAI không: bật + có giấy phép thương mại. */
export const adzunaPublic = () => adzunaFlagOn() && !!adzunaLicenseRef();
/** Nút "Tìm thêm việc nail trên web" có hiện không: bật + có khoá + Careerjet đã xác nhận điều khoản. */
export const careerjetEnabled = () => careerjetFlagOn() && !!careerjetKey() && !!careerjetTermsRef();
/** Đối tác trả phí giới thiệu cho PawNail → phải ghi rõ trên mục tin đối tác. */
export const referralFeeDisclosed = () => on(process.env.EXTERNAL_JOBS_REFERRAL_FEE);

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
