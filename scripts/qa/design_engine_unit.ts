// Kiểm thử MÁY TẠO MẪU PawNail (không cần server):  npx tsx scripts/qa/design_engine_unit.ts
// Sinh hàng trăm mẫu cho mọi dịp lễ rồi soát luật NGHỀ: đúng kỹ thuật, đủ vật
// tư, song ngữ sạch, không nói sai về xu hướng, không trùng tên.
import { activeThemes, THEMES } from "../../lib/contentEngine";
import { buildDesign, COLORS, finishOk, generateEngineDesigns, generateOccasionBatch, liveOccasions, paletteOk, PATTERN_IDS, PATTERNS, patternShapes, RETIRED_PATTERNS, runIssues, type EngineDesign, type Finish, type Shape, type SystemId } from "../../lib/designEngine";
import { activeTrends } from "../../lib/trendRadar";

let fail = 0, total = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
  total++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail.slice(0, 400)}`);
  if (!ok) fail++;
};
const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const DAY = 86_400_000;

// Sinh mẫu cho 1 năm (mỗi 5 ngày, 2 thị trường) — giống cách cron chạy mỗi ngày.
const all: { date: string; market: "US" | "AU"; d: EngineDesign; idx: number }[] = [];
const batches: EngineDesign[][] = [];
for (let t = Date.UTC(2026, 9, 1); t < Date.UTC(2027, 9, 1); t += 5 * DAY) {
  for (const market of ["US", "AU"] as const) {
    const date = new Date(t).toISOString().slice(0, 10);
    const occ = [];
    const seen = new Set<string>();
    for (let k = 0; k <= 21; k += 3) {
      for (const th of activeThemes(new Date(t + k * DAY), market)) {
        if (seen.has(th.id)) continue;
        seen.add(th.id);
        occ.push({ id: th.id, title: th.title, emoji: th.emoji, startsIn: k });
      }
    }
    const b = generateEngineDesigns(6, { market, date, occasions: occ.slice(0, 4), risingTags: ["cateye", "frenchtip", "chromenails", "PawNailHalloween"], usedTitles: new Set() });
    batches.push(b);
    b.forEach((d, idx) => all.push({ date, market, d, idx }));
  }
}
console.log(`Đã sinh ${all.length} mẫu (${batches.length} lô).`);

const bad = (pred: (x: (typeof all)[number]) => boolean) => all.filter(pred).slice(0, 3).map((x) => `${x.date} ${x.d.title.vi} [${x.d.spec.system}/${x.d.finish}/${x.d.pattern}]`).join(" | ");

check("DE1", "Mỗi lô ra đủ 6 mẫu", batches.every((b) => b.length === 6), batches.map((b) => b.length).join(","));
check("DE2", "Không trùng tên trong cùng lô", batches.every((b) => new Set(b.map((d) => d.title.vi)).size === b.length));
check("DE3", "Mẫu đầu mỗi lô DỄ (độ khó 1) cho thợ mới", batches.every((b) => b[0].difficulty === 1), bad((x) => x.idx === 0 && x.d.difficulty !== 1));
check("DE4", "Đủ vật tư (≥3) và 4–9 bước", all.every((x) => x.d.materials.length >= 3 && x.d.steps.length >= 4 && x.d.steps.length <= 9), bad((x) => !(x.d.materials.length >= 3 && x.d.steps.length >= 4 && x.d.steps.length <= 9)));
check("DE5", "Tiếng Anh sạch (không lẫn tiếng Việt) ở tên, mô tả, vật tư, các bước", all.every((x) => ![x.d.title.en, x.d.description.en, ...x.d.materials.map((m) => m.en), ...x.d.steps.map((s) => s.en), x.d.imagePrompt].some((t) => VI.test(t))),
  bad((x) => [x.d.title.en, x.d.description.en, ...x.d.materials.map((m) => m.en), ...x.d.steps.map((s) => s.en)].some((t) => VI.test(t))));
check("DE6", "Không có vật tư trùng lặp", all.every((x) => new Set(x.d.materials.map((m) => m.vi)).size === x.d.materials.length), bad((x) => new Set(x.d.materials.map((m) => m.vi)).size !== x.d.materials.length));
check("DE7", "Mắt mèo: có nam châm + hút nam châm NGAY trong lớp màu (trước mọi hoạ tiết)",
  all.filter((x) => x.d.finish === "cateye").every((x) => x.d.materials.some((m) => /Nam châm/.test(m.vi)) && x.d.steps.findIndex((s) => /nam châm/.test(s.vi)) === x.d.steps.findIndex((s) => /mắt mèo/.test(s.vi))),
  bad((x) => x.d.finish === "cateye" && !(x.d.steps.findIndex((s) => /nam châm/.test(s.vi)) === x.d.steps.findIndex((s) => /mắt mèo/.test(s.vi)))));
check("DE8", "Tráng gương: có bột chrome + bước xoa bột + khoá top", all.filter((x) => x.d.finish === "chrome").every((x) => x.d.materials.some((m) => /tráng gương/.test(m.vi)) && x.d.steps.some((s) => /xoa bột chrome/.test(s.vi))));
check("DE9", "Nhám: có top nhám, KHÔNG có bước phủ top bóng mâu thuẫn", all.filter((x) => x.d.finish === "matte").every((x) => x.d.materials.some((m) => /nhám/.test(m.vi)) && !x.d.steps.some((s) => /top bóng, hơ đèn, thoa/.test(s.vi))), bad((x) => x.d.finish === "matte" && x.d.steps.some((s) => /top bóng, hơ đèn, thoa/.test(s.vi))));
check("DE10", "Dip: chỉ hoạ tiết làm bằng bột, hoàn thiện activator + top dip, không hơ đèn ở bước cuối, không top gel", all.filter((x) => x.d.spec.system === "dip").every((x) => ["solid", "french", "ombre", "babyboomer"].includes(x.d.pattern) && /activator/.test(x.d.steps.at(-1)!.vi) && !/hơ đèn/.test(x.d.steps.at(-1)!.vi) && !x.d.materials.some((m) => /Top gel/.test(m.vi))),
  bad((x) => x.d.spec.system === "dip" && !(["solid", "french", "ombre", "babyboomer"].includes(x.d.pattern) && /activator/.test(x.d.steps.at(-1)!.vi))));
check("DE11", "Đồi mồi: không sơn thêm lớp màu nền (jelly là màu), dùng tông caramel/nâu", all.filter((x) => x.d.pattern === "tortoise").every((x) => !x.d.steps.some((s) => /^Sơn 2 lớp gel/.test(s.vi)) && x.d.palette[0] === "#b45309"));
check("DE12", "Chỉ nói 'đang lên #tag' khi mẫu dùng đúng hoạ tiết/hiệu ứng đó", all.every((x) => {
  const m = x.d.description.vi.match(/#(\w+)/);
  if (!m) return true;
  const t = m[1];
  return (/cateye/i.test(t) && x.d.finish === "cateye") || (/french/i.test(t) && x.d.pattern === "french") || (/chrome/i.test(t) && x.d.finish === "chrome");
}), bad((x) => /#/.test(x.d.description.vi)));
check("DE13", "Giá đúng định dạng: Mỹ $lo–hi, Úc A$lo–hi, khoảng hợp lý", all.every((x) => {
  const re = x.market === "AU" ? /^A\$(\d+)–(\d+)$/ : /^\$(\d+)–(\d+)$/;
  const mm = x.d.priceHint.match(re);
  return !!mm && +mm[1] >= 30 && +mm[2] <= 200 && +mm[2] > +mm[1];
}), bad((x) => !/^(A?\$)\d+–\d+$/.test(x.d.priceHint)));
check("DE14", "Thời gian 25–120 phút, độ khó 1–3", all.every((x) => x.d.minutes >= 25 && x.d.minutes <= 120 && x.d.difficulty >= 1 && x.d.difficulty <= 3), bad((x) => !(x.d.minutes >= 25 && x.d.minutes <= 120)));
check("DE15", "Mẫu theo dịp lễ dùng đúng dịp đang/sắp diễn ra; mô tả nhắc đến dịp đó", all.filter((x) => x.d.occasion).every((x) => THEMES.some((t) => t.id === x.d.occasion) && /^(Đang vào|Chuẩn bị cho)/.test(x.d.description.vi)));
check("DE16", "Lễ Tạ Ơn không xuất hiện ở Úc", !all.some((x) => x.market === "AU" && x.d.occasion === "thanksgiving"));
check("DE17", "Đa dạng: cả năm dùng ≥ 15 hoạ tiết, đủ 4 hệ móng và 5 hiệu ứng", new Set(all.map((x) => x.d.pattern)).size >= 15 && new Set(all.map((x) => x.d.spec.system)).size === 4 && new Set(all.map((x) => x.d.finish)).size === 5,
  `${new Set(all.map((x) => x.d.pattern)).size} hoạ tiết, ${new Set(all.map((x) => x.d.spec.system)).size} hệ, ${new Set(all.map((x) => x.d.finish)).size} hiệu ứng`);
check("DE18", "Hoạ tiết riêng của dịp chỉ ra đúng dịp (mạng nhện = Halloween, bông tuyết = Noel/Năm mới, hoa mai/đào = Tết)", all.every((x) => (x.d.pattern !== "web" || x.d.occasion === "halloween") && (x.d.pattern !== "snow" || ["christmas", "newyear"].includes(x.d.occasion ?? "")) && (x.d.pattern !== "blossom" || x.d.occasion === "tet")));
const again = generateEngineDesigns(6, { market: "US", date: "2026-10-10", occasions: [{ id: "halloween", title: "Mùa Halloween", startsIn: 0 }], risingTags: [], usedTitles: new Set() });
const again2 = generateEngineDesigns(6, { market: "US", date: "2026-10-10", occasions: [{ id: "halloween", title: "Mùa Halloween", startsIn: 0 }], risingTags: [], usedTitles: new Set() });
check("DE19", "Cùng ngày chạy lại ra cùng kết quả (có hạt giống)", JSON.stringify(again) === JSON.stringify(again2));
const avoid = generateEngineDesigns(6, { market: "US", date: "2026-10-10", occasions: [{ id: "halloween", title: "Mùa Halloween", startsIn: 0 }], risingTags: [], usedTitles: new Set(again.map((d) => d.title.vi)) });
check("DE20", "Không lặp tên mẫu đã ra trước đó", avoid.length === 6 && !avoid.some((d) => again.some((a) => a.title.vi === d.title.vi)), avoid.map((d) => d.title.vi).join(" | "));

const kor = all.filter((x) => /^Trend nail Hàn/.test(x.d.description.vi));
const KOREAN_ONLY = ["jelly", "chromefrench", "charm3d", "gemcluster", "foil", "chromeline", "mixmatch", "babyboomer"];
const trd = all.filter((x) => /^Trend đang được ưa chuộng/.test(x.d.description.vi));
// mẫu từ RADAR TREND (lib/trendRadar) ghi rõ nguồn — được dùng hoạ tiết kiểu Hàn (thạch tráng gương, mắt mèo 2 tông…)
const RADAR = /\((Pinterest Predicts|Màu của năm|Trend thu|Halloween 20|Giáng sinh 20|Năm mới)/;
check("DE22", "Mẫu quanh năm: nail Hàn + trend đang chuộng chiếm ≥ 40% tổng số, mỗi nhóm ≥ 15%, đa dạng hoạ tiết", kor.length + trd.length >= all.length * 0.4 && kor.length >= all.length * 0.15 && trd.length >= all.length * 0.15 && kor.every((x) => !x.d.occasion) && trd.every((x) => !x.d.occasion) && new Set(kor.map((x) => x.d.pattern)).size >= 10 && new Set(trd.map((x) => x.d.pattern)).size >= 10,
  `Hàn ${kor.length}, trend ${trd.length} / ${all.length}; hoạ tiết Hàn ${new Set(kor.map((x) => x.d.pattern)).size}, trend ${new Set(trd.map((x) => x.d.pattern)).size}`);
check("DE27", "Velvet: nam châm phẳng lướt đều khắp móng (không tạo dải); Milk bath: nền trắng sữa, hoa nằm dưới lớp thạch; Negative space: chừa móng thật bằng base trong",
  all.filter((x) => x.d.pattern === "velvet").every((x) => x.d.finish === "cateye" && x.d.steps.some((st) => /KHÔNG tạo dải/.test(st.vi)) && !x.d.steps.some((st) => /cho dải sáng/.test(st.vi))) &&
  all.filter((x) => x.d.pattern === "milkbath").every((x) => x.d.palette[0] === COLORS.white.hex && x.d.steps.some((st) => /trùm lên hoa/.test(st.vi))) &&
  all.filter((x) => x.d.pattern === "negative").every((x) => x.d.steps.some((st) => /base trong/.test(st.vi)) && !x.d.steps.some((st) => /^Sơn 2 lớp gel/.test(st.vi))));
check("DE28", "Cả năm dùng ≥ 30 hoạ tiết khác nhau", new Set(all.map((x) => x.d.pattern)).size >= 30, String(new Set(all.map((x) => x.d.pattern)).size));
check("DE23", "Mỗi lô vừa có mẫu theo dịp lễ vừa có mẫu quanh năm (khi đang có dịp lễ)", batches.every((b) => b.some((d) => d.occasion) && b.some((d) => !d.occasion)));
check("DE24", "Hoạ tiết kiểu Hàn ra đúng chỗ (trend Hàn hoặc dịp được phép), baby boomer luôn hồng nude → trắng sữa", all.filter((x) => KOREAN_ONLY.includes(x.d.pattern)).every((x) => RADAR.test(x.d.description.vi) || /^Trend nail Hàn/.test(x.d.description.vi) || (x.d.occasion && (PATTERNS.find((p) => p.id === x.d.pattern)!.occasions as string[]).includes(x.d.occasion))) && all.filter((x) => x.d.pattern === "babyboomer").every((x) => x.d.palette[0] === COLORS.pinkNude.hex && x.d.palette[1] === COLORS.white.hex));
check("DE25", "Charm/cụm đá: phủ top quanh viền, KHÔNG phủ lên mặt charm/đá", all.filter((x) => ["charm3d", "gemcluster"].includes(x.d.pattern)).every((x) => x.d.steps.some((st) => /không phủ lên mặt/.test(st.vi))));

const dupWord = (t: string) => t.toLowerCase().split(/\s+/).some((w, i, a) => i > 0 && w === a[i - 1]);
check("DE26", "Tên mẫu không lặp từ (VD 'thạch … thạch', 'sheer sheer')", !all.some((x) => dupWord(x.d.title.vi) || dupWord(x.d.title.en)), bad((x) => dupWord(x.d.title.vi) || dupWord(x.d.title.en)));

// Bộ 100 mẫu Halloween
const hb = generateOccasionBatch(100, { market: "US", date: "2026-10-10", occasion: { id: "halloween", title: "Mùa Halloween", emoji: "🎃", startsIn: 0 }, risingTags: [], usedTitles: new Set() });
const hbPat = new Set(hb.map((d) => d.pattern));
const SPECIAL = PATTERNS.filter((p) => p.occasions !== "any" && (p.occasions as string[]).includes("halloween")).map((p) => p.id);
const DARK = (["black", "chocolate", "smoke", "plum", "burgundy", "espresso", "navy", "pine"] as const).map((k) => COLORS[k].hex as string);
const LIGHT = (["white", "pearl", "butter", "sheer"] as const).map((k) => COLORS[k].hex as string);
check("DE29", "Bộ 100 mẫu Halloween: đủ 100, không trùng tên (VI + EN), tất cả là Halloween, ≥ 20 hoạ tiết, ≥ 60% hoạ tiết riêng của Halloween",
  hb.length === 100 && new Set(hb.map((d) => d.title.vi)).size === 100 && new Set(hb.map((d) => d.title.en)).size === 100 && hb.every((d) => d.occasion === "halloween" && /mùa Halloween/.test(d.description.vi)) && hbPat.size >= 20 && hb.filter((d) => SPECIAL.includes(d.pattern)).length >= 60,
  `${hb.length} mẫu, ${new Set(hb.map((d) => d.title.vi)).size} tên, ${hbPat.size} hoạ tiết, riêng ${hb.filter((d) => SPECIAL.includes(d.pattern)).length}`);
check("DE30", "Không ghép màu làm hoạ tiết chìm: mèo đen/khâu đen không trên nền tối, ma/xác ướp/đầu lâu không trên nền trắng, bí ngô không trên nền cam",
  hb.every((d) => !(["blackcat", "stitches"].includes(d.pattern) && DARK.includes(d.palette[0])) && !(["ghost", "mummy", "skull"].includes(d.pattern) && LIGHT.includes(d.palette[0])) && !(d.pattern === "jackolantern" && [COLORS.pumpkin.hex, COLORS.burnt.hex, COLORS.caramel.hex].includes(d.palette[0] as never))),
  hb.filter((d) => ["blackcat", "stitches"].includes(d.pattern) && DARK.includes(d.palette[0])).map((d) => d.title.vi).join(" | "));
check("DE31", "Bộ Halloween: tiếng Anh sạch, đủ vật tư & bước, mô tả ảnh không có chữ nhạy cảm (blood, gore, nude…)", hb.every((d) => ![d.title.en, d.description.en, d.imagePrompt, ...d.materials.map((m) => m.en), ...d.steps.map((x) => x.en)].some((t) => VI.test(t)) && d.materials.length >= 3 && d.steps.length >= 4 && !/(blood|gore|bloody|naked|nude skin|sexy)/i.test(d.imagePrompt)));
const hb2 = generateOccasionBatch(100, { market: "US", date: "2026-10-10", occasion: { id: "halloween", title: "Mùa Halloween", startsIn: 0 }, risingTags: [], usedTitles: new Set(hb.map((d) => d.title.vi)) });
check("DE32", "Tạo bộ lần 2 (đã có 100 mẫu) → chỉ ra mẫu MỚI, không trùng bộ trước", hb2.every((d) => !hb.some((x) => x.title.vi === d.title.vi)), String(hb2.length));


// ---------------- Luật màu / lượt 6 mẫu / né lượt trước / Úc ngược mùa (kế hoạch sửa "mẫu nhìn dị" 25/10) ----------------
const hexKey = new Map(Object.entries(COLORS).map(([k, c]) => [c.hex as string, k]));
check("DE33", "Bảng màu không còn mã Tailwind (navy #1e3a8a, sky #7dd3fc, cam #ea580c, hồng #ec4899, trắng #f8fafc…) — toàn màu gel",
  !Object.values(COLORS).some((c) => ["#1e3a8a", "#7dd3fc", "#c4b5fd", "#ea580c", "#ec4899", "#f9a8d4", "#fb7185", "#581c87", "#a7f3d0", "#fde047", "#111111", "#f8fafc"].includes(c.hex)) &&
  COLORS.navy.hex === "#1f2a44" && COLORS.white.hex === "#f2ede6" && COLORS.milky.hex === "#f2ede6" && COLORS.bloodRed.hex === "#8a0303" && COLORS.emerald.hex === "#0b5d3b" && COLORS.mulledWine.hex === "#5a1a2a");
// cặp "chìm" khách đã thấy trong catalog 25/10 phải bị loại; cặp tông-trên-tông đọc bằng khối 3D / hiệu ứng vẫn được
const BAD: [string, [string, string, string]][] = [["dots", ["sky", "lavender", "silver"]], ["snow", ["silver", "milky", "silver"]], ["pearls", ["white", "milky", "pearl"]], ["charm3d", ["mocha", "milky", "roseGold"]],
  ["bats", ["nude", "milky", "silver"]], ["bats", ["black", "milky", "gold"]], ["negative", ["nude", "nude", "gold"]], ["marble", ["burgundy", "milky", "gold"]], ["marble", ["babyPink", "smoke", "gold"]],
  ["velvet", ["milky", "pearl", "pearl"]], ["droplets", ["white", "milky", "silver"]], ["ghost", ["pumpkin", "milky", "gold"]], ["holly", ["redVelvet", "milky", "gold"]], ["fr-micro", ["sheer", "babyPink", "gold"]],
  ["aura", ["cherryCola", "nude", "gold"]], ["colorchrome", ["nude", "nude", "gold"]], ["fawn", ["emerald", "bone", "gold"]], ["mix-halloween", ["burnt", "black", "gold"]]];
const GOOD: [string, [string, string, string]][] = [["fr-micro", ["sheer", "espresso", "gold"]], ["gelflower", ["sheer", "milky", "pearl"]], ["colorchrome", ["espresso", "espresso", "gold"]], ["ghost", ["black", "milky", "silver"]],
  ["holly", ["milky", "redVelvet", "gold"]], ["marble", ["milky", "smoke", "gold"]], ["marble", ["black", "milky", "gold"]], ["fr-pinkwhite", ["pinkNude", "white", "gold"]], ["mix-christmas", ["redVelvet", "milky", "gold"]]];
const genBad = all.filter((x) => !paletteOk(x.d.pattern, x.d.spec.colors));
check("DE34", "Cổng tương phản CIELAB: loại đúng các cặp chìm (lavender/xanh da trời, trắng/bạc, ngọc trai/trắng, vàng hồng/mocha, dơi bạc/nude…), giữ cặp tông-trên-tông 3D; MỌI mẫu máy ra đều đạt",
  BAD.every(([p, k]) => !paletteOk(p, k)) && GOOD.every(([p, k]) => paletteOk(p, k)) && !genBad.length,
  [...BAD.filter(([p, k]) => paletteOk(p, k)).map(([p, k]) => `lọt ${p} ${k}`), ...GOOD.filter(([p, k]) => !paletteOk(p, k)).map(([p, k]) => `chặn nhầm ${p} ${k}`), ...genBad.slice(0, 3).map((x) => `${x.d.pattern} ${x.d.spec.colors}`)].join(" | "));
check("DE35", "Hiệu ứng + dáng đúng luật: nhũ chỉ ở French nhũ / nhũ loang / baby boomer, nhám chỉ nền L* < 55, mắt mèo chỉ nền L* < 45, chrome trên hoạ tiết chỉ nền rất sáng; dáng trong danh sách được phép (không dâu nhúng / French đôi / cherry / giọt nước / da báo / chấm bi nhọn)",
  all.every((x) => finishOk(x.d.pattern, x.d.palette[0], x.d.finish) && patternShapes(x.d.pattern).includes(x.d.shape)) &&
  !all.some((x) => x.d.shape === "stiletto" && ["chocodip", "doublefrench", "cherry", "droplets", "leopard", "polka"].includes(x.d.pattern)),
  bad((x) => !finishOk(x.d.pattern, x.d.palette[0], x.d.finish) || !patternShapes(x.d.pattern).includes(x.d.shape)));
const fin = (f: Finish) => all.filter((x) => x.d.finish === f).length / all.length;
check("DE36", `Tỉ lệ hiệu ứng: bóng là chính nhưng không phẳng cả kho, mắt mèo / chrome / nhũ có mặt, nhám ít (bóng ${Math.round(fin("glossy") * 100)}% · mắt mèo ${Math.round(fin("cateye") * 100)}% · chrome ${Math.round(fin("chrome") * 100)}% · nhũ ${Math.round(fin("glitter") * 100)}% · nhám ${Math.round(fin("matte") * 100)}%)`,
  fin("glossy") >= 0.45 && fin("glossy") <= 0.75 && fin("cateye") >= 0.1 && fin("chrome") >= 0.04 && fin("glitter") >= 0.03 && fin("glitter") <= 0.12 && fin("matte") <= 0.05);
const issues = batches.map(runIssues);
check("DE37", "Mỗi lượt 6 mẫu đạt chỉ tiêu: ≥1 French, ≥1 màu đá quý / rực, ≥1 nền gần đen, ≥1 kim loại chủ đạo, nude/trong ≤ 40%, ≤1 nền gần trắng, ≤2 hoạ tiết dịp lễ, ≤1 mẫu trơn, 2 mẫu liền nhau khác họ màu",
  issues.every((x) => !x.length), issues.map((x, i) => (x.length ? `${batches[i][0].spec.occasion ?? ""} ${x.join(",")}` : "")).filter(Boolean).slice(0, 4).join(" | "));
// dịp lễ: ≥ 50% ô dịp lễ là bộ phối mỗi móng một kiểu (mix-*), không ngập sticker
const occSlot = batches.filter((b) => b[3]?.occasion && ["halloween", "christmas", "valentine", "fall", "newyear"].includes(b[3].occasion));
check("DE38", `Ô dịp lễ: ≥ 50% là bộ phối mỗi móng một kiểu (${occSlot.filter((b) => b[3].pattern.startsWith("mix-")).length}/${occSlot.length})`, occSlot.filter((b) => b[3].pattern.startsWith("mix-")).length >= occSlot.length * 0.5);
const RETIRED = RETIRED_PATTERNS();
check("DE39", "Máy KHÔNG ra hoạ tiết đã nghỉ (mắt quỷ, khâu, kẹo bắp, sóng, phù thuỷ, giọt nước cũ) nhưng mẫu cũ vẫn ghép / vẽ được; 'droplet' → 'droplets'",
  ["eyeball", "stitches", "candycorn", "waves", "witchy", "droplet"].every((p) => RETIRED.includes(p) && PATTERN_IDS.includes(p)) && !all.some((x) => RETIRED.includes(x.d.pattern)) && !hb.some((d) => RETIRED.includes(d.pattern)) &&
  buildDesign({ occasion: null, system: "gelx", shape: "almond", finish: "glossy", pattern: "droplet", colors: ["black", "milky", "silver"] }).pattern === "droplets", bad((x) => RETIRED.includes(x.d.pattern)));
check("DE40", "Halloween hết sau 31/10: từ tháng 11 tới tháng 8 không còn mẫu Halloween", !all.some((x) => x.d.occasion === "halloween" && !["09", "10"].includes(x.date.slice(5, 7))), bad((x) => x.d.occasion === "halloween" && !["09", "10"].includes(x.date.slice(5, 7))));
// né hoạ tiết của 3 lượt gần nhất (cron đưa vào 18 mẫu PawNail gần nhất)
const occH = [{ id: "halloween", title: "Mùa Halloween", startsIn: 0 }];
const r1 = generateEngineDesigns(6, { market: "US", date: "2026-10-12", occasions: occH, risingTags: [], usedTitles: new Set() });
const r2 = generateEngineDesigns(6, { market: "US", date: "2026-10-12", salt: "6", occasions: occH, risingTags: [], usedTitles: new Set(), recentPatterns: r1.map((d) => d.pattern) });
const overlap = r2.filter((d) => r1.some((x) => x.pattern === d.pattern) && !d.pattern.startsWith("mix-"));
let hist: string[] = [], reps = 0, made = 0;
for (let d = 0; d < 14; d++) for (const salt of ["0", "6", "12"]) {
  const date = new Date(Date.UTC(2026, 11, 1 + d)).toISOString().slice(0, 10);
  const b = generateEngineDesigns(6, { market: "US", date, salt, occasions: [{ id: "christmas", title: "Giáng Sinh", startsIn: 0 }], risingTags: [], usedTitles: new Set(), recentPatterns: hist.slice(-18) });
  reps += b.filter((x) => hist.slice(-18).includes(x.pattern) && !x.pattern.startsWith("mix-")).length; made += b.length; hist = [...hist, ...b.map((x) => x.pattern)];
}
check("DE41", `Né hoạ tiết của 3 lượt trước (recentPatterns): lượt sau không lặp hoạ tiết lượt trước; 14 ngày × 3 lượt Noel lặp ≤ 3% (${reps}/${made})`, r2.length === 6 && !overlap.length && reps <= made * 0.03, overlap.map((d) => d.pattern).join(","));
// Úc ngược mùa: tháng 10 ở Úc là mùa xuân (không nâu caramel mùa thu), tháng 4 mới là mùa thu; Giáng sinh Úc là mùa hè
const auOct = activeTrends(new Date(Date.UTC(2026, 9, 25)), "AU").map((t) => t.id), auApr = activeTrends(new Date(Date.UTC(2027, 3, 15)), "AU").map((t) => t.id), usApr = activeTrends(new Date(Date.UTC(2027, 3, 15)), "US").map((t) => t.id);
const auXmas = all.filter((x) => x.market === "AU" && x.d.occasion === "christmas"), usXmas = all.filter((x) => x.market === "US" && x.d.occasion === "christmas");
const WINTER = ["redVelvet", "velvet", "pine", "emerald", "navy"];
check("DE42", "Úc ngược mùa: tháng 10 Úc không có trend / mẫu mùa thu (là mùa xuân), tháng 4 Úc mới có; Giáng sinh Úc tông hè (san hô, aqua, trắng hoa sứ, vàng — không nhung / caro / tuyết / xanh thông)",
  !auOct.some((t) => t.startsWith("fall-")) && auOct.includes("spring-gel-flower") && auApr.some((t) => t.startsWith("fall-")) && !usApr.some((t) => t.startsWith("fall-")) &&
  !all.some((x) => x.market === "AU" && x.d.occasion === "fall" && ["09", "10", "11"].includes(x.date.slice(5, 7))) &&
  liveOccasions([{ id: "fall", title: "fall", startsIn: 0 }], "AU", 10).some((o) => o.id === "spring") &&
  auXmas.length > 0 && auXmas.every((x) => !WINTER.includes(x.d.spec.colors[0]) && !["velvet", "plaid", "snow"].includes(x.d.pattern)) && usXmas.some((x) => WINTER.includes(x.d.spec.colors[0])),
  `AU tháng 10: ${auOct.filter((t) => t.startsWith("fall-")).join(",")} · Noel Úc: ${auXmas.filter((x) => WINTER.includes(x.d.spec.colors[0])).map((x) => x.d.title.vi).slice(0, 3).join(" | ")}`);
const NEW_IDS = ["fr-micro", "fr-deep", "fr-v", "fr-side", "fr-pinkwhite", "fr-halfmoon", "fr-skittle", "fr-glitter", "fr-santa", "fr-candycane", "fr-tortoise", "syrup", "blush", "cleanmilky", "colorchrome", "glitterfade", "holly", "ornament", "gelflower", "mix-halloween", "mix-christmas", "mix-valentine", "mix-fall", "mix-newyear"];
const newUsed = new Set([...all.map((x) => x.d.pattern), ...hb.map((d) => d.pattern)]);
check("DE43", "Đủ 24 hoạ tiết mới (French biến tấu, syrup, má hồng, clean, chrome màu, nhũ loang, holly, quả châu, hoa gel 3D, bộ phối theo dịp) — có bảng màu mặc định ghép được, tên chỉ nêu màu có trong bảng",
  NEW_IDS.every((id) => PATTERN_IDS.includes(id)) && NEW_IDS.filter((id) => !newUsed.has(id)).length <= 6 &&
  NEW_IDS.every((id) => { const p = PATTERNS.find((x) => x.id === id)!; const d = buildDesign({ occasion: null, system: "gelx", shape: "almond", finish: p.finishes[0], pattern: id, colors: ["sheer", "cherry", "gold"] }); return !!d.title.vi && !!d.title.en && d.steps.length >= 4; }),
  `chưa từng ra: ${NEW_IDS.filter((id) => !newUsed.has(id)).join(",")}`);
// màu nêu trong tên phải nằm trong bảng màu THẬT của mẫu (sau khi ép màu bắt buộc — đồi mồi, baby boomer…); bỏ qua chữ
// của hiệu ứng ("pearl glaze") và vật liệu cố định (hạt ngọc trai, nhụy ngọc trai)
const honest = all.filter((x) => {
  if (["pearls", "gelflower"].includes(x.d.pattern)) return false;
  const names = Object.values(COLORS).filter((c) => x.d.palette.includes(c.hex)).map((c) => c.en.toLowerCase());
  const t = x.d.title.en.toLowerCase().replace(/with a (pearl|chrome) glaze|pearl glaze/g, "");
  return Object.values(COLORS).map((c) => c.en.toLowerCase()).some((n) => n.length > 3 && t.includes(n) && !names.some((m) => m.includes(n)));
});
check("DE44", "Tên mẫu không nêu màu không có trong bảng màu của mẫu", honest.length === 0, honest.slice(0, 3).map((x) => `${x.d.title.en} [${x.d.spec.colors}]`).join(" | "));
void hexKey;

// Mọi tổ hợp hợp lệ đều ghép được (không lỗi, đủ bước).
let combos = 0, comboErr = "";
for (const p of PATTERNS) for (const sys of ["gelx", "acrylic", "dip", "gel"] as SystemId[]) for (const fi of p.finishes as Finish[]) for (const sh of ["almond", "coffin", "square", "oval", "stiletto"] as Shape[]) {
  if (p.systems && !p.systems.includes(sys)) continue;
  try {
    const d = buildDesign({ occasion: null, system: sys, shape: sh, finish: fi, pattern: p.id, colors: ["nude", "white", "gold"] });
    if (d.steps.length < 4 || !d.title.vi) comboErr ||= `${p.id}/${sys}/${fi}`;
    combos++;
  } catch (e) {
    comboErr ||= `${p.id}/${sys}/${fi}: ${(e as Error).message}`;
  }
}
check("DE21", `Mọi tổ hợp hoạ tiết × hệ × hiệu ứng × dáng ghép được (${combos} tổ hợp)`, !comboErr && combos > 300, comboErr);

console.log(`\nMáy tạo mẫu PawNail: ${total - fail}/${total} PASS`);
if (fail) process.exit(1);
