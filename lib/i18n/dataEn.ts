import { currentLocale } from "./tr";
import { dtEn, responseEnText } from "./dtEn";

// Hàm hiển thị theo ngôn ngữ đang chọn. Bảng dịch nằm ở lib/i18n/dtEn.ts.
export { dtEn };

/** Dịch nội dung do app sinh ra khi đang ở chế độ EN (không có trong bảng → giữ nguyên). */
export function dt(vi: string | null | undefined): string {
  if (!vi) return vi ?? "";
  if (currentLocale() !== "en") return vi;
  return dtEn(vi);
}

/** "trong vài phút" / "trong ~40 phút" / "trong ~3 giờ" / "trong 1 ngày" → tiếng Anh khi đang ở chế độ EN. */
export function responseEn(vi: string): string {
  if (currentLocale() !== "en") return vi;
  return responseEnText(vi);
}
