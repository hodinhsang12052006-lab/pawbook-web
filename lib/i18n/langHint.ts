// Language hint (components/i18n/LanguageHints.tsx) — decided BEFORE the first paint by the <head> script of
// app/[lang]/layout.tsx, which sets html[data-lh="to-en" | "to-vi"]. The hint itself is in-flow markup that CSS shows
// from that attribute, so it takes its place in the very first frame (no layout shift) and never floats over the page.
//
//  • to-en: a /vi/… URL (Google result, link a tech shared) on a device with no Vietnamese and no "vi" cookie →
//    "This page is in Vietnamese. View in English" — a US/AU client is never stuck on a page they cannot read.
//    Dismissed for the browser session (sessionStorage).
//  • to-vi: an English page, no locale cookie yet, Vietnamese listed among the device languages (not first — first
//    already gets /vi from the edge) → "Bạn đọc tiếng Việt? Dùng tiếng Việt". Dismissed for good (localStorage).
// Choosing a language (either button or the header toggle) writes the cookie, so neither hint comes back.

export const LANG_HINT_ATTR = "data-lh";
export const LANG_HINT_DISMISS_EN = "pn_lang_hint_en"; // sessionStorage
export const LANG_HINT_DISMISS_VI = "pn_lang_hint_vi"; // localStorage
export type LangHintMode = "to-en" | "to-vi";
// The <head> boot script that sets html[data-lh] lives in lib/i18n/langHintBoot.ts (server only, see there).

/** Hide every hint now and remember the choice (same keys / lifetimes as before the in-flow rework). */
export function dismissLangHint(mode: LangHintMode) {
  try {
    if (mode === "to-en") sessionStorage.setItem(LANG_HINT_DISMISS_EN, "1");
    else localStorage.setItem(LANG_HINT_DISMISS_VI, "1");
  } catch {}
  document.documentElement.removeAttribute(LANG_HINT_ATTR);
}
