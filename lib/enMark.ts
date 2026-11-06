// Nội dung 2 thứ tiếng trong CÙNG 1 chuỗi (bài / tin nhắn của tài khoản chính thức): phần tiếng Việt + EN_MARK + phần
// tiếng Anh. Không đổi schema → không cần migration trên Turso. Module nhỏ, dùng được cả máy chủ lẫn trình duyệt
// (chat chỉ cần hàm chọn ngôn ngữ, không kéo theo kho bản dịch của lib/officialEn).

/** Dòng phân cách 2 thứ tiếng — người dùng thường không gõ ra đúng chuỗi này. */
export const EN_MARK = "\n\n— EN —\n";

export function splitEn(content: string): { vi: string; en: string | null } {
  const i = content.indexOf(EN_MARK);
  if (i < 0) return { vi: content, en: null };
  return { vi: content.slice(0, i), en: content.slice(i + EN_MARK.length).trim() || null };
}

/** Ghép 2 thứ tiếng; cột nội dung có giới hạn → cắt phần EN nếu quá dài (không bao giờ cắt phần tiếng Việt). */
export function joinEn(vi: string, en: string | null | undefined, max = 3990): string {
  if (!en) return vi;
  const room = max - vi.length - EN_MARK.length;
  if (room < 80) return vi;
  return vi + EN_MARK + en.slice(0, room);
}

/** Phần đúng ngôn ngữ người xem (không có bản EN → bản gốc). */
export const pickLang = (content: string, locale: string): string => {
  if (!content || content.indexOf(EN_MARK) < 0) return content;
  const { vi, en } = splitEn(content);
  return locale === "en" && en ? en : vi;
};
