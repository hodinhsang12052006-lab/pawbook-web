"use client";

import "@/components/marketing/marketing.css";
import { usePathname } from "next/navigation";
import { Globe, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { stripLocalePrefix } from "@/lib/i18n/config";
import { dismissLangHint, type LangHintMode } from "@/lib/i18n/langHint";

// Gợi ý ngôn ngữ ("This page is in Vietnamese. View in English" / "Bạn đọc tiếng Việt? Dùng tiếng Việt") — luật chọn
// + lưu "đã đóng": lib/i18n/langHint.ts. Script <head> đặt html[data-lh] TRƯỚC khi vẽ; ở đây chỉ là markup tĩnh (cả 2
// biến thể, mặc định ẩn) mà CSS hiện theo thuộc tính đó → nằm đúng chỗ ngay khung hình đầu, không giật bố cục, không
// cần state (HTML máy chủ = HTML client).
//
// Luôn NẰM TRONG LUỒNG trang, không bao giờ "fixed": viên nổi cũ che nút / ô nhập khi cuộn (Tiếp tục ở
// /vi/auth/register?role=technician, ô nhập role=client/owner, link chân trang, thẻ ở landing / Mẫu nail / Tiệm).
//  • placement="top"  (layout gốc, trước nội dung): thanh mảnh trên cùng trang — landing khách "/" + mọi trang trong app.
//    Bỏ qua /auth/* (có chỗ riêng) và /messages (khung chat cao đúng 100dvh, thêm thanh là lòi cuộn).
//  • placement="auth" (app/[lang]/auth/layout.tsx): viên ngay sau form, trước chân trang.
// < 400 px: không globe, nút chữ ngắn — "This page is in Vietnamese." không bao giờ bị cắt trên máy 360 px.
const COPY: Record<LangHintMode, { lang: "en" | "vi"; region: string; text: string; cta: string; ctaShort: string; dismiss: string; target: "en" | "vi" }> = {
  "to-en": { lang: "en", region: "Language", text: "This page is in Vietnamese.", cta: "View in English", ctaShort: "English", dismiss: "Dismiss", target: "en" },
  "to-vi": { lang: "vi", region: "Ngôn ngữ", text: "Bạn đọc tiếng Việt?", cta: "Dùng tiếng Việt", ctaShort: "Tiếng Việt", dismiss: "Đóng", target: "vi" },
};
// Hiện theo html[data-lh] (đặt bởi script đầu trang / gỡ khi đóng).
const SHOW: Record<LangHintMode, string> = {
  "to-en": "hidden [html[data-lh=to-en]_&]:flex",
  "to-vi": "hidden [html[data-lh=to-vi]_&]:flex",
};

export default function LanguageHints({ placement }: { placement: "top" | "auth" }) {
  const { setLocale } = useLanguage();
  const path = stripLocalePrefix(usePathname() || "/");
  if (placement === "top" && (path.startsWith("/auth") || path.startsWith("/messages"))) return null;

  return (
    <>
      {(Object.keys(COPY) as LangHintMode[]).map((mode) => {
        const c = COPY[mode];
        const inner = (
          <>
            <Globe className="h-4 w-4 shrink-0 text-[#a69ba4] max-[399px]:hidden" aria-hidden />
            <span className="min-w-0 truncate">{c.text}</span>
            <button type="button" onClick={() => setLocale(c.target)} className="pn-btn pn-ghost shrink-0" style={{ height: 32, padding: "0 14px", fontSize: 13 }}>
              <span className="max-[399px]:hidden">{c.cta}</span>
              <span className="min-[400px]:hidden">{c.ctaShort}</span>
            </button>
            <button
              type="button"
              onClick={() => dismissLangHint(mode)}
              aria-label={c.dismiss}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#a69ba4] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </>
        );
        return placement === "top" ? (
          <div
            key={mode}
            role="region"
            aria-label={c.region}
            lang={c.lang}
            data-lang-hint={mode}
            className={`${SHOW[mode]} w-full justify-center border-b border-pn-line bg-pn-canvas px-3 py-2 text-[13px] text-[#e8e0e6] [html[data-surface]_&]:border-pn-line-soft [html[data-surface]_&]:bg-transparent`}
          >
            <div className="flex min-w-0 max-w-full items-center gap-2">{inner}</div>
          </div>
        ) : (
          <div key={mode} role="region" aria-label={c.region} lang={c.lang} data-lang-hint={mode} className={`${SHOW[mode]} mt-8 justify-center px-4 lg:px-0`}>
            <div className="flex min-w-0 max-w-full items-center gap-2 rounded-full bg-pn-surface py-1.5 pl-3.5 pr-1.5 text-[13px] text-[#e8e0e6] shadow-[inset_0_0_0_1px_var(--color-pn-line-strong)]">
              {inner}
            </div>
          </div>
        );
      })}
    </>
  );
}
