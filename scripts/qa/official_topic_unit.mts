// Bài kiến thức hằng ngày: chủ đề có số thay đổi theo ngày (đếm ngược hạn thuế) không bị đăng lại mỗi ngày.
//   npx tsx scripts/qa/official_topic_unit.mts   (không dùng DB — mô phỏng đúng luật chọn bài của lib/officialDaily.ts)
import { buildBotDrafts, firstLine } from "../../lib/contentBot";

const shape = (t: string) => firstLine(t).replace(/\d+/g, "#");
const DAY = 86_400_000;
function simulate(cooldown: boolean) {
const posted: { text: string; at: number; id: string }[] = [];
for (let t = Date.UTC(2026, 11, 20, 13); t <= Date.UTC(2027, 0, 20, 13); t += DAY) {
  for (const slot of [0, 10 * 3600_000]) {
    const now = new Date(t + slot);
    const published = new Set(posted.map((p) => firstLine(p.text)));
    const recent = (text: string) => cooldown && posted.some((p) => shape(p.text) === shape(text) && p.at > now.getTime() - 60 * DAY);
    const d = buildBotDrafts({ market: "US", now, theme: null, publishedTitles: published }).find((x) => !x.pinned && !published.has(firstLine(x.text)) && !recent(x.text));
    if (d) posted.push({ text: d.text, at: now.getTime(), id: d.id });
  }
}
return { tax: posted.filter((p) => p.id.startsWith("quarterly-tax")).length, total: posted.length };
}
const before = simulate(false), after = simulate(true);
const ok = after.tax <= 1 && before.tax > 1;
console.log(`${ok ? "✅" : "❌"} quarterly-tax posts 20/12/2026–20/01/2027: old rule ${before.tax} → new rule ${after.tax} (≤ 1) · total posts ${after.total}`);
process.exit(ok ? 0 : 1);
