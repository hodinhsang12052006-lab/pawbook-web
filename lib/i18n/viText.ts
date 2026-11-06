// Nhận biết chữ tiếng Việt (có dấu). THUẦN — không đọc ngôn ngữ đang chọn, nên route handler / code máy chủ
// import được (khác lib/i18n/contentLang.ts, vốn đọc currentLocale()).
const VN_DIACRITICS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

/** Chuỗi có chữ tiếng Việt (có dấu) không. */
export const hasVietnamese = (s: string | null | undefined): boolean => !!s && VN_DIACRITICS.test(s);
