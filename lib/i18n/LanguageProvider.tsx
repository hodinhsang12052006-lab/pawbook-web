"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { setTrLocale } from "@/lib/i18n/tr";
import { LocaleContext } from "@/lib/i18n/localeContext";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, hasViPrefix, isLocale, stripLocalePrefix, type Locale } from "@/lib/i18n/config";
import vi from "./dictionaries/vi.json";
import en from "./dictionaries/en.json";

export type { Locale };

type Dict = { [key: string]: string | Dict };
const DICTIONARIES: Record<Locale, Dict> = { vi, en };
// Đánh dấu đã tự tải lại 1 lần để đồng bộ lựa chọn cũ (chống vòng lặp khi cookie bị chặn).
const SYNC_FLAG = "pn_locale_sync";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  // Nested-key lookup, e.g. t("messenger.title"), with {placeholder}
  // interpolation, e.g. t("messenger.replyingTo", { name: "Alice" }).
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** The /auth/* language hint (<LanguageHints placement="auth" />), handed down by the root layout — see below. */
  authHint: React.ReactNode;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function lookup(dict: Dict, key: string): string | undefined {
  const v = key.split(".").reduce<string | Dict | undefined>((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict);
  return typeof v === "string" ? v : undefined;
}

export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(en|vi)(?:;|$)`));
  return m ? (m[1] as Locale) : null;
}

/** Ghi lựa chọn vào cookie (máy chủ / edge đọc) + localStorage (tương thích bản cũ). */
export function persistLocale(next: Locale) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {}
  try {
    localStorage.setItem(LOCALE_COOKIE, next);
  } catch {
    // Ignore write failures (private browsing / storage disabled).
  }
}

/** Trình duyệt có liệt kê tiếng Việt (ở bất kỳ vị trí nào) không. */
export function deviceListsVietnamese(): boolean {
  if (typeof navigator === "undefined") return false;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith("vi"));
}

/** Tải trang theo ngôn ngữ mới: rời /vi/* sang EN thì bỏ tiền tố; còn lại tải lại đúng URL — edge đọc cookie mới. */
export function reloadInLocale(next: Locale) {
  const { pathname, search, hash } = window.location;
  if (next === "en" && hasViPrefix(pathname)) window.location.assign(stripLocalePrefix(pathname) + search + hash);
  else window.location.reload();
}

/**
 * Ngôn ngữ do máy chủ quyết định (segment app/[lang]) và cố định cho cả trang —
 * HTML máy chủ và lần render đầu ở trình duyệt luôn cùng 1 ngôn ngữ, không còn
 * nháy tiếng Việt rồi mới đổi sang tiếng Anh, không lệch hydration. Đổi VI/EN =
 * ghi cookie rồi tải lại trang (segment gốc đổi nên tải lại là đường đúng).
 */
// `authHint`: the root layout (server) passes <LanguageHints placement="auth" /> here and app/[lang]/auth/layout.tsx
// renders it from this context instead of importing LanguageHints itself. A second import from the auth layout made
// LanguageHints a module shared by two layout entries; /auth/register is already at webpack's 25 initial-chunk limit,
// so that reshuffled the split chunks and shipped react-hot-toast twice (+15 KB raw JS). This way the module only
// lives in the root layout's chunk, exactly like before the in-flow hint.
export function LanguageProvider({ initialLocale, authHint = null, children }: { initialLocale: Locale; authHint?: React.ReactNode; children: React.ReactNode }) {
  const locale: Locale = isLocale(initialLocale) ? initialLocale : "en";
  // Biến toàn cục cho tr() phía trình duyệt — đặt ngay trong lúc render, trước khi
  // component con render. Máy chủ KHÔNG đụng biến này (tr() đọc LocaleContext).
  if (typeof window !== "undefined") setTrLocale(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next) || next === locale) return;
      // Ghi tại chỗ trước (dự phòng khi mạng lỗi), rồi để MÁY CHỦ đặt cookie 1 năm: cookie do script ghi bị
      // Safari / WKWebView của app iOS (ITP) cắt còn 7 ngày → hết hạn là người chọn tiếng Việt nhận HTML
      // tiếng Anh. Tải lại sau khi máy chủ trả lời (tối đa 1,5 giây).
      persistLocale(next);
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        reloadInLocale(next);
      };
      const timer = setTimeout(go, 1500);
      fetch("/api/me/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: next, cookie: true }), credentials: "same-origin" })
        .catch(() => {})
        .finally(() => {
          clearTimeout(timer);
          go();
        });
    },
    [locale]
  );

  const toggleLocale = useCallback(() => setLocale(locale === "vi" ? "en" : "vi"), [locale, setLocale]);

  // Đồng bộ 1 lần cho người dùng bản cũ: trước đây lựa chọn VI/EN chỉ nằm trong
  // localStorage (máy chủ không thấy). Chưa có cookie → chép sang cookie; nếu khác
  // ngôn ngữ đang hiển thị thì tải lại 1 lần để máy chủ render đúng.
  useEffect(() => {
    if (readLocaleCookie()) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCALE_COOKIE);
    } catch {}
    if (isLocale(saved)) {
      persistLocale(saved);
      // Cookie mất (vd. Safari ITP xoá cookie do script ghi sau 7 ngày) → xin máy chủ đặt lại cookie bền.
      const durable = fetch("/api/me/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: saved, cookie: true }), credentials: "same-origin" }).catch(() => {});
      if (saved === locale || !readLocaleCookie()) return; // cookie bị chặn → không tải lại (tránh vòng lặp)
      try {
        if (sessionStorage.getItem(SYNC_FLAG)) return;
        sessionStorage.setItem(SYNC_FLAG, "1");
      } catch {
        return;
      }
      const target = saved;
      Promise.race([durable, new Promise((r) => setTimeout(r, 1500))]).finally(() => reloadInLocale(target));
      return;
    }
    // Vào thẳng 1 link /vi/* (Google, link chia sẻ) trên máy có tiếng Việt → nhớ
    // tiếng Việt cho các trang sau. Máy không có tiếng Việt thì KHÔNG nhớ — các
    // trang tiếp theo về tiếng Anh, LanguageHints mời chuyển sang English.
    if (locale === "vi" && hasViPrefix(window.location.pathname) && deviceListsVietnamese()) persistLocale("vi");
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Thiếu khoá ở ngôn ngữ đang chọn → tiếng Anh → tên khoá. Không bao giờ rơi
      // về tiếng Việt cho người dùng EN.
      let str = lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES.en, key) ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return str;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, toggleLocale, t, authHint }), [locale, setLocale, toggleLocale, t, authHint]);

  return (
    <LocaleContext.Provider value={locale}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </LocaleContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
