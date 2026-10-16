// Trộn bảng tin: bài chính thức rải đều, không 2 bài liền nhau, gom loại theo emoji.   npx tsx scripts/qa/feed_mix_unit.mts
import { kindOf, mixFeed } from "../../lib/feedMix";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => { cond ? pass++ : fail++; console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`); };
const P = (id: string, role: string, content = id) => ({ id, content, author: { role } });

ok("F1", "Loại bài = emoji mở đầu (3 kiểu bộ mẫu ✨ cùng 1 loại; mẹo khác emoji thì khác loại)",
  kindOf("✨ 4 mẫu nail dễ làm\n1. A") === kindOf("✨ 4 mẫu nail quanh năm 💗") && kindOf("📉 Thứ 2–4 vắng khách") !== kindOf("🌧️ Ngày vắng khách") && kindOf("Không emoji") === "không emoji", [kindOf("✨ x"), kindOf("🌧️ y")].join(","));

const page = [P("o1", "ADMIN", "✨ a"), P("o2", "ADMIN", "📍 b"), P("o3", "ADMIN", "💬 c"), P("u1", "TECHNICIAN"), P("u2", "OWNER"), P("u3", "TECHNICIAN"), P("u4", "TECHNICIAN"), P("u5", "OWNER"), P("u6", "TECHNICIAN"), P("u7", "TECHNICIAN")];
const out = mixFeed(page).map((p) => p.id);
const adjacent = out.some((id, i) => i > 0 && id.startsWith("o") && out[i - 1].startsWith("o"));
ok("F2", "3 bài chính thức đầu trang → rải đều (1 bài / 3 bài người thật), không 2 bài liền nhau, người thật giữ thứ tự", !adjacent && out.join(",") === "o1,u1,u2,u3,o2,u4,u5,u6,o3,u7", out.join(","));
ok("F3", "Không mất bài nào khi không trùng loại", out.length === page.length, String(out.length));
const dup = mixFeed([P("o1", "ADMIN", "✨ mới"), P("u1", "OWNER"), P("o2", "ADMIN", "✨ cũ hơn"), P("u2", "OWNER")]).map((p) => p.id);
ok("F4", "2 bài chính thức cùng loại trong 1 trang → giữ bài mới hơn", dup.join(",") === "o1,u1,u2", dup.join(","));
const onlyOfficial = mixFeed([P("o1", "ADMIN", "✨ a"), P("o2", "ADMIN", "📍 b")]).map((p) => p.id);
ok("F5", "Trang chỉ có bài chính thức → vẫn hiện (không trống)", onlyOfficial.join(",") === "o1,o2", onlyOfficial.join(","));

console.log(`\nTrộn bảng tin: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
