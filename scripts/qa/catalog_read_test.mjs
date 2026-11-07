// Catalog + feed READ PATHS with a forced clock, on a throwaway SQLite (never dev.db, never Turso):
//   env TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx tsx scripts/qa/catalog_read_test.mjs
// /api/designs (lib/designCatalog) is date- and market-aware and puts Google Flow pictures first across pages;
// ?occasion=halloween → []; the sitemap never lists retired or archived designs; an archived design page renders with
// noindex,follow + the "Last season" note while draft / rejected ids 404; the general feed hides stale official posts;
// the daily gallery posts only Flow designs and skips when fewer than 4 qualify.
import { useTempSqlite } from "./_temp_sqlite.ts";
import Module, { register } from "node:module";

// The design page pulls client components that import CSS (Navbar → marketing.css): stub .css for node (CJS + ESM).
Module._extensions[".css"] = (m) => { m.exports = {}; };
register("data:text/javascript," + encodeURIComponent('export async function load(u, c, n) { return u.endsWith(".css") ? { format: "module", source: "export default {}", shortCircuit: true } : n(u, c); }'));

const { db, cleanup } = useTempSqlite("catalog");
const { queryCatalog } = await import("../../lib/designCatalog.ts");
const { officialPostNot, dropStaleOfficial } = await import("../../lib/feedFreshness.ts");
const { publishDesignGallery, GALLERY_PREFIX } = await import("../../lib/designGallery.ts");

let fail = 0;
let n = 0;
const check = (id, desc, ok, detail = "") => {
  n++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + String(detail).slice(0, 400)}`);
  if (!ok) fail++;
};

// ---------------------------------------------------------------- seed
const admin = await db.user.create({ data: { name: "PawNail", email: "official@qa.test", password: "x", role: "ADMIN" } });
let seq = 0;
const T0 = Date.UTC(2026, 10, 1, 12);
const design = (o) => {
  seq++;
  const flow = !!o.flow;
  return db.nailDesign.create({
    data: {
      day: "2026-11-01", market: o.market ?? "US", occasion: o.occasion ?? null, title: `Mẫu ${seq}`, titleEn: `Design ${seq}`, description: "d", descriptionEn: "d",
      skills: "Gel-X", difficulty: o.difficulty ?? 2, minutes: 45, priceHint: "$45–60", materials: "[]", steps: "[]",
      imageUrl: o.noImage ? null : `https://img.qa.test/${flow ? "flow" : "render"}-${seq}.jpg`, provider: flow ? "flow" : "pawnail",
      prompt: flow ? `[flow:D${String(seq).padStart(3, "0")}:2026-11-01] brief` : `engine render ${seq}`,
      status: o.status ?? "published", publishedAt: new Date(T0 - seq * 3_600_000),
    },
  });
};
const flowIds = [];
for (let i = 0; i < 7; i++) flowIds.push((await design({ flow: true })).id);
const renderIds = [];
for (let i = 0; i < 6; i++) renderIds.push((await design({})).id);
await design({ occasion: "fall", flow: true });
await design({ occasion: "fall" });
await design({ occasion: "fall", market: "AU" });
await design({ occasion: "thanksgiving" });
await design({ occasion: "thanksgiving", flow: true });
const lingeringHw = (await design({ occasion: "halloween" })).id; // a Halloween row someone forgot to archive
await design({ occasion: "christmas", flow: true });
await design({ occasion: "christmas" });
await design({ occasion: "spring", market: "AU" });
await design({ occasion: "dragonboat" }); // non-THEMES occasion value → passes
const archivedHw = (await design({ occasion: "halloween", status: "archived" })).id;
const archivedFall = (await design({ occasion: "fall", status: "archived" })).id;
const draft = (await design({ status: "draft" })).id;
const rejected = (await design({ status: "rejected" })).id;

const allPages = async (q) => {
  const out = [];
  for (let offset = 0, guard = 0; guard < 50; guard++) {
    const r = await queryCatalog({ ...q, limit: 4, offset });
    out.push(...r.designs);
    if (!r.hasMore) break;
    offset += 4;
  }
  return out;
};
const at = (iso) => new Date(iso);

