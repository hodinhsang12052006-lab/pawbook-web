// Đoán ngôn ngữ của 1 đoạn chữ người dùng viết (tin nhắn, tên mẫu, giới thiệu). THUẦN — dùng được ở cả
// máy chủ lẫn trình duyệt. Chỉ cần phân biệt tiếng Việt / tiếng Anh cho nút "Xem bản dịch":
//   - có dấu tiếng Việt → "vi"
//   - có từ tiếng Anh thông dụng → "en"
//   - còn lại (emoji, số, tên riêng, tiếng Việt không dấu…) → null (không mời dịch)
import { hasVietnamese } from "@/lib/i18n/viText";
import type { Locale } from "@/lib/i18n/config";

const EN_WORDS =
  /\b(the|you|your|yours|i|i'm|im|my|me|we|our|is|are|was|were|be|been|am|do|does|did|can|could|would|will|have|has|had|for|and|but|with|this|that|what|when|where|which|who|how|why|time|today|tomorrow|tonight|hi|hello|hey|thanks|thank|please|book|booking|appointment|available|nails?|set|price|prices|how much|ok|okay|sure|yes|no|not|see|soon|great|love|looks?|want|need|like|would|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|still|open|job|hiring)\b/i;

/** "vi" | "en" | null. */
export function detectTextLang(s: string | null | undefined): Locale | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (hasVietnamese(t)) return "vi";
  const words = t.match(/[A-Za-z']{2,}/g) ?? [];
  if (words.length >= 2 && EN_WORDS.test(t)) return "en";
  if (words.length >= 4 && words.filter((w) => EN_WORDS.test(w)).length >= 1) return "en";
  return null;
}

/** Người xem `viewer` có cần bản dịch cho đoạn này không (ngôn ngữ đoán được và khác ngôn ngữ của họ). */
export function needsTranslation(s: string | null | undefined, viewer: Locale): boolean {
  const l = detectTextLang(s);
  return !!l && l !== viewer;
}
