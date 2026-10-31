// Hàm dịch toàn cục: tr("Việc làm", "Jobs") — gọi được ở bất cứ đâu trong lúc render.
//
// Ngôn ngữ của trang được quyết định ở máy chủ (segment app/[lang], xem
// lib/i18n/config.ts) và CỐ ĐỊNH suốt vòng đời trang (đổi VI/EN = tải lại trang),
// nên phía trình duyệt chỉ cần 1 biến toàn cục do LanguageProvider đặt.
//
// Phía máy chủ thì KHÁC: một tiến trình Node render nhiều request cùng lúc (Vercel
// Fluid, prerender song song lúc build) và React Fizz xen kẽ các task ở điểm
// suspend. Biến toàn cục ở đây sẽ làm lẫn chữ giữa request EN và VI rồi đóng băng
// vào HTML tĩnh. Vì vậy trên máy chủ tr() đọc giá trị của LocaleContext ngay trong
// task đang render — Fizz gán context._currentValue theo từng task (switchContext)
// trước khi render, nên luôn đúng request. Ngoài lúc render (route handler, unit
// test) context không có giá trị → dùng biến toàn cục (mặc định "en").
//
// Không import LocaleContext trực tiếp: file đó là "use client", ở tầng RSC / route
// handler nó chỉ là client reference (đọc thuộc tính sẽ ném lỗi). LanguageProvider
// tự đăng ký context qua bindLocaleContext() khi module của nó được nạp.
export type TrLocale = "vi" | "en";

function initialClientLocale(): TrLocale {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang === "vi" ? "vi" : "en";
}

let current: TrLocale = initialClientLocale();
let localeContext: { _currentValue?: unknown } | null = null;

/** Gọi 1 lần bởi lib/i18n/localeContext.ts. */
export function bindLocaleContext(ctx: object) {
  localeContext = ctx as { _currentValue?: unknown };
}

/** Chỉ dùng ở trình duyệt (LanguageProvider) và trong unit test. */
export function setTrLocale(locale: TrLocale) {
  current = locale;
}

export function currentLocale(): TrLocale {
  if (typeof window === "undefined" && localeContext) {
    const v = localeContext._currentValue;
    if (v === "vi" || v === "en") return v;
  }
  return current;
}

export function tr(vi: string, en: string): string {
  return currentLocale() === "en" ? en : vi;
}
