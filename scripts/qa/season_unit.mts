// Season core (lib/season.ts) — no server, no DB:  npx tsx scripts/qa/season_unit.mts
// SEASON_BOOT (the inline <head> script) is executed in node:vm with a mocked Date / Intl / document / cookie /
// localStorage / navigator for EVERY day of 2026–2027 in both markets and must agree with resolveSeason().
import vm from "node:vm";
import { SEASON_BOOT, SEASON_IDS, SEASONS, resolveSeason, thanksgiving, activeMoments, applySeason, marketLocalDate, type Market } from "../../lib/season";
import { guessMarketInBrowser } from "../../lib/market";

let fail = 0;
let n = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
  n++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail}`);
  if (!ok) fail++;
};

const RealDate = Date;
const RealIntl = Intl;
/** Run SEASON_BOOT at instant `iso` with the given browser state; returns the html attributes it set. */
function boot(iso: string, env: { cookie?: string; ls?: Record<string, string>; tz?: string; langs?: string[]; throwCookie?: boolean } = {}) {
  const fixed = new RealDate(iso).getTime();
  class FakeDate extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(fixed);
      else super(...(a as [number, number, number]));
    }
    static now() { return fixed; }
  }
  const attrs: Record<string, string> = {};
  const documentElement = { setAttribute: (k: string, v: string) => { attrs[k] = v; }, getAttribute: (k: string) => attrs[k] ?? null };
  const document = env.throwCookie
    ? { documentElement, get cookie(): string { throw new Error("SecurityError"); } }
    : { documentElement, cookie: env.cookie ?? "" };
  const FakeIntl = Object.create(RealIntl);
  FakeIntl.DateTimeFormat = function (...a: unknown[]) {
    if (a.length === 0) return { resolvedOptions: () => ({ timeZone: env.tz ?? "UTC" }) };
    return new RealIntl.DateTimeFormat(...(a as [string, Intl.DateTimeFormatOptions]));
  };
  const ctx = vm.createContext({ document, localStorage: env.ls ?? {}, navigator: { languages: env.langs ?? ["en"] }, Date: FakeDate, Intl: FakeIntl });
  vm.runInContext(SEASON_BOOT, ctx);
  return attrs;
}

// ---- size + parse ----
check("S1", `SEASON_BOOT ≤ 800 bytes (${Buffer.byteLength(SEASON_BOOT)})`, Buffer.byteLength(SEASON_BOOT) <= 800);
check("S2", "thanksgiving(2026) = 26, thanksgiving(2027) = 25, (2028) = 23", thanksgiving(2026) === 26 && thanksgiving(2027) === 25 && thanksgiving(2028) === 23);

// ---- every day of 2026–2027, both markets, two instants per day (different local dates in NY vs Sydney) ----
const mismatches: string[] = [];
let days = 0;
const auSeen = new Set<string>();
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 86_400_000) {
  days++;
  for (const hour of [3, 15]) {
    const iso = new RealDate(t + hour * 3_600_000).toISOString();
    for (const m of ["US", "AU"] as Market[]) {
      const want = resolveSeason(m, new RealDate(iso));
      const got = boot(iso, { cookie: `x=1; bitpaw_market=${m}; y=2` });
      if (m === "AU") auSeen.add(want);
      if (got["data-season"] !== want || got["data-mkt"] !== m) mismatches.push(`${iso} ${m}: boot ${got["data-season"]}/${got["data-mkt"]} vs ${want}`);
    }
  }
}
check("S3", `boot == resolveSeason for every day of 2026–2027 × US/AU × 2 instants (${days} days)`, mismatches.length === 0, mismatches.slice(0, 5).join(" | "));
check("S4", `AU never resolves to a US / harvest / winter / snow season (seen: ${[...auSeen].join(", ")})`, [...auSeen].every((s) => !/^us-|harvest|winter|snow/.test(s)) && auSeen.has("au-jacaranda") && auSeen.has("au-summer-festive") && auSeen.has("au-summer"));

// ---- fixed dates ----
const at = (iso: string, m: Market) => resolveSeason(m, new RealDate(iso));
check("S5", "2026-11-06 → US us-harvest, AU au-jacaranda", at("2026-11-06T12:00:00Z", "US") === "us-harvest" && at("2026-11-06T12:00:00Z", "AU") === "au-jacaranda");
check("S6", "2026-11-26 (Thanksgiving) US us-harvest; 2026-11-27 us-holiday", at("2026-11-26T17:00:00Z", "US") === "us-harvest" && at("2026-11-27T17:00:00Z", "US") === "us-holiday");
check("S7", "2026-11-27T04:30Z is still Nov 26 in New York → us-harvest", at("2026-11-27T04:30:00Z", "US") === "us-harvest" && boot("2026-11-27T04:30:00Z", { cookie: "bitpaw_market=US" })["data-season"] === "us-harvest");
check("S8", "2026-11-30T14:00Z is Dec 1 in Sydney → au-summer-festive", at("2026-11-30T14:00:00Z", "AU") === "au-summer-festive" && boot("2026-11-30T14:00:00Z", { cookie: "bitpaw_market=AU" })["data-season"] === "au-summer-festive");
const noonNY = (d: string) => `${d}T17:00:00Z`;
const noonSyd = (d: string) => `${d}T01:00:00Z`;
check("S9", "US boundaries: Dec 26 holiday · Dec 27 nye · Jan 1 nye · Jan 2 winter · Mar 19 winter · Mar 20 base · Sep 14 base · Sep 15 harvest",
  at(noonNY("2026-12-26"), "US") === "us-holiday" && at(noonNY("2026-12-27"), "US") === "nye" && at(noonNY("2027-01-01"), "US") === "nye" && at(noonNY("2027-01-02"), "US") === "us-winter"
  && at(noonNY("2027-03-19"), "US") === "us-winter" && at(noonNY("2027-03-20"), "US") === "base" && at(noonNY("2027-09-14"), "US") === "base" && at(noonNY("2027-09-15"), "US") === "us-harvest");
check("S10", "AU boundaries: Dec 26 festive · Dec 27 nye · Jan 1 nye · Jan 2 summer · Feb 28 summer · Mar 1 base · Oct 14 base · Oct 15 jacaranda · Nov 30 jacaranda · Dec 1 festive",
  at(noonSyd("2026-12-26"), "AU") === "au-summer-festive" && at(noonSyd("2026-12-27"), "AU") === "nye" && at(noonSyd("2027-01-01"), "AU") === "nye" && at(noonSyd("2027-01-02"), "AU") === "au-summer"
  && at(noonSyd("2027-02-28"), "AU") === "au-summer" && at(noonSyd("2027-03-01"), "AU") === "base" && at(noonSyd("2027-10-14"), "AU") === "base" && at(noonSyd("2027-10-15"), "AU") === "au-jacaranda"
  && at(noonSyd("2026-11-30"), "AU") === "au-jacaranda" && at(noonSyd("2026-12-01"), "AU") === "au-summer-festive");
check("S11", "'halloween' is not a SeasonId; every season lists its markets", !(SEASON_IDS as readonly string[]).includes("halloween") && SEASON_IDS.every((s) => SEASONS[s].markets.length > 0));

// ---- moments ----
const momentDays = (m: Market, id: "tg-week" | "bfcm") => {
  const out: string[] = [];
  for (let d = 15; d <= 30; d++) {
    const iso = m === "US" ? noonNY(`2026-11-${String(d).padStart(2, "0")}`) : noonSyd(`2026-11-${String(d).padStart(2, "0")}`);
    if (activeMoments(m, new RealDate(iso)).includes(id)) out.push(String(d));
  }
  for (let d = 1; d <= 5; d++) if (activeMoments(m, new RealDate(m === "US" ? noonNY(`2026-12-0${d}`) : noonSyd(`2026-12-0${d}`))).includes(id)) out.push(`12/${d}`);
  return out.join(",");
};
check("S12", `tg-week = Nov 23–26 2026, US only (US ${momentDays("US", "tg-week")} · AU ${momentDays("AU", "tg-week") || "none"})`, momentDays("US", "tg-week") === "23,24,25,26" && momentDays("AU", "tg-week") === "");
check("S13", `bfcm = Nov 27–30 2026 in both markets (US ${momentDays("US", "bfcm")} · AU ${momentDays("AU", "bfcm")})`, momentDays("US", "bfcm") === "27,28,29,30" && momentDays("AU", "bfcm") === "27,28,29,30");

// ---- market detection in the boot ----
const syd = boot("2026-11-06T12:00:00Z", { tz: "Australia/Sydney", langs: ["en-US", "en"] });
check("S14", "No cookie: time zone Australia/Sydney with en-US languages → AU (au-jacaranda)", syd["data-mkt"] === "AU" && syd["data-season"] === "au-jacaranda", JSON.stringify(syd));
const ny = boot("2026-11-06T12:00:00Z", { tz: "America/Chicago", langs: ["vi-VN", "en-US"] });
const lang = boot("2026-11-06T12:00:00Z", { tz: "Europe/London", langs: ["vi", "en-AU"] });
const fallback = boot("2026-11-06T12:00:00Z", { tz: "Asia/Ho_Chi_Minh", langs: ["vi-VN", "vi"] });
const ls = boot("2026-11-06T12:00:00Z", { tz: "America/New_York", ls: { bitpaw_market: "AU" } });
const ck = boot("2026-11-06T12:00:00Z", { tz: "Australia/Perth", cookie: "bitpaw_market=US" });
check("S15", "cookie > localStorage > time zone > languages > US", ny["data-mkt"] === "US" && lang["data-mkt"] === "AU" && fallback["data-mkt"] === "US" && ls["data-mkt"] === "AU" && ck["data-mkt"] === "US",
  JSON.stringify({ ny, lang, fallback, ls, ck }));
const broken = boot("2026-11-06T12:00:00Z", { throwCookie: true });
check("S16", "Any failure inside the boot → data-season=base (no throw)", broken["data-season"] === "base");

// ---- guessMarketInBrowser uses the same order as the boot ----
function guess(tz: string, langs: string[]) {
  const g = globalThis as unknown as { navigator?: unknown };
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const prevDTF = Intl.DateTimeFormat;
  Object.defineProperty(globalThis, "navigator", { value: { languages: langs, language: langs[0] }, configurable: true, writable: true });
  (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = function (...a: unknown[]) {
    if (a.length === 0) return { resolvedOptions: () => ({ timeZone: tz }) };
    return new prevDTF(...(a as [string]));
  };
  try {
    return guessMarketInBrowser() ?? "US";
  } finally {
    (Intl as unknown as { DateTimeFormat: unknown }).DateTimeFormat = prevDTF;
    if (prevNav) Object.defineProperty(globalThis, "navigator", prevNav);
    else delete g.navigator;
  }
}
const cases: [string, string[]][] = [["Australia/Sydney", ["en-US"]], ["America/Chicago", ["en-AU"]], ["Europe/London", ["vi", "en-AU"]], ["Asia/Ho_Chi_Minh", ["vi-VN"]], ["Pacific/Auckland", ["en-NZ"]], ["America/Los_Angeles", ["en-US"]]];
const disagree = cases.filter(([tz, langs]) => guess(tz, langs) !== boot("2026-11-06T12:00:00Z", { tz, langs })["data-mkt"]);
check("S17", "guessMarketInBrowser() and SEASON_BOOT pick the same market (time zone first, then languages)", disagree.length === 0, disagree.map((c) => c.join(" ")).join(" | "));

// ---- applySeason (client) ----
{
  const attrs: Record<string, string> = {};
  const events: string[] = [];
  const g = globalThis as Record<string, unknown>;
  g.document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; }, getAttribute: (k: string) => attrs[k] ?? null } };
  g.window = { dispatchEvent: (e: { type: string }) => events.push(e.type) };
  const a = applySeason("AU");
  const aAttrs = { ...attrs };
  const b = applySeason("US");
  const c = applySeason("US");
  delete g.document;
  delete g.window;
  check("S18", "applySeason(m) updates html[data-mkt|data-season] in place and fires pn-season only on change",
    aAttrs["data-mkt"] === "AU" && aAttrs["data-season"] === a && attrs["data-mkt"] === "US" && attrs["data-season"] === b && b === c && events.length === 2 && events.every((e) => e === "pn-season"),
    JSON.stringify({ aAttrs, attrs, events }));
}

// ---- market-local date sanity ----
const d1 = marketLocalDate("AU", new RealDate("2026-12-31T13:30:00Z"));
const d2 = marketLocalDate("US", new RealDate("2027-01-01T04:59:00Z"));
check("S19", "marketLocalDate crosses the new year in each zone", d1.y === 2027 && d1.m === 1 && d1.d === 1 && d2.y === 2026 && d2.m === 12 && d2.d === 31, JSON.stringify({ d1, d2 }));

console.log(fail ? `\nSeason core: ${fail}/${n} FAILED` : `\nSeason core: ${n}/${n} PASS`);
process.exit(fail ? 1 : 0);
