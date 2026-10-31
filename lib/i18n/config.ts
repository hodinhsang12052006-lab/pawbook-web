// Locale routing — the single source of truth shared by next.config.ts (edge
// rewrites), the root [lang] layout, LanguageProvider, route handlers and the
// QA scripts.
//
//   /jobs     → English by default. Vercel's router rewrites it to /en/jobs or
//               /vi/jobs (both prerendered) from the cookie / Accept-Language,
//               without invoking a function.
//   /vi/jobs  → explicit, indexable Vietnamese URL.
//   /en/jobs  → 308 to /jobs (English lives on the unprefixed URL).
//
// Vietnamese is picked only when the visitor chose it (cookie) or when it is the
// FIRST language of the browser. Every other browser (en, es, zh, ko, fr…) gets
// English: a client in the US/AU must never land on a page they cannot read.

export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Cookie (read by the edge rewrites) + localStorage key (older builds stored the choice here). */
export const LOCALE_COOKIE = "bitpaw_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "vi";

/** "vi-VN,vi;q=0.9,en;q=0.8" → true. Same rule as the edge rewrite: only the FIRST tag counts. */
export function prefersVietnameseFirst(acceptLanguage: string | null | undefined): boolean {
  return /^\s*vi(?:[-_;,]|$)/i.test(acceptLanguage ?? "");
}

/** Cookie wins; otherwise Vietnamese only if it is the browser's first language; otherwise English. */
export function negotiateLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie;
  return prefersVietnameseFirst(acceptLanguage) ? "vi" : DEFAULT_LOCALE;
}

const PREFIX_RE = /^\/(en|vi)(?=\/|$)/;

/** "/vi/jobs/1" → "/jobs/1", "/en" → "/", "/jobs" → "/jobs". */
export function stripLocalePrefix(pathname: string): string {
  const out = pathname.replace(PREFIX_RE, "");
  return out === "" ? "/" : out;
}

export const hasViPrefix = (pathname: string) => /^\/vi(?=\/|$)/.test(pathname);

/** Public URL of `path` in `lang`: English is unprefixed, Vietnamese lives under /vi. */
export function localePath(path: string, lang: Locale): string {
  const p = stripLocalePrefix(path.startsWith("/") ? path : `/${path}`);
  if (lang === "en") return p;
  return p === "/" ? "/vi" : `/vi${p}`;
}

/** Intl locale for dates/numbers. */
export function intlLocale(lang: Locale, market?: string | null): string {
  if (lang === "vi") return "vi-VN";
  return market === "AU" ? "en-AU" : "en-US";
}
