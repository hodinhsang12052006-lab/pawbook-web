"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Đổi VI/EN: ghi cookie + localStorage rồi tải lại trang để máy chủ render đúng
// ngôn ngữ (xem LanguageProvider). Nhãn đầy đủ dùng tên bản ngữ của ngôn ngữ đích.
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();
  const label = locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={label}
      aria-label={label}
      lang={locale === "vi" ? "en" : "vi"}
      className={`flex min-h-[36px] items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200 cursor-pointer select-none ${className}`}
    >
      <span aria-hidden className={locale === "en" ? "opacity-100" : "opacity-40"}>EN</span>
      <span aria-hidden className="text-slate-600">/</span>
      <span aria-hidden className={locale === "vi" ? "opacity-100" : "opacity-40"}>VI</span>
    </button>
  );
}
