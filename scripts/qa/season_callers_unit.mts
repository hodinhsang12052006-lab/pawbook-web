// Halloween retired + market-local season callers — no server, no DB writes:
//   env TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= CRON_SECRET=x npx tsx scripts/qa/season_callers_unit.mts
// Every day 2026-11-01 … 2027-02-28 × US / AU: activeThemes, upcomingThemes, activeTrends, adviceLooks motifs, sticker
// packs and samplesInSeason never offer Halloween; AU Dec–Feb never gets fall / snow / velvet / plaid; US Christmas
// only from Thanksgiving + 1 (or as an upcoming occasion ≤ 21 days ahead). Plus: no UTC month/day season math left,
// and GET /api/cron/designs?occasion=halloween → 400.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeThemes } from "../../lib/contentEngine";
import { upcomingThemes } from "../../lib/aiDesigns";
import { activeTrends } from "../../lib/trendRadar";
import { adviceLooks, type HandProfile } from "../../lib/tryon/advice";
import { STICKER_PACKS, EMOJI_GROUPS } from "../../lib/chatStickers";
import { samplesInSeason, SAMPLE_DESIGNS } from "../../lib/designSamples";
import { THEMES, designFitsMarket } from "../../lib/studioThemes";
import { marketLocalDate, thanksgiving, type Market } from "../../lib/season";

