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

// Same rules as config.ts (cookie bitpaw_locale, hasViPrefix) and LanguageProvider.deviceListsVietnamese().
// html[lang] is the server-rendered page language. Storage access can throw (private mode, blocked cookies) → no hint.
export const LANG_HINT_BOOT = String.raw`(function(){try{var d=document.documentElement,c=(document.cookie.match(/(?:^|;\s*)bitpaw_locale=(en|vi)(?:;|$)/)||[])[1],n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language],v=0,i;for(i=0;i<n.length;i++)if(String(n[i]||"").toLowerCase().indexOf("vi")===0)v=1;if(d.lang==="vi"&&/^\/vi(?=\/|$)/.test(location.pathname)&&c!=="vi"&&!v&&!sessionStorage.getItem("pn_lang_hint_en"))d.setAttribute("data-lh","to-en");else if(d.lang==="en"&&!c&&v&&!localStorage.getItem("pn_lang_hint_vi"))d.setAttribute("data-lh","to-vi")}catch(e){}})()`;

/** Hide every hint now and remember the choice (same keys / lifetimes as before the in-flow rework). */
export function dismissLangHint(mode: LangHintMode) {
  try {
    if (mode === "to-en") sessionStorage.setItem(LANG_HINT_DISMISS_EN, "1");
    else localStorage.setItem(LANG_HINT_DISMISS_VI, "1");
  } catch {}
  document.documentElement.removeAttribute(LANG_HINT_ATTR);
}
