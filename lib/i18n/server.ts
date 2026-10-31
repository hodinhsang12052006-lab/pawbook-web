// Trợ giúp ngôn ngữ cho code MÁY CHỦ (metadata, route handler). Không import
// lib/i18n/tr — ngôn ngữ luôn được truyền tường minh (params.lang hoặc request).
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localePath, negotiateLocale, type Locale } from "@/lib/i18n/config";

export type { Locale };

export const BRAND = "PawNail";

/** params.lang của segment app/[lang] → Locale (giá trị lạ → "en"; dynamicParams=false nên thực tế không xảy ra). */
export async function langFrom(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

export const trL = (lang: Locale, vi: string, en: string) => (lang === "vi" ? vi : en);

/** Ngôn ngữ của 1 request API (private / no-store): cookie → Accept-Language → "en". */
export function localeFromRequest(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(en|vi)(?:;|$)`));
  return negotiateLocale(m?.[1], req.headers.get("accept-language"));
}

/**
 * canonical + hreflang: tiếng Anh ở URL không tiền tố (cũng là x-default), tiếng
 * Việt ở /vi/…. `canonicalLang` cho trang có nội dung gốc 1 ngôn ngữ.
 */
export function alternates(path: string, lang: Locale, canonicalLang: Locale = lang): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localePath(path, canonicalLang),
    languages: { en: localePath(path, "en"), vi: localePath(path, "vi"), "x-default": localePath(path, "en") },
  };
}

/** openGraph ghi đè NGUYÊN object của layout cha — luôn kèm siteName + locale. */
export function openGraph(lang: Locale, og: NonNullable<Metadata["openGraph"]> = {}): NonNullable<Metadata["openGraph"]> {
  return {
    siteName: BRAND,
    type: "website",
    locale: lang === "vi" ? "vi_VN" : "en_US",
    alternateLocale: lang === "vi" ? ["en_US", "en_AU"] : ["en_AU", "vi_VN"],
    ...og,
  } as NonNullable<Metadata["openGraph"]>;
}

/** Metadata đơn giản theo ngôn ngữ: { title, description?, robots? } + canonical/hreflang + openGraph. */
export function pageMetadata(
  lang: Locale,
  path: string,
  m: { title: [vi: string, en: string]; description?: [vi: string, en: string]; noindex?: boolean }
): Metadata {
  const title = trL(lang, ...m.title);
  const description = m.description ? trL(lang, ...m.description) : undefined;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: alternates(path, lang),
    openGraph: openGraph(lang, { title, ...(description ? { description } : {}) }),
    ...(m.noindex ? { robots: { index: false } } : {}),
  };
}