let fail = 0;
let n = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
  n++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail}`);
  if (!ok) fail++;
};

const HW = /halloween|🎃|pumpkin|jack-?o|ghost|\bbats?\b|spider|spooky|bí ngô|\bma\b|dơi|mạng nhện/i;
const HW_PATTERNS = new Set(["web", "ghost", "jackolantern", "bats", "skull", "slimedrip", "moonstars", "blackcat", "mummy", "candycorn", "eyeball", "witchy", "stitches", "mix-halloween"]);
const AU_SUMMER_NO = new Set(["snow", "plaid", "velvet", "fawn", "tortoise"]);
const profiles: HandProfile[] = [
  { undertone: "warm", depth: "deep", skinHex: "#6b4a3a", nails: 5, ratio: 0.85, length: "short", tip: "round", polishHex: null },
  { undertone: "cool", depth: "fair", skinHex: "#f1d6c8", nails: 5, ratio: 1.1, length: "long", tip: "almond", polishHex: null },
  { undertone: "neutral", depth: "medium", skinHex: "#c99a7a", nails: 4, ratio: 1, length: "medium", tip: "square", polishHex: null },
];

const hw: string[] = [];
const auBad: string[] = [];
const usXmasEarly: string[] = [];
let days = 0;
for (let t = Date.UTC(2026, 10, 1, 15); t <= Date.UTC(2027, 1, 28, 15); t += 86_400_000) {
  days++;
  const now = new Date(t);
  for (const m of ["US", "AU"] as Market[]) {
    const loc = marketLocalDate(m, now);
    const tag = `${loc.y}-${String(loc.m).padStart(2, "0")}-${String(loc.d).padStart(2, "0")} ${m}`;
    const themes = activeThemes(now, m);
    const up = upcomingThemes(m, now);
    const trends = activeTrends(now, m);
    const samples = samplesInSeason(m, now);
    const looks = profiles.flatMap((p, i) => [`s${i}`, `t${i}`].flatMap((salt) => adviceLooks(p, m, `${tag}-${salt}`, false, now)));
    // ---- Halloween never ----
    const text = [
      ...themes.map((x) => `${x.id} ${x.title}`),
      ...up.map((x) => `${x.id} ${x.title} ${x.emoji}`),
      ...trends.map((x) => `${x.id} ${x.occasion ?? ""} ${x.name.en} ${x.source.en}`),
      ...samples.map((x) => `${x.occasion ?? ""} ${x.title.en}`),
      ...looks.map((x) => `${x.tag.en} ${x.why.en}`),
    ];
    const hit = text.find((s) => HW.test(s)) ?? looks.find((x) => HW_PATTERNS.has(x.pattern))?.pattern ?? trends.flatMap((x) => x.looks).find((l) => HW_PATTERNS.has(l.pattern))?.pattern;
    if (hit) hw.push(`${tag}: ${hit}`);
    // ---- AU Dec–Feb: no fall / snow / velvet / plaid ----
    if (m === "AU" && (loc.m === 12 || loc.m <= 2)) {
      const bad = [
        ...themes.filter((x) => x.id === "fall" || x.id === "thanksgiving").map((x) => `theme ${x.id}`),
        ...up.filter((x) => x.id === "fall" || x.id === "thanksgiving").map((x) => `upcoming ${x.id}`),
        ...trends.filter((x) => x.id.startsWith("fall-") || x.looks.some((l) => AU_SUMMER_NO.has(l.pattern))).map((x) => `trend ${x.id}`),
        ...looks.filter((x) => AU_SUMMER_NO.has(x.pattern) || /\bsnow|plaid|tartan|velvet|tortoise|fall\b/i.test(x.why.en)).map((x) => `look ${x.pattern}`),
        ...samples.filter((x) => x.occasion === "fall").map((x) => `sample ${x.title.en}`),
      ];
      if (bad.length) auBad.push(`${tag}: ${bad.slice(0, 3).join(", ")}`);
    }
    // ---- US Christmas only from Thanksgiving + 1 (or upcoming within 21 days) ----
    if (m === "US" && loc.m === 11) {
      const T = thanksgiving(loc.y);
      const xmasNow = themes.some((x) => x.id === "christmas") || up.some((x) => x.id === "christmas" && x.startsIn === 0);
      const xmasUp = up.find((x) => x.id === "christmas");
      if (loc.d <= T && xmasNow) usXmasEarly.push(`${tag}: active before T+1`);
      if (xmasUp && xmasUp.startsIn > 0 && (xmasUp.startsIn > 21 || loc.d + xmasUp.startsIn !== T + 1)) usXmasEarly.push(`${tag}: upcoming startsIn ${xmasUp.startsIn}`);
      if (loc.d > T && !themes.some((x) => x.id === "christmas")) usXmasEarly.push(`${tag}: not active after Thanksgiving`);
      const xmasLook = looks.find((x) => x.tag.en === "Christmas");
      if (xmasLook && !(loc.d > T || (xmasUp && xmasUp.startsIn > 0))) usXmasEarly.push(`${tag}: Christmas motif before window`);
    }
  }
}
check("C1", `Halloween / 🎃 / pumpkin / ghost / bats never offered (${days} days × US/AU: themes, upcoming, trends, samples, try-on advice)`, hw.length === 0, hw.slice(0, 5).join(" | "));
check("C2", "AU Dec–Feb: no fall, snow, velvet or plaid (themes, trends, advice motifs, samples)", auBad.length === 0, auBad.slice(0, 5).join(" | "));
check("C3", "US Christmas only from Thanksgiving + 1, or as upcoming (startsIn > 0, ≤ 21 d)", usXmasEarly.length === 0, usXmasEarly.slice(0, 5).join(" | "));

const party = STICKER_PACKS.find((p) => p.id === "party")!;
const fun = EMOJI_GROUPS.find((g) => g.id === "fun")!;
check("C4", "Sticker packs: no 🎃 / 👻 in 'party'; no 🎃 in emoji group 'fun'", !party.items.includes("🎃") && !party.items.includes("👻") && !fun.items.includes("🎃") && !STICKER_PACKS.some((p) => p.items.includes("🎃")));
check("C5", "No Halloween sample, theme or market fit for a Halloween design", !SAMPLE_DESIGNS.some((d) => d.occasion === "halloween") && !THEMES.some((t) => t.id === "halloween") && !designFitsMarket({ occasion: "halloween", market: "US" }, "US"));

// ---- UTC month/day season math is gone from the callers ----
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const utcHits = ["lib/contentEngine.ts", "lib/aiDesigns.ts", "lib/trendRadar.ts", "lib/tryon/advice.ts"].flatMap((f) =>
  fs.readFileSync(path.join(root, f), "utf8").split("\n").map((line, i) => [f, i + 1, line] as const).filter(([, , line]) => /getUTCMonth|getUTCDate/.test(line)).map(([f, i]) => `${f}:${i}`));
check("C6", "No getUTCMonth / getUTCDate season math in contentEngine, aiDesigns, trendRadar, tryon/advice", utcHits.length === 0, utcHits.join(", "));

// ---- cron rejects the retired occasion ----
{
  process.env.CRON_SECRET = process.env.CRON_SECRET || "season-unit";
  const { GET } = await import("../../app/api/cron/designs/route");
  const res = await GET(new Request("http://localhost/api/cron/designs?occasion=halloween&count=10", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  check("C7", `GET /api/cron/designs?occasion=halloween → 400 (got ${res.status})`, res.status === 400);
}

console.log(fail ? `\nSeason callers: ${fail}/${n} FAILED` : `\nSeason callers: ${n}/${n} PASS`);
process.exit(fail ? 1 : 0);
