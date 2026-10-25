// Kiểm thử RADAR TREND (lib/trendRadar) + máy tạo mẫu chạy ngầm mỗi ngày (lib/designEngine):
// công thức trend hợp lệ & máy PawNail VẼ ĐƯỢC; ~1/2 mẫu mỗi ngày lấy từ radar, ghi đúng nguồn; trend theo mùa chỉ
// xuất hiện đúng mùa; dịp lễ đang diễn ra vẫn có mẫu; xoay vòng theo ngày (mỗi ngày bộ khác).
//   npx tsx scripts/qa/trend_radar_unit.mts
import { TREND_RADAR, activeTrends } from "../../lib/trendRadar";
import { generateEngineDesigns, COLORS, PATTERN_IDS } from "../../lib/designEngine";
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

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
