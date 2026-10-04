// Kiểm thử logic lịch chủ đề (không cần server):  npx tsx scripts/qa/content_engine_unit.ts
import { activeThemes, tipOfDay, THEMES } from "../../lib/contentEngine";
import { weeklyPay } from "../../lib/trends";

let fail = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail}`);
  if (!ok) fail++;
};
const at = (s: string) => new Date(`${s}T12:00:00Z`);
const ids = (d: string, m: "US" | "AU" = "US") => activeThemes(at(d), m).map((t) => t.id);

check("CE1", "15/10 → Halloween là chủ đề chính, kèm Mùa thu", ids("2026-10-15")[0] === "halloween" && ids("2026-10-15").includes("fall"), ids("2026-10-15").join());
check("CE2", "Lễ Tạ Ơn chỉ ở Mỹ (25/11)", ids("2026-11-25", "US").includes("thanksgiving") && !ids("2026-11-25", "AU").includes("thanksgiving"));
check("CE3", "Năm mới vắt qua năm: 30/12 và 05/01 đều có", ids("2026-12-30").includes("newyear") && ids("2027-01-05").includes("newyear"));
check("CE4", "Valentine 10/02", ids("2027-02-10")[0] === "valentine", ids("2027-02-10").join());
check("CE5", "Mọi ngày trong năm đều có ít nhất 1 chủ đề (Mỹ & Úc)", (() => {
  for (let d = new Date("2027-01-01T12:00:00Z"); d.getUTCFullYear() === 2027; d = new Date(d.getTime() + 86_400_000)) {
    if (activeThemes(d, "US").length === 0 || activeThemes(d, "AU").length === 0) return false;
  }
  return true;
})());
check("CE6", "Hashtag không dấu, không khoảng trắng (để đếm bằng LIKE)", THEMES.every((t) => /^[A-Za-z0-9]+$/.test(t.hashtag)), THEMES.map((t) => t.hashtag).join());
check("CE7", "Mẹo đổi theo ngày, đúng vai trò", tipOfDay(at("2026-10-04"), "OWNER") !== tipOfDay(at("2026-10-05"), "OWNER") && tipOfDay(at("2026-10-04"), "TECHNICIAN") !== tipOfDay(at("2026-10-04"), "OWNER"));
check("CE8", "weeklyPay: '$1,200-1,500/tuần' → 1350; theo giờ → null", weeklyPay("$1,200-1,500/tuần", "Bao lương tuần") === 1350 && weeklyPay("$28-32/giờ", "Theo giờ AUD") === null);

console.log(fail ? `\nContent engine: ${fail} lỗi` : "\nContent engine: 8/8 PASS");
process.exit(fail ? 1 : 0);
