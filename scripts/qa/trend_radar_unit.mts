// Kiểm thử RADAR TREND (lib/trendRadar) + máy tạo mẫu chạy ngầm mỗi ngày (lib/designEngine):
// công thức trend hợp lệ & máy PawNail VẼ ĐƯỢC; ~1/2 mẫu mỗi ngày lấy từ radar, ghi đúng nguồn; trend theo mùa chỉ
// xuất hiện đúng mùa; dịp lễ đang diễn ra vẫn có mẫu; xoay vòng theo ngày (mỗi ngày bộ khác).
//   npx tsx scripts/qa/trend_radar_unit.mts
import { TREND_RADAR, activeTrends } from "../../lib/trendRadar";
import { generateEngineDesigns, COLORS, PATTERN_IDS, paletteOk, finishOk, patternShapes, RETIRED_PATTERNS } from "../../lib/designEngine";
import { PROCEDURAL } from "../../lib/tryon/patterns";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`); };

const bad: string[] = [];
for (const t of TREND_RADAR) {
  if (!t.name.vi || !t.name.en || !t.source.vi || !t.source.en) bad.push(`${t.id}: thiếu tên / nguồn`);
  for (const l of t.looks) {
    if (!PATTERN_IDS.includes(l.pattern)) bad.push(`${t.id}: hoạ tiết lạ ${l.pattern}`);
    if (!PROCEDURAL.has(l.pattern)) bad.push(`${t.id}: ${l.pattern} máy chưa tự vẽ được`);
    for (const c of l.colors.flat()) if (!(c in COLORS)) bad.push(`${t.id}: màu lạ ${c}`);
  }
}
ok("T1", `${TREND_RADAR.length} trend trong radar: đủ tên song ngữ + nguồn; mọi công thức dùng hoạ tiết có thật mà máy PawNail tự vẽ được, màu có trong bảng màu`, !bad.length && TREND_RADAR.length >= 30, bad.join(" | "));

const withNumbers = TREND_RADAR.filter((t) => /\+\d|tăng \d/.test(t.source.vi));
ok("T2", `Trend có số liệu ghi đúng nguồn (Pinterest Predicts 2026): ${withNumbers.length} trend`, withNumbers.length >= 15 && withNumbers.every((t) => /Pinterest/.test(t.source.vi)));

const months = Array.from({ length: 12 }, (_, i) => activeTrends(new Date(Date.UTC(2026, i, 15))).length);
const oct = activeTrends(new Date(Date.UTC(2026, 9, 25))).map((t) => t.id), jun = activeTrends(new Date(Date.UTC(2026, 5, 15))).map((t) => t.id), dec = activeTrends(new Date(Date.UTC(2026, 11, 10))).map((t) => t.id);
ok("T3", `Trend theo mùa đúng mùa: tháng 10 có Halloween, tháng 6 không; tháng 12 có Giáng sinh; tháng nào cũng ≥ 20 trend (${months.join("/")})`,
  oct.some((x) => x.startsWith("hw-")) && !jun.some((x) => x.startsWith("hw-") || x.startsWith("xmas-")) && dec.some((x) => x.startsWith("xmas-")) && months.every((n) => n >= 20));

const day = (date: string, salt = "0", occ = true) => generateEngineDesigns(6, { market: "US", date, occasions: occ ? [{ id: "halloween", title: "Halloween", emoji: "🎃", startsIn: 0 }] : [], risingTags: [], usedTitles: new Set(), salt });
const d1 = day("2026-10-25");
const radarN = d1.filter((d) => /\(Pinterest|\(Trend thu|\(Halloween|\(Màu của năm/.test(d.description.vi)).length;
const hw = d1.filter((d) => d.occasion === "halloween" || /Halloween/.test(d.description.vi)).length;
ok("T4", `1 lượt 6 mẫu (25/10): ${radarN} mẫu từ radar trend có ghi nguồn, ${hw} mẫu Halloween, không trùng tên`,
  radarN >= 2 && hw >= 1 && new Set(d1.map((d) => d.title.vi)).size === d1.length, d1.map((d) => d.title.vi).join(" | "));

const days = ["2026-10-20", "2026-10-21", "2026-10-22"].map((dt) => day(dt).map((d) => d.title.vi).join("|"));
ok("T5", "Mỗi ngày ra bộ mẫu khác (xoay vòng theo ngày — chạy ngầm không lặp lại)", new Set(days).size === 3);

const summer = Array.from({ length: 8 }, (_, i) => day("2026-07-1" + i, String(i), false)).flat();
ok("T6", "Mùa hè không lòi mẫu Halloween / Giáng sinh từ radar", !summer.some((d) => /Halloween|Giáng sinh/.test(d.description.vi)), summer.filter((d) => /Halloween|Giáng sinh/.test(d.description.vi)).map((d) => d.title.vi).join(" | "));

const all = Array.from({ length: 10 }, (_, i) => day("2026-10-25", String(i))).flat();
const drawable = all.filter((d) => PROCEDURAL.has(d.pattern)).length / all.length;
ok("T7", `Phần lớn mẫu mỗi ngày máy PawNail tự vẽ được ảnh (${Math.round(drawable * 100)}% ≥ 80%) — ít phải nhờ AI vẽ`, drawable >= 0.8);

// dâu nhúng sô-cô-la: nền LUÔN màu dâu (đỏ / hồng), đầu LUÔN sô-cô-la — từng ra "dâu nhúng" nền navy / xanh rêu / nâu
const BERRY = new Set((["strawberry", "cherry", "raspberry", "babyPink", "pinkNude"] as const).map((k) => COLORS[k].hex as string));
const choco = Array.from({ length: 40 }, (_, i) => ["2026-02-10", "2026-06-10", "2026-10-25"].flatMap((dt) => generateEngineDesigns(6, { market: "US", date: dt, occasions: [], risingTags: [], usedTitles: new Set(), salt: String(i) }))).flat().filter((d) => d.pattern === "chocodip");
ok("T8", `Dâu nhúng sô-cô-la (${choco.length} mẫu): nền luôn màu dâu đỏ / hồng, đầu móng luôn nâu sô-cô-la`, choco.length >= 3 && choco.every((d) => BERRY.has(d.palette[0]) && d.palette[1] === COLORS.chocolate.hex), choco.filter((d) => !BERRY.has(d.palette[0])).map((d) => d.title.vi).join(" | "));
// trend tên "vân đá" phải ra mẫu vân đá thật (không ra móng trơn mượn tên trend)
const misnamed = TREND_RADAR.filter((t) => /vân đá/i.test(t.name.vi) && t.looks.some((l) => l.pattern !== "marble")).map((t) => t.id);
ok("T9", "Tên trend khớp mẫu vẽ ra (trend \"vân đá\" chỉ ra vân đá)", !misnamed.length, misnamed.join(","));


// công thức radar phải qua đúng luật của máy tạo mẫu (vai màu + tương phản CIELAB, hiệu ứng hợp nền, dáng được phép) —
// look nào trượt luật thì máy lặng lẽ bỏ, trend đó "chết" mà không ai biết
const dead: string[] = [];
for (const t of TREND_RADAR) for (const l of t.looks) {
  if (RETIRED_PATTERNS().includes(l.pattern)) dead.push(`${t.id}: ${l.pattern} đã nghỉ`);
  for (const c of l.colors) {
    if (!paletteOk(l.pattern, c)) dead.push(`${t.id}: ${l.pattern} ${c.join("/")} chìm / sai vai màu`);
    if (!finishOk(l.pattern, COLORS[c[0] as keyof typeof COLORS].hex, l.finish)) dead.push(`${t.id}: ${l.pattern} ${l.finish} trên ${c[0]}`);
  }
  for (const sh of l.shapes ?? []) if (!patternShapes(l.pattern).includes(sh)) dead.push(`${t.id}: ${l.pattern} dáng ${sh}`);
}
ok("T10", "Mọi công thức radar qua luật máy tạo mẫu (màu nổi, hiệu ứng hợp nền, dáng được phép, không hoạ tiết đã nghỉ)", !dead.length, dead.slice(0, 5).join(" | "));
// bỏ các look nhìn "dị" đã soi (velvet lavender / trắng, aura trắng + xanh băng, French tráng gương hồng cánh sen) + có nhóm mẫu mới
const looks = TREND_RADAR.flatMap((t) => t.looks.flatMap((l) => l.colors.map((c) => `${l.pattern}:${c[0]}:${c[1]}`)));
const pats = new Set(TREND_RADAR.flatMap((t) => t.looks.map((l) => l.pattern)));
ok("T11", "Radar bỏ look đã soi là \"dị\", có nhóm mẫu mới (micro French thu, chrome nâu, ren / French hồng – trắng, đỏ nhung + nơ, mắt mèo 9D, nhũ loang năm mới)",
  !looks.some((x) => /^velvet:(lavender|white|milky)|^aura:white:coolBlue|^chromefrench:hotPink/.test(x)) &&
  ["fr-micro", "colorchrome", "lace", "fr-pinkwhite", "charm3d", "glitterfade"].every((p) => pats.has(p)) && TREND_RADAR.some((t) => t.id === "cat-eye-9d") &&
  TREND_RADAR.find((t) => t.id === "nye-sparkle")!.looks.some((l) => l.pattern === "glitterfade") && TREND_RADAR.find((t) => t.id === "xmas-bow")!.looks.some((l) => l.colors.some((c) => c[0] === "redVelvet")),
  looks.filter((x) => /^velvet:(lavender|white|milky)|^aura:white:coolBlue|^chromefrench:hotPink/.test(x)).join(","));
// Úc ngược mùa: trend mùa thu (hemi) ở Úc là tháng 3–5; Giáng sinh mùa hè chỉ ở Úc, caro / tuyết / nhung chỉ ở Mỹ
const at = (y: number, mo: number, mk: "US" | "AU") => activeTrends(new Date(Date.UTC(y, mo - 1, 15)), mk).map((t) => t.id);
ok("T12", "Úc ngược mùa: tháng 10 Úc không có trend thu (Mỹ có), tháng 4 Úc có (Mỹ không); Giáng sinh mùa hè chỉ ở Úc, caro / tuyết / nơ nhung chỉ ở Mỹ",
  at(2026, 10, "US").includes("fall-micro-french") && !at(2026, 10, "AU").some((x) => x.startsWith("fall-")) && at(2027, 4, "AU").includes("fall-micro-french") && !at(2027, 4, "US").some((x) => x.startsWith("fall-")) &&
  at(2026, 12, "AU").includes("au-summer-xmas") && !at(2026, 12, "US").includes("au-summer-xmas") && !at(2026, 12, "AU").some((x) => ["xmas-tartan", "xmas-snow", "xmas-bow"].includes(x)) && at(2026, 12, "US").includes("xmas-tartan"));
const CONTRACT = ["fr-micro", "fr-deep", "fr-v", "fr-side", "fr-pinkwhite", "fr-halfmoon", "fr-skittle", "fr-glitter", "fr-santa", "fr-candycane", "fr-tortoise", "syrup", "blush", "cleanmilky", "colorchrome", "glitterfade", "holly", "ornament", "gelflower", "mix-halloween", "mix-christmas", "mix-valentine", "mix-fall", "mix-newyear"];
ok("T13", "24 hoạ tiết mới đã đăng ký ở máy tạo mẫu (PATTERNS) và bộ máy vẽ (PROCEDURAL)", CONTRACT.every((p) => PATTERN_IDS.includes(p) && PROCEDURAL.has(p)), CONTRACT.filter((p) => !PATTERN_IDS.includes(p) || !PROCEDURAL.has(p)).join(","));

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
