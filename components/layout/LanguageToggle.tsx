"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Đổi VI/EN: ghi cookie + localStorage rồi tải lại trang để máy chủ render đúng
// ngôn ngữ (xem LanguageProvider). Nhãn đọc màn hình theo ngôn ngữ hiện tại, tên ngôn ngữ đích viết bằng bản ngữ.
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();
  const label = locale === "vi" ? "Ngôn ngữ: Tiếng Việt. Chuyển sang English" : "Language: English. Switch to Tiếng Việt";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={label}
      aria-label={label}
      className={`flex min-h-[36px] items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200 cursor-pointer select-none ${className}`}
    >
      <span aria-hidden className={locale === "en" ? "opacity-100" : "opacity-40"}>EN</span>
      <span aria-hidden className="text-slate-600">·</span>
      <span aria-hidden className={locale === "vi" ? "opacity-100" : "opacity-40"}>VI</span>
    </button>
  );
}
