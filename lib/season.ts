// Season system — the SINGLE source for "what time of year is it for this viewer" (landing / auth look,
// hero photo set, seasonal occasions in the catalog, trend radar, try-on advice, content bot).
//
// Pure and isomorphic (no prisma, no DOM at import time). Every date is evaluated in the MARKET'S OWN local
// calendar (America/New_York for US, Australia/Sydney for AU) — never UTC month/day: 2026-11-27T04:30Z is
// still Thanksgiving evening in New York, and 2026-11-30T14:00Z is already 1 December in Sydney.
//
// Calendar (inclusive, market-local, md = month*100 + day, T = US Thanksgiving day in November):
//   US: Dec 27 – Jan 1 nye · Jan 2 – Mar 19 us-winter · Sep 15 – T us-harvest · T+1 – Dec 26 us-holiday · else base
//   AU: Dec 27 – Jan 1 nye · Jan 2 – Feb 29 au-summer · Oct 15 – Nov 30 au-jacaranda · Dec 1 – 26 au-summer-festive
//       · else base (AU never gets harvest, winter or snow)
// Halloween is retired as a season AND as an occasion (owner decision, Nov 2026).
//
// The landing "/" and /auth/* are static HTML per language, so the season is applied before first paint by
// SEASON_BOOT (inline <head> script, same math as resolveSeason) and kept in sync by applySeason() when the
// viewer's market changes (market toggle, IP lookup, account market).
import { THEMES, themeInMarket, themeWindow } from "@/lib/studioThemes";

export type Market = "US" | "AU";
export type SeasonId = "base" | "us-harvest" | "us-holiday" | "nye" | "us-winter" | "au-jacaranda" | "au-summer-festive" | "au-summer";
export type MomentId = "tg-week" | "bfcm";

export const SEASON_IDS: readonly SeasonId[] = ["base", "us-harvest", "us-holiday", "nye", "us-winter", "au-jacaranda", "au-summer-festive", "au-summer"];
export const MARKET_TZ = { US: "America/New_York", AU: "Australia/Sydney" } as const;
export const RETIRED_OCCASIONS = ["halloween"] as const;
export type RetiredOccasion = (typeof RETIRED_OCCASIONS)[number];

export const isSeasonId = (v: unknown): v is SeasonId => typeof v === "string" && (SEASON_IDS as readonly string[]).includes(v);
export const isRetiredOccasion = (id: string | null | undefined): boolean => !!id && (RETIRED_OCCASIONS as readonly string[]).includes(id);

export const SEASONS: Record<SeasonId, { markets: Market[]; festive: boolean; label: { en: string; vi: string } }> = {
  base: { markets: ["US", "AU"], festive: false, label: { en: "Everyday", vi: "Thường ngày" } },
  "us-harvest": { markets: ["US"], festive: false, label: { en: "Fall and Thanksgiving", vi: "Mùa thu và Lễ Tạ Ơn" } },
  "us-holiday": { markets: ["US"], festive: true, label: { en: "Holiday season", vi: "Mùa lễ cuối năm" } },
  nye: { markets: ["US", "AU"], festive: true, label: { en: "New Year's Eve", vi: "Đón Năm Mới" } },
  "us-winter": { markets: ["US"], festive: false, label: { en: "Winter", vi: "Mùa đông" } },
  "au-jacaranda": { markets: ["AU"], festive: false, label: { en: "Jacaranda season", vi: "Mùa phượng tím" } },
  "au-summer-festive": { markets: ["AU"], festive: true, label: { en: "Summer Christmas", vi: "Giáng sinh mùa hè" } },
  "au-summer": { markets: ["AU"], festive: false, label: { en: "Summer", vi: "Mùa hè" } },
};

export interface LocalDate { y: number; m: number; d: number }
const DAY = 86_400_000;

