"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Instant client-side toggle — no route change, no page reload, just a
// context state flip + localStorage write (see LanguageProvider).
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200 cursor-pointer select-none ${className}`}
    >
      <span className={locale === "vi" ? "opacity-100" : "opacity-40"}>VI</span>
      <span className="text-slate-600">/</span>
      <span className={locale === "en" ? "opacity-100" : "opacity-40"}>EN</span>
    </button>
  );
}
