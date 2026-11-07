// <head> boot script of the language hint (lib/i18n/langHint.ts): app/[lang]/layout.tsx inlines it so html[data-lh] is
// set before the first paint. SERVER ONLY on purpose: a String.raw`` tag is a function call the minifier cannot drop,
// so while this constant sat in langHint.ts every page's client bundle (LanguageHints -> dismissLangHint) carried the
// ~0.7 KB string as dead code. Client code imports langHint.ts, never this file.
import { LANG_HINT_ATTR, LANG_HINT_DISMISS_EN, LANG_HINT_DISMISS_VI } from "./langHint";

// Same rules as config.ts (cookie bitpaw_locale, hasViPrefix) and LanguageProvider.deviceListsVietnamese().
// html[lang] is the server-rendered page language. Storage access can throw (private mode, blocked cookies) → no hint.
// Keys / attribute are interpolated from langHint.ts so the boot script and dismissLangHint cannot drift apart.
export const LANG_HINT_BOOT = String.raw`(function(){try{var d=document.documentElement,c=(document.cookie.match(/(?:^|;\s*)bitpaw_locale=(en|vi)(?:;|$)/)||[])[1],n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language],v=0,i;for(i=0;i<n.length;i++)if(String(n[i]||"").toLowerCase().indexOf("vi")===0)v=1;if(d.lang==="vi"&&/^\/vi(?=\/|$)/.test(location.pathname)&&c!=="vi"&&!v&&!sessionStorage.getItem("${LANG_HINT_DISMISS_EN}"))d.setAttribute("${LANG_HINT_ATTR}","to-en");else if(d.lang==="en"&&!c&&v&&!localStorage.getItem("${LANG_HINT_DISMISS_VI}"))d.setAttribute("${LANG_HINT_ATTR}","to-vi")}catch(e){}})()`;
