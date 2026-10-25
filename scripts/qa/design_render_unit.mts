// Kiểm thử ẢNH MẪU DO MÁY PAWNAIL TỰ VẼ (lib/designRender) cho kho "Mẫu nail": mọi hoạ tiết bộ máy vẽ được ra ảnh JPEG
// vuông 1024px trên tay mẫu thật; bộ đắp (Gel-X / bột) chỉ vẽ trên tay móng dài sẵn; "Vẽ lại" ra ảnh khác; hoạ tiết
// hình (ma, bí ngô…) báo chưa vẽ được (để đường cũ lo); ảnh thật sự khác nhau theo màu / hoạ tiết.
//   npx tsx scripts/qa/design_render_unit.mts
import { createRequire } from "node:module";
import { renderDesignImage, canRenderPattern, HANDS } from "../../lib/designRender";
import { PROCEDURAL } from "../../lib/tryon/patterns";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`); };
const D = (id: string, pattern: string, extra: Partial<{ palette: string[]; shape: string; finish: string; skills: string[] }> = {}) => ({ id, pattern, palette: ["#7f1d1d", "#ffffff", "#d4af37"], shape: "almond", finish: "glossy", skills: ["Design"], ...extra });

const t0 = performance.now();
const bad: string[] = [];
for (const p of PROCEDURAL) {
  try {
    const r = await renderDesignImage(D(`u-${p}`, p));
    const meta = await sharp(Buffer.from(r.base64, "base64")).metadata();
    if (meta.format !== "jpeg" || meta.width !== 1024 || meta.height !== 1024) bad.push(`${p}: ${meta.format} ${meta.width}×${meta.height}`);
  } catch (e) { bad.push(`${p}: ${(e as Error).message}`); }
}
const per = (performance.now() - t0) / PROCEDURAL.size;
ok("R1", `Mọi hoạ tiết bộ máy tự vẽ (${PROCEDURAL.size}) ra ảnh JPEG vuông 1024px trên tay mẫu thật (TB ${Math.round(per)}ms / ảnh)`, !bad.length && per < 2500, bad.join(" | "));

const longHands = new Set(HANDS.filter((h) => h.long).map((h) => h.file));
const extHands = await Promise.all(Array.from({ length: 12 }, (_, i) => renderDesignImage(D(`ext-${i}`, "solid", { skills: ["Gel-X", "Design"], shape: "coffin" })).then((r) => r.hand)));
ok("R2", "Bộ đắp (Gel-X / bột) chỉ vẽ trên tay có móng dài sẵn (đắp dài trên móng ngắn hướng lên nền nhìn như giấy dán)", extHands.every((f) => longHands.has(f)), extHands.join(","));

const a = await renderDesignImage(D("same", "chromefrench")), b = await renderDesignImage(D("same", "chromefrench")), c = await renderDesignImage(D("same", "chromefrench"), 1);
ok("R3", "Cùng mẫu → cùng ảnh (ổn định); \"Vẽ lại\" (biến thể khác) → ảnh khác", a.base64 === b.base64 && a.base64 !== c.base64);

let threw = false;
try { await renderDesignImage(D("x", "jackolantern")); } catch { threw = true; }
ok("R4", "Hoạ tiết hình (bí ngô, ma…) báo chưa vẽ được → đường cũ (AI + chấm) lo; trend mới (da báo, bàn cờ, foil, charm sao / nơ, tim, giọt chrome) bộ máy vẽ được",
  threw && !canRenderPattern("jackolantern") && ["leopard", "checker", "foil", "stars", "charm3d", "hearts", "chromedrops", "droplets"].every(canRenderPattern));

// ảnh khác nhau thật theo màu (đỏ rượu vs nude cùng tay) — đo trung bình kênh đỏ / xanh dương vùng giữa ảnh
const stat = async (b64: string) => { const { data } = await sharp(Buffer.from(b64, "base64")).extract({ left: 256, top: 256, width: 512, height: 512 }).raw().toBuffer({ resolveWithObject: true }); let r = 0, bl = 0; for (let i = 0; i < data.length; i += 3) { r += data[i]; bl += data[i + 2]; } return { r: r / (data.length / 3), b: bl / (data.length / 3) }; };
const wine = await stat((await renderDesignImage(D("col", "solid", { palette: ["#7f1d1d"] }))).base64), nude = await stat((await renderDesignImage(D("col", "solid", { palette: ["#e8c4a8"] }))).base64);
ok("R5", "Đổi màu mẫu → ảnh đổi màu thật (đỏ rượu tối hơn rõ nude trên cùng tay)", nude.r - wine.r > 8 && nude.b - wine.b > 8, JSON.stringify({ wine, nude }));

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
