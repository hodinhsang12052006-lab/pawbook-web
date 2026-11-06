import { tr } from "./tr";
import { vocabLabel } from "@/lib/nailVocab";

// Giá trị lưu DB (kỹ năng, quyền lợi, hình thức lương…) giữ nguyên tiếng Việt vì bộ lọc / tín hiệu dựa vào
// đó — chỉ NHÃN hiển thị đổi theo VI/EN (bộ từ vựng chung: lib/nailVocab.ts). Giá trị lạ (người dùng tự
// gõ) hiển thị nguyên văn. `market` chọn nhãn đúng cho giá trị gộp cũ "Hỗ trợ Visa 482/EB3" (Mỹ → EB-3,
// Úc → 482).
export function valueLabel(v: string, market?: string | null): string {
  return tr(vocabLabel(v, "vi", market), vocabLabel(v, "en", market));
}

/** Nhãn tiếng Anh, không phụ thuộc ngôn ngữ đang chọn (máy chủ soạn bản EN của bài chính thức). */
export const valueEn = (v: string, market?: string | null): string => vocabLabel(v, "en", market);
