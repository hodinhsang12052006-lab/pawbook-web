// Nội dung NGƯỜI DÙNG viết (tin tuyển, bài đăng) hiển thị nguyên văn — không dịch máy, không ẩn.
// Với người xem tiếng Anh, nội dung có dấu tiếng Việt được gắn nhãn nhỏ "Written in Vietnamese"
// để họ hiểu vì sao đọc không được, thay vì tưởng giao diện bị lỗi.
import { currentLocale } from "@/lib/i18n/tr";
import { hasVietnamese } from "@/lib/i18n/viText";

export { hasVietnamese };

/** Đang xem bằng tiếng Anh mà nội dung là tiếng Việt → hiện nhãn "Written in Vietnamese". */
export const showVietnameseChip = (...parts: (string | null | undefined)[]): boolean =>
  currentLocale() === "en" && parts.some((p) => hasVietnamese(p));
