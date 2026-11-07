import { hasViPrefix, localePath } from "@/lib/i18n/config";

/**
 * Internal URL for a programmatic navigation (router.push / router.replace / location.assign) that keeps the
 * visitor in the language of the page they are on.
 *
 * On a /vi/* page the unprefixed path is NOT safe: "/auth/login" is resolved by the edge rewrite from the
 * bitpaw_locale cookie / the browser's first language, so a Vietnamese reader who arrived on /vi/… from Google or a
 * shared link with an English browser (no cookie yet) landed on the English login with a Vietnamese toast. Here the
 * /vi prefix is kept (canonical lib/i18n/config.ts localePath). Anywhere else the path is returned unchanged — the
 * same rewrite that picked the current page's language picks the next page's.
 *
 * For event handlers / effects only (it reads window.location): render-time hrefs must stay identical on the server
 * and in the browser, so plain <Link href> keeps its existing behaviour.
 */
export function localeHref(path: string, pathname: string = typeof window === "undefined" ? "" : window.location.pathname): string {
  // Only same-site absolute paths ("/x"), never protocol-relative "//host" or full URLs.
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || !hasViPrefix(pathname)) return path;
  const cut = path.search(/[?#]/);
  const base = cut < 0 ? path : path.slice(0, cut);
  const rest = cut < 0 ? "" : path.slice(cut);
  // "/?tab=jobs" → "/vi?tab=jobs" (not "/vi/?tab=jobs"); "/vi/jobs/1" stays as is (localePath strips then re-adds).
  return localePath(base || "/", "vi") + rest;
}
