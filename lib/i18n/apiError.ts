// Câu báo lỗi từ API theo ngôn ngữ trang. Route trả { error: <vi>, errorEn: <en> }; người dùng tiếng Anh
// thấy errorEn, hoặc câu dự phòng tiếng Anh — không bao giờ thấy câu tiếng Việt.
import { tr } from "@/lib/i18n/tr";
import { hasVietnamese } from "@/lib/i18n/contentLang";

export function apiError(d: unknown, viFallback: string, enFallback: string): string {
  const o = (d && typeof d === "object" ? d : null) as { error?: unknown; errorEn?: unknown } | null;
  const vi = typeof o?.error === "string" && o.error.trim() ? o.error : viFallback;
  const en =
    typeof o?.errorEn === "string" && o.errorEn.trim()
      ? o.errorEn
      : typeof o?.error === "string" && o.error.trim() && !hasVietnamese(o.error)
        ? o.error
        : enFallback;
  return tr(vi, en);
}
