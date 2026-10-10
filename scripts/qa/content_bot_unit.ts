// Kiểm thử BOT NỘI DUNG (không cần server):  npx tsx scripts/qa/content_bot_unit.ts
// Chạy mọi ngày trong 1 năm cho Mỹ & Úc: đúng thời điểm, đúng số liệu, có nguồn +
// lời nhắc CPA cho bài thuế, không trùng, không lọt bài sai thị trường.
import { buildBotDrafts, firstLine, TOPIC_COUNT } from "../../lib/contentBot";

let fail = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail.slice(0, 300)}`);
  if (!ok) fail++;
};
const D = (s: string) => new Date(`${s}T15:00:00Z`);
const run = (market: "US" | "AU", d: string, published: string[] = [], theme: { title: string; emoji: string } | null = null) =>
  buildBotDrafts({ market, now: D(d), theme, publishedTitles: new Set(published) });

const days: string[] = [];
for (let t = Date.UTC(2026, 9, 10); t < Date.UTC(2027, 9, 10); t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
const allUS = days.map((d) => ({ d, x: run("US", d) }));
const allAU = days.map((d) => ({ d, x: run("AU", d) }));

check("CB1", `Kho chủ đề đủ lớn (${TOPIC_COUNT} chủ đề) và mỗi ngày có 5–8 bài đề xuất`, TOPIC_COUNT >= 20 && [...allUS, ...allAU].every((r) => r.x.length >= 5 && r.x.length <= 8), [...allUS, ...allAU].filter((r) => r.x.length < 5).map((r) => r.d).slice(0, 3).join());
check("CB2", "Chưa đăng bài ghim → 2 bài ghim (📌 chào mừng + an toàn) luôn đứng đầu", allUS.every((r) => r.x[0].pinned && r.x[1].pinned && r.x[0].title.startsWith("📌")));
const pinnedTitles = allUS[0].x.filter((x) => x.pinned).map((x) => x.title);
check("CB3", "Đã đăng bài ghim → không đề xuất lại", !run("US", "2026-10-10", pinnedTitles).some((x) => x.pinned));
check("CB4", "Không trùng bài trong cùng ngày; bài ≤ 2000 ký tự (giới hạn đăng)", [...allUS, ...allAU].every((r) => new Set(r.x.map((x) => x.id)).size === r.x.length && r.x.every((x) => x.text.length <= 2000)));
const taxPosts = [...allUS, ...allAU].flatMap((r) => r.x).filter((x) => x.pillar === "money");
check("CB5", "MỌI bài tiền & thuế có nguồn chính thống (IRS/ATO/Fair Work) + lời nhắc hỏi CPA", taxPosts.length > 0 && taxPosts.every((x) => x.sources.length > 0 && x.sources.every((s) => /^https:\/\/(www\.)?(irs\.gov|ato\.gov\.au|fairwork\.gov\.au)\//.test(s.url)) && /hỏi CPA/.test(x.text)), taxPosts.filter((x) => !/hỏi CPA/.test(x.text)).map((x) => x.title).slice(0, 2).join(" | "));
const q = (d: string) => run("US", d).find((x) => x.id.startsWith("quarterly-tax"));
check("CB6", "Nhắc thuế quý đúng lúc: trước 15/1 · 15/4 · 15/6 · 15/9 ≤ 21 ngày, ghi đúng ngày hạn; ngoài khoảng đó không nhắc",
  /15\/1\/2027 \(còn 5 ngày\)/.test(q("2027-01-10")?.title ?? "") && /15\/4\/2027/.test(q("2027-04-01")?.title ?? "") && /15\/6\/2027/.test(q("2027-06-01")?.title ?? "") && /15\/9\/2027/.test(q("2027-09-10")?.title ?? "") && !q("2027-02-20") && !q("2026-10-20"),
  [q("2027-01-10")?.title, q("2027-02-20")?.title].join(" | "));
const has = (m: "US" | "AU", d: string, id: string) => run(m, d).some((x) => x.id.startsWith(id));
check("CB7", "Bài theo mùa đúng thời điểm: mùa thuế Mỹ (1/1–15/4), cuối năm (11–12), tuyển thợ mùa lễ (10–12), mùa thuế Úc (7–10)",
  has("US", "2027-02-10", "tax-season") && !has("US", "2027-06-10", "tax-season") && has("US", "2026-12-05", "year-end-tax") && !has("US", "2027-03-05", "year-end-tax") && has("US", "2026-10-20", "holiday-staffing") && has("AU", "2026-10-20", "au-tax-time") && !has("AU", "2027-01-20", "au-tax-time"));
const auAll = allAU.flatMap((r) => r.x);
check("CB8", "Thị trường Úc không lọt bài chỉ dành cho Mỹ (1099, IRS, check scam, hạn thuế quý Mỹ)", !auAll.some((x) => /1099|IRS|W-2|15\/4/.test(x.text)), auAll.filter((x) => /1099|IRS/.test(x.text)).map((x) => x.title).slice(0, 2).join());
const usAll = allUS.flatMap((r) => r.x);
check("CB9", "Thị trường Mỹ không lọt bài chỉ dành cho Úc (super, GST, ATO)", !usAll.some((x) => /ATO|GST|super 12%|myGov/.test(x.text)));
const txt = (m: "US" | "AU", id: string) => [...(m === "US" ? usAll : auAll)].find((x) => x.id.startsWith(id))?.text ?? "";
check("CB10", "Số liệu thuế đúng nguồn: $25,000 · $150,000/$300,000 · 2025–2028 · nghề thợ nail trong danh sách · $2,000 từ 2026 · super 12% · A$75,000 · 31/10",
  /\$25,000/.test(txt("US", "no-tax-on-tips")) && /\$150,000/.test(txt("US", "no-tax-on-tips")) && /\$300,000/.test(txt("US", "no-tax-on-tips")) && /2025–2028/.test(txt("US", "no-tax-on-tips")) && /manicurist/.test(txt("US", "no-tax-on-tips")) &&
  /\$2,000/.test(run("US", "2026-11-01").find((x) => x.id.startsWith("1099-threshold"))?.text ?? "") && /12%/.test(txt("AU", "au-super")) && /A\$75,000/.test(run("AU", "2026-10-10", [], null).concat(...allAU.map((r) => r.x)).find((x) => x.id.startsWith("au-gst"))?.text ?? "") && /31\/10/.test(txt("AU", "au-tax-time")));
check("CB11", "Bài 'No tax on tips' nhắc VẪN phải khai tip & vẫn đóng Social Security/Medicare (không để thợ hiểu sai là khỏi khai)", /Vẫn PHẢI khai đủ tip/.test(txt("US", "no-tax-on-tips")) && /Social Security & Medicare vẫn tính/.test(txt("US", "no-tax-on-tips")));
check("CB12", "Quảng bá bộ mẫu lễ CHỈ khi có bộ mẫu (đã duyệt) — không nói quá", !run("US", "2026-10-10").some((x) => x.id.startsWith("theme-collection")) && run("US", "2026-10-10", [], { title: "Mùa Halloween", emoji: "🎃" }).some((x) => x.id.startsWith("theme-collection") && /Halloween/.test(x.title)));
check("CB13", "Mỗi ngày trộn ≥ 3 mảng nội dung (tiền, an toàn, sức khoẻ, tay nghề, quản lý tiệm…)", allUS.every((r) => new Set(r.x.map((x) => x.pillar)).size >= 3) && allAU.every((r) => new Set(r.x.map((x) => x.pillar)).size >= 3));
const weekA = new Set(allUS.slice(0, 7).flatMap((r) => r.x.filter((x) => !x.pinned && !x.seasonal).map((x) => x.id)));
check("CB14", "Xoay vòng: 1 tuần đề xuất ≥ 10 bài thường khác nhau (không lặp mãi 1 bài)", weekA.size >= 10, String(weekA.size));
check("CB15", "firstLine lấy đúng tiêu đề để đối chiếu đã đăng", firstLine(allUS[0].x[0].text) === allUS[0].x[0].title);
check("CB16", "Mỗi bài có lời kêu gọi (lưu / chia sẻ / bình luận) và hashtag", [...usAll, ...auAll].every((x) => /(Lưu|lưu|Chia sẻ|chia sẻ|Bình luận|bình luận|👉|Gửi|gửi|Đặt|👇)/.test(x.text) && /#\w/.test(x.text)));

console.log(`\nBot nội dung: ${16 - fail}/16 PASS`);
if (fail) process.exit(1);
