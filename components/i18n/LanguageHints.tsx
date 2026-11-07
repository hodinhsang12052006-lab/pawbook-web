"use client";

import { useEffect, useState } from "react";
import "@/components/marketing/marketing.css";
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
  // V2 look (pn-surface pill, pn-line ring, a ghost button — no fuchsia gradient / glow; the page's pink CTA stays
  // the only pink action in view). Placement: in-app it sits
  // under the 64 px header; on the marketing surfaces (html[data-surface]: guest "/" + /auth/*) the page's <h1> is
  // right there on a phone, so the pill moves to the bottom of the screen (no bottom nav on those pages).
  return (
    <div
      role="region"
      aria-label={toEn ? "Language" : "Ngôn ngữ"}
      lang={toEn ? "en" : "vi"}
      data-lang-hint={mode}
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+72px)] z-40 w-max max-w-[calc(100vw-24px)] -translate-x-1/2 max-md:[html[data-chat-open]_&]:hidden [html[data-surface]_&]:top-auto [html[data-surface]_&]:bottom-[calc(env(safe-area-inset-bottom)+16px)]"
    >
      <div className="flex animate-fadeIn items-center gap-2 rounded-full bg-pn-surface py-1.5 pl-3.5 pr-1.5 text-[13px] text-[#e8e0e6] shadow-[0_12px_32px_-12px_rgb(8_4_10/0.8),inset_0_0_0_1px_var(--color-pn-line-strong)]">
        <Globe className="h-4 w-4 shrink-0 text-[#a69ba4]" aria-hidden />
        <span className="truncate">{toEn ? "This page is in Vietnamese." : "Bạn đọc tiếng Việt?"}</span>
        <button
          type="button"
          onClick={() => setLocale(toEn ? "en" : "vi")}
          className="pn-btn pn-ghost shrink-0"
          style={{ height: 32, padding: "0 14px", fontSize: 13 }}
        >
          {toEn ? "View in English" : "Dùng tiếng Việt"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={toEn ? "Dismiss" : "Đóng"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#a69ba4] transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