// ---------------------------------------------------------------- /api/designs
const auNov = await allPages({ market: "AU", now: at("2026-11-06T12:00:00Z") });
check("R1", `AU on 2026-11-06: 0 fall / thanksgiving / halloween rows (${auNov.length} rows)`, auNov.length > 0 && !auNov.some((d) => ["fall", "thanksgiving", "halloween"].includes(d.occasion)), auNov.map((d) => d.occasion).join(","));
const usDec = await allPages({ market: "US", now: at("2026-12-05T17:00:00Z") });
check("R2", `US on 2026-12-05: 0 fall / thanksgiving rows; christmas rows present (${usDec.length} rows)`, !usDec.some((d) => ["fall", "thanksgiving", "halloween"].includes(d.occasion)) && usDec.some((d) => d.occasion === "christmas"), usDec.map((d) => d.occasion).join(","));
const usNov = await allPages({ market: "US", now: at("2026-11-06T17:00:00Z") });
check("R3", "US on 2026-11-06: fall + thanksgiving (upcoming ≤ 21 d) shown, AU-only spring hidden, halloween never", usNov.some((d) => d.occasion === "fall") && usNov.some((d) => d.occasion === "thanksgiving") && !usNov.some((d) => d.occasion === "spring" || d.occasion === "halloween"));
const firstRender = usNov.findIndex((d) => !d.imageSource || d.imageSource !== "flow");
const lastFlow = usNov.map((d) => d.imageSource).lastIndexOf("flow");
const ids = usNov.map((d) => d.id);
check("R4", `Flow rows come before render rows across page boundaries, no duplicates (${usNov.filter((d) => d.imageSource === "flow").length} flow / ${usNov.length})`,
  lastFlow >= 0 && firstRender > lastFlow && new Set(ids).size === ids.length && flowIds.every((id) => ids.includes(id)), usNov.map((d) => d.imageSource).join(","));
const hw = await queryCatalog({ occasion: "halloween", limit: 30, offset: 0, now: at("2026-10-20T12:00:00Z") });
const hwNow = await queryCatalog({ occasion: "halloween", limit: 30, offset: 0, now: at("2026-11-06T12:00:00Z") });
check("R5", "?occasion=halloween → [] (any date)", hw.designs.length === 0 && hwNow.designs.length === 0 && !hw.hasMore);
const offWindow = await queryCatalog({ occasion: "christmas", market: "US", limit: 30, offset: 0, now: at("2026-10-01T12:00:00Z") });
check("R6", "?occasion=<out of window> → [] (christmas on Oct 1)", offWindow.designs.length === 0);
const noMarket = await allPages({ now: at("2026-11-06T17:00:00Z") });
check("R7", "No ?market= → union of both markets' windows (fall US + spring AU), still no halloween, non-theme occasions pass",
  noMarket.some((d) => d.occasion === "fall") && noMarket.some((d) => d.occasion === "spring") && noMarket.some((d) => d.occasion === "dragonboat") && !noMarket.some((d) => d.occasion === "halloween"));

// ---------------------------------------------------------------- sitemap
const sitemap = (await import("../../app/sitemap.ts")).default;
const sm = (await sitemap()).map((e) => e.url).join("\n");
check("R8", "sitemap.xml lists published designs only — no halloween, archived, draft or rejected ids",
  sm.includes(`/designs/${flowIds[0]}`) && ![lingeringHw, archivedHw, archivedFall, draft, rejected].some((id) => sm.includes(id)));

// ---------------------------------------------------------------- design page
const page = await import("../../app/[lang]/designs/[id]/page.tsx");
const params = (id) => Promise.resolve({ lang: "en", id });
const metaArchived = await page.generateMetadata({ params: params(archivedHw) });
const elArchived = await page.default({ params: params(archivedFall) });
const view = [].concat(elArchived?.props?.children ?? []).find((c) => c?.props && "archived" in c.props);
const live = await page.default({ params: params(flowIds[0]) });
const liveView = [].concat(live?.props?.children ?? []).find((c) => c?.props && "archived" in c.props);
const is404 = async (id) => { try { await page.default({ params: params(id) }); return false; } catch (e) { return /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/.test(String(e?.digest ?? e?.message)); } };
check("R9", "Archived design (incl. retired Halloween) renders: robots noindex,follow + archived note; related list excludes retired/archived; live page indexable",
  metaArchived?.robots?.index === false && metaArchived?.robots?.follow === true && view?.props?.archived === true &&
  !view.props.related.some((r) => [lingeringHw, archivedHw, archivedFall].includes(r.id) || r.occasion === "halloween") && liveView?.props?.archived === false,
  JSON.stringify({ robots: metaArchived?.robots, archived: view?.props?.archived }));
check("R10", "Draft and rejected design ids still 404", (await is404(draft)) && (await is404(rejected)));

