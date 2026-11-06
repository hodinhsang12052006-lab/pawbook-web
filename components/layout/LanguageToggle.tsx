"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Đổi VI/EN: máy chủ đặt cookie rồi tải lại trang để render đúng ngôn ngữ (xem LanguageProvider).
// Tên truy cập BẮT ĐẦU bằng chữ đang hiện ("EN · VI") để người dùng điều khiển bằng giọng nói nói "click EN"
// vẫn khớp (WCAG 2.5.3); phần giải thích đọc màn hình nằm trong sr-only phía sau. QA chọn nút bằng
// [data-locale-toggle], không dựa vào chữ.
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();
  const hint = locale === "vi" ? "Ngôn ngữ: Tiếng Việt. Chuyển sang English" : "Language: English. Switch to Tiếng Việt";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={hint}
      data-locale-toggle={locale}
      className={`flex min-h-[36px] items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200 cursor-pointer select-none ${className}`}
    >
      <span className={locale === "en" ? "opacity-100" : "opacity-40"}>EN</span>
      <span className="text-slate-600"> · </span>
      <span className={locale === "vi" ? "opacity-100" : "opacity-40"}>VI</span>
      <span className="sr-only">{` — ${hint}`}</span>
    </button>
  );
}
