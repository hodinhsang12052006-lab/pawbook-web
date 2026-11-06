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
      className={`flex h-9 flex-shrink-0 items-center gap-1 rounded-full border border-pn-line-strong bg-transparent px-3 text-[13px] font-semibold leading-none text-[#f6f0f5] transition-colors duration-200 hover:bg-white/[0.06] cursor-pointer select-none ${className}`}
    >
      <span className={locale === "en" ? "opacity-100" : "opacity-55"}>EN</span>
      <span aria-hidden className="opacity-55">·</span>
      <span className={locale === "vi" ? "opacity-100" : "opacity-55"}>VI</span>
      <span className="sr-only">{` — ${hint}`}</span>
    </button>
  );
}
