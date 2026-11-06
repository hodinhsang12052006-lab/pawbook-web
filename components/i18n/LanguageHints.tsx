"use client";

import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";
import { deviceListsVietnamese, readLocaleCookie, useLanguage } from "@/lib/i18n/LanguageProvider";
import { hasViPrefix } from "@/lib/i18n/config";

type Mode = "to-en" | "to-vi" | null;
const DISMISS_EN = "pn_lang_hint_en"; // sessionStorage — chỉ ẩn trong phiên này
const DISMISS_VI = "pn_lang_hint_vi"; // localStorage — đã từ chối thì thôi hẳn

// Gợi ý ngôn ngữ, chỉ hiện SAU khi trang đã chạy ở trình duyệt (không ảnh hưởng
// HTML máy chủ / hydration):
//  • Khách mở 1 link /vi/… (Google, link thợ gửi) mà máy không có tiếng Việt →
//    "View in English" — khách Mỹ/Úc không bị kẹt ở trang họ không đọc được.
//  • Trang đang tiếng Anh nhưng máy có liệt kê tiếng Việt (không đứng đầu) và
//    người dùng chưa từng chọn → mời dùng tiếng Việt, 1 lần.
export default function LanguageHints() {
  const { locale, setLocale } = useLanguage();
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    let next: Mode = null;
    try {
      const cookie = readLocaleCookie();
      if (locale === "vi" && hasViPrefix(window.location.pathname) && cookie !== "vi" && !deviceListsVietnamese() && !sessionStorage.getItem(DISMISS_EN)) next = "to-en";
      else if (locale === "en" && !cookie && deviceListsVietnamese() && !localStorage.getItem(DISMISS_VI)) next = "to-vi";
    } catch {}
    // Đọc cookie / navigator chỉ có được sau khi mount — cập nhật state 1 lần ở đây là chủ ý.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(next);
  }, [locale]);

  if (!mode) return null;

  const dismiss = () => {
    try {
      if (mode === "to-en") sessionStorage.setItem(DISMISS_EN, "1");
      else localStorage.setItem(DISMISS_VI, "1");
    } catch {}
    setMode(null);
  };

  const toEn = mode === "to-en";
  return (
    <div
      role="region"
      aria-label={toEn ? "Language" : "Ngôn ngữ"}
      lang={toEn ? "en" : "vi"}
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+72px)] z-40 w-max max-w-[calc(100vw-24px)] -translate-x-1/2 max-md:[html[data-chat-open]_&]:hidden"
    >
      <div className="flex animate-fadeIn items-center gap-2 rounded-full border border-fuchsia-400/25 bg-slate-950/85 py-1.5 pl-3 pr-1.5 text-xs text-slate-200 shadow-[0_8px_30px_-8px_rgba(217,70,239,0.45)] backdrop-blur-xl">
        <Globe className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" aria-hidden />
        <span className="truncate">{toEn ? "This page is in Vietnamese." : "Bạn đọc tiếng Việt?"}</span>
        <button
          type="button"
          onClick={() => setLocale(toEn ? "en" : "vi")}
          className="min-h-[32px] shrink-0 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 font-bold text-white transition hover:brightness-110 active:scale-[0.97]"
        >
          {toEn ? "View in English" : "Dùng tiếng Việt"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={toEn ? "Dismiss" : "Đóng"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
