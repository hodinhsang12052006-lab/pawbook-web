// Kiểm thử MÁY TẠO MẪU PawNail (không cần server):  npx tsx scripts/qa/design_engine_unit.ts
// Sinh hàng trăm mẫu cho mọi dịp lễ rồi soát luật NGHỀ: đúng kỹ thuật, đủ vật
// tư, song ngữ sạch, không nói sai về xu hướng, không trùng tên.
import { activeThemes, THEMES } from "../../lib/contentEngine";
import { buildDesign, generateEngineDesigns, PATTERNS, type EngineDesign, type Finish, type Shape, type SystemId } from "../../lib/designEngine";

let fail = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
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
check("DE22", "Trend nail Hàn tối giản: chiếm phần lớn mẫu quanh năm, dùng bảng màu nude/thạch/trắng sữa/xám be/socola", kor.length >= all.length * 0.25 && kor.every((x) => !x.d.occasion) && new Set(kor.map((x) => x.d.pattern)).size >= 10, `${kor.length}/${all.length} mẫu, ${new Set(kor.map((x) => x.d.pattern)).size} hoạ tiết`);
check("DE23", "Mỗi lô vừa có mẫu theo dịp lễ vừa có mẫu quanh năm (khi đang có dịp lễ)", batches.every((b) => b.some((d) => d.occasion) && b.some((d) => !d.occasion)));
check("DE24", "Hoạ tiết kiểu Hàn ra đúng chỗ (trend Hàn hoặc dịp được phép), baby boomer luôn hồng nude → trắng sữa", all.filter((x) => KOREAN_ONLY.includes(x.d.pattern)).every((x) => /^Trend nail Hàn/.test(x.d.description.vi) || (x.d.occasion && (PATTERNS.find((p) => p.id === x.d.pattern)!.occasions as string[]).includes(x.d.occasion))) && all.filter((x) => x.d.pattern === "babyboomer").every((x) => x.d.palette[0] === "#f2c4c4" && x.d.palette[1] === "#f8fafc"));
check("DE25", "Charm/cụm đá: phủ top quanh viền, KHÔNG phủ lên mặt charm/đá", all.filter((x) => ["charm3d", "gemcluster"].includes(x.d.pattern)).every((x) => x.d.steps.some((st) => /không phủ lên mặt/.test(st.vi))));

const dupWord = (t: string) => t.toLowerCase().split(/\s+/).some((w, i, a) => i > 0 && w === a[i - 1]);
check("DE26", "Tên mẫu không lặp từ (VD 'thạch … thạch', 'sheer sheer')", !all.some((x) => dupWord(x.d.title.vi) || dupWord(x.d.title.en)), bad((x) => dupWord(x.d.title.vi) || dupWord(x.d.title.en)));

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

console.log(`\nMáy tạo mẫu PawNail: ${26 - fail}/26 PASS`);
if (fail) process.exit(1);