/** Calendar date in the market's own time zone. */
export function marketLocalDate(market: Market, now: Date = new Date()): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MARKET_TZ[market], year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Day index (days since 1970-01-01) of a calendar date — for differences that cross month / year ends. */
export const dayNumber = (x: LocalDate) => Math.round(Date.UTC(x.y, x.m - 1, x.d) / DAY);
const fromDayNumber = (n: number): LocalDate => {
  const t = new Date(n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

/** US Thanksgiving: 4th Thursday of November → day of month (2026 → 26, 2027 → 25). */
export function thanksgiving(year: number): number {
  const w = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  return 1 + ((4 - w + 7) % 7) + 21;
}

/** Season for a market-local calendar date. */
export function seasonForDate(market: Market, date: LocalDate): SeasonId {
  const md = date.m * 100 + date.d;
  if (md >= 1227 || md <= 101) return "nye";
  if (market === "AU") {
    if (md <= 229) return "au-summer";
    if (md >= 1015 && md <= 1130) return "au-jacaranda";
    if (md >= 1201 && md <= 1226) return "au-summer-festive";
    return "base";
  }
  const T = 1100 + thanksgiving(date.y);
  if (md <= 319) return "us-winter";
  if (md >= 915 && md <= T) return "us-harvest";
  if (md > T && md <= 1226) return "us-holiday";
  return "base";
}

export function resolveSeason(market: Market, now: Date = new Date()): SeasonId {
  return seasonForDate(market, marketLocalDate(market, now));
}

/** Short retail moments inside a season: Thanksgiving week (US) and Black Friday → Cyber Monday (both markets). */
export function activeMoments(market: Market, now: Date = new Date()): MomentId[] {
  const today = marketLocalDate(market, now);
  const t = dayNumber(today);
  const T = dayNumber({ y: today.y, m: 11, d: thanksgiving(today.y) });
  const out: MomentId[] = [];
  if (market === "US" && t >= T - 3 && t <= T) out.push("tg-week");
  if (t >= T + 1 && t <= T + 4) out.push("bfcm");
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Occasions (content themes from lib/studioThemes.ts) in the market's local calendar.

/**
 * Window of occasion `id` for `market` that STARTS in `year` (end may fall in year+1 for windows that wrap the
 * new year). Computed overrides: fall (US) ends on Thanksgiving; thanksgiving (US) = T-11 → T+4; christmas
 * US = T+1 → Dec 25, AU = Dec 1 → Dec 25. Retired occasions and occasions not run in this market → null.
 */
export function occasionWindow(id: string, market: Market, year: number): { start: number; end: number } | null {
  if (isRetiredOccasion(id)) return null;
  const theme = THEMES.find((t) => t.id === id);
  if (!theme || !themeInMarket(theme, market)) return null;
  const T = thanksgiving(year);
  const at = (m: number, d: number, y = year) => dayNumber({ y, m, d });
  if (id === "fall" && market === "US") return { start: at(9, 15), end: at(11, T) };
  if (id === "thanksgiving") return { start: at(11, T) - 11, end: at(11, T) + 4 };
  if (id === "christmas") return market === "US" ? { start: at(11, T) + 1, end: at(12, 25) } : { start: at(12, 1), end: at(12, 25) };
  const w = themeWindow(theme, market);
  const wraps = w.from[0] * 100 + w.from[1] > w.to[0] * 100 + w.to[1];
  return { start: at(w.from[0], w.from[1]), end: at(w.to[0], w.to[1], wraps ? year + 1 : year) };
}

export interface ActiveOccasions {
  /** occasion ids running today (market-local), highest priority first */
  active: string[];
  /** occasions starting within `upcomingDays` days (startsIn ≥ 1), soonest first */
  upcoming: { id: string; startsIn: number }[];
}

export function activeOccasions(market: Market, now: Date = new Date(), opts: { upcomingDays?: number } = {}): ActiveOccasions {
  const upcomingDays = opts.upcomingDays ?? 21;
  const today = marketLocalDate(market, now);
  const t = dayNumber(today);
  const active: { id: string; priority: number; order: number }[] = [];
  const upcoming: { id: string; startsIn: number; priority: number }[] = [];
  THEMES.forEach((theme, order) => {
    let isActive = false;
    let soonest = Infinity;
    for (const y of [today.y - 1, today.y, today.y + 1]) {
      const w = occasionWindow(theme.id, market, y);
      if (!w) return;
      if (w.start <= t && t <= w.end) isActive = true;
      else if (w.start > t && w.start - t <= upcomingDays) soonest = Math.min(soonest, w.start - t);
    }
    if (isActive) active.push({ id: theme.id, priority: theme.priority, order });
    else if (soonest !== Infinity) upcoming.push({ id: theme.id, startsIn: soonest, priority: theme.priority });
  });
  active.sort((a, b) => b.priority - a.priority || a.order - b.order);
  upcoming.sort((a, b) => a.startsIn - b.startsIn || b.priority - a.priority);
  return { active: active.map((a) => a.id), upcoming: upcoming.map(({ id, startsIn }) => ({ id, startsIn })) };
}

/** Occasion is running or starts within `upcomingDays` for this market (THEMES ids only; others → true). */
export function occasionInWindow(id: string | null | undefined, market: Market, now: Date = new Date(), upcomingDays = 21): boolean {
  if (!id) return true;
  if (isRetiredOccasion(id)) return false;
  if (!THEMES.some((t) => t.id === id)) return true;
  const { active, upcoming } = activeOccasions(market, now, { upcomingDays });
  return active.includes(id) || upcoming.some((u) => u.id === id);
}

export { fromDayNumber };

// ---------------------------------------------------------------------------------------------------------------
// Before-first-paint boot (inline <head> script, appended in app/[lang]/layout.tsx).
// Market: cookie bitpaw_market → localStorage bitpaw_market → Australian / NZ time zone → first US/AU/NZ region
// in navigator.languages → "US" (exactly lib/market.ts guessMarketInBrowser: many Australians run en-US
// browsers, so the time zone is checked first). Then the market-local date + Thanksgiving + season exactly like
// seasonForDate(). Sets html[data-mkt] + html[data-season]; any failure → data-season="base".
// scripts/qa/season_unit.mts runs it in node:vm against resolveSeason for every day of 2026–2027, both markets.
export const SEASON_BOOT = String.raw`(()=>{try{var h=document.documentElement,m=(document.cookie.match(/bitpaw_market=(US|AU)/)||[])[1],p,k,T,s;if(!m)try{m=localStorage.bitpaw_market}catch{}if(m!="US"&&m!="AU")m=/^(Australia|Pacific\/(Auckland|Chatham))/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)||(p=/[-_](US|AU|NZ)\b/i.exec(navigator.languages+""))&&!/us/i.test(p[1])?"AU":"US";p=new Date().toLocaleDateString("en-US",{timeZone:m=="AU"?"Australia/Sydney":"America/New_York"}).split("/");k=p[0]*100+ +p[1];T=1122+(11-new Date(p[2],10,1).getDay())%7;s=m=="AU"?k<230?"summer":k>1014&&k<1131?"jacaranda":k>1200&&"summer-festive":k<320?"winter":k>914&&k<=T?"harvest":k>T&&"holiday";s=k>1226||k<102?"nye":s?m.toLowerCase()+"-"+s:"base";h.setAttribute("data-mkt",m)}catch{s="base"}try{h.setAttribute("data-season",s)}catch{}})()`;

/** Client: recompute the season for `market` now, update html[data-mkt|data-season] and notify listeners. */
export function applySeason(market: Market): SeasonId {
  const season = resolveSeason(market);
  if (typeof document === "undefined") return season;
  const h = document.documentElement;
  const changed = h.getAttribute("data-season") !== season || h.getAttribute("data-mkt") !== market;
  h.setAttribute("data-mkt", market);
  h.setAttribute("data-season", season);
  if (changed) window.dispatchEvent(new CustomEvent("pn-season", { detail: { market, season } }));
  return season;
}