// ---------------------------------------------------------------- feed freshness
const NOW = at("2026-11-06T17:00:00Z");
const post = (content, o = {}) => db.post.create({ data: { authorId: admin.id, content, mediaUrls: JSON.stringify(o.media ?? []), market: o.market ?? null, createdAt: new Date(NOW.getTime() - (o.hoursAgo ?? 1) * 3_600_000) } });
const designs = await db.nailDesign.findMany({ select: { id: true, imageUrl: true, status: true } });
const pubUrl = designs.find((d) => d.id === flowIds[0]).imageUrl;
const archUrl = designs.find((d) => d.id === archivedFall).imageUrl;
const p = {
  oldGallery: await post(`${GALLERY_PREFIX} đáng thử hôm nay`, { hoursAgo: 80, media: [pubUrl] }),
  freshGallery: await post(`${GALLERY_PREFIX} quanh năm`, { hoursAgo: 5, media: [pubUrl] }),
  deadGallery: await post(`${GALLERY_PREFIX} dễ làm`, { hoursAgo: 6, media: [archUrl] }),
  hw: await post("🎃 Mùa Halloween đã tới — 4 mẫu mới", { hoursAgo: 200 }),
  hwWord: await post("Tips: Halloween sets sell out", { hoursAgo: 3 }),
  fallAU: await post("🍂 Bộ sưu tập Móng mùa thu đã lên PawNail — có sẵn vật tư & cách làm", { market: "AU", hoursAgo: 2 }),
  fallUS: await post("🍂 Bộ sưu tập Móng mùa thu đã lên PawNail — có sẵn vật tư & cách làm", { market: "US", hoursAgo: 2 }),
  xmasAny: await post("🎄 Bộ sưu tập Giáng Sinh đã lên PawNail — có sẵn vật tư & cách làm", { hoursAgo: 2 }),
  normal: await post("📍 Việc làm mới tuần này", { hoursAgo: 2 }),
};
const feed = async (market, now) => {
  const rows = await db.post.findMany({ where: { status: "published", NOT: officialPostNot(now, true) }, include: { author: { select: { role: true } } }, orderBy: { createdAt: "desc" } });
  return (await dropStaleOfficial(rows, market, now)).map((r) => r.id);
};
const usFeed = await feed("US", NOW);
const auFeed = await feed("AU", NOW);
const has = (f, k) => f.includes(p[k].id);
check("R11", "General feed hides official gallery posts older than 72 h and every official Halloween / 🎃 post", !has(usFeed, "oldGallery") && has(usFeed, "freshGallery") && !has(usFeed, "hw") && !has(usFeed, "hwWord") && has(usFeed, "normal"));
check("R12", "Theme-collection posts out of window for their market disappear (fall in AU in November), in-window ones stay (fall US; Christmas upcoming ≤ 21 d)",
  !has(auFeed, "fallAU") && has(usFeed, "fallUS") && has(usFeed, "xmasAny"));
const earlyOct = await feed("US", at("2026-10-01T17:00:00Z"));
check("R13", "Christmas collection post is hidden while Christmas is neither running nor ≤ 21 d away (Oct 1, US)", !earlyOct.includes(p.xmasAny.id));
check("R14", "Gallery posts whose pictures are all unpublished disappear", !has(usFeed, "deadGallery"));
const profileNot = officialPostNot(NOW, false);
check("R15", "A profile page (authorId) keeps old gallery posts but still drops Halloween", profileNot.length === 2);

// ---------------------------------------------------------------- daily gallery: Flow only, ≥ 4 or skip
process.env.OFFICIAL_ACCOUNT_ID = admin.id;
await db.post.deleteMany({ where: { content: { startsWith: GALLERY_PREFIX } } });
// leave only 3 eligible Flow designs: un-publish the rest of the Flow rows
const flowAll = (await db.nailDesign.findMany({ where: { prompt: { contains: "[flow:" }, status: "published" }, select: { id: true } })).map((d) => d.id);
await db.nailDesign.updateMany({ where: { id: { in: flowAll.slice(3) } }, data: { status: "draft" } });
const g1 = await publishDesignGallery(at("2026-11-06T15:00:00Z"));
check("R16", `Daily gallery skips the day when fewer than 4 Flow designs qualify (${g1.reason ?? "posted"})`, g1.posted === false && g1.reason === "chưa đủ 4 mẫu Flow");
await db.nailDesign.updateMany({ where: { id: { in: flowAll } }, data: { status: "published" } });
const g2 = await publishDesignGallery(at("2026-11-06T15:00:00Z"));
const gp = await db.post.findFirst({ where: { content: { startsWith: GALLERY_PREFIX } }, orderBy: { createdAt: "desc" } });
const media = JSON.parse(gp?.mediaUrls ?? "[]");
const flowUrls = new Set((await db.nailDesign.findMany({ where: { prompt: { contains: "[flow:" } }, select: { imageUrl: true } })).map((d) => d.imageUrl));
check("R17", "Daily gallery posts 4 Flow designs only (never engine renders, never Halloween)", g2.posted === true && media.length === 4 && media.every((u) => flowUrls.has(u)) && !/Halloween/.test(gp.content), JSON.stringify(g2));

await cleanup();
console.log(fail ? `\nCatalog read paths: ${fail}/${n} FAILED` : `\nCatalog read paths: ${n}/${n} PASS`);
process.exit(fail ? 1 : 0);
