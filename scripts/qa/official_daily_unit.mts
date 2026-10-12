// Bài chính thức mỗi ngày (lib/officialDaily.ts) — chạy trên DB local.
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/qa/official_daily_unit.mts
if (process.env.TURSO_DATABASE_URL) throw new Error("Bài test chỉ chạy trên DB local — bỏ TURSO_DATABASE_URL");
import prismaMod from "../../lib/prisma";
const prisma = ((prismaMod as unknown as { default?: typeof prismaMod }).default ?? prismaMod); // ESM ↔ CJS
import { publishDailyOfficialPost } from "../../lib/officialDaily";
import { firstLine } from "../../lib/contentBot";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

const admin = await prisma.user.create({ data: { email: `official.${Date.now()}@qa.test`, name: "PawNail Jobs QA", password: "x", role: "ADMIN" } });
process.env.OFFICIAL_ACCOUNT_ID = admin.id;
const d0 = new Date(Date.UTC(2026, 9, 12, 13));
const titles: string[] = [];
const r1 = await publishDailyOfficialPost(d0);
ok("O1", "Ngày đầu → đăng 1 bài (không phải bài ghim)", r1.posted === true && !String(r1.title).startsWith("📌"), JSON.stringify(r1));
if (r1.title) titles.push(r1.title);
const r2 = await publishDailyOfficialPost(new Date(d0.getTime() + 3600e3));
ok("O2", "1 giờ sau gọi lại → KHÔNG đăng thêm (bài kiến thức cách nhau ≥ 5 giờ, tối đa 2/ngày)", r2.posted === false, JSON.stringify(r2));
// Bài hôm qua phải có createdAt hôm qua để ngày mai được đăng tiếp
await prisma.post.updateMany({ where: { authorId: admin.id }, data: { createdAt: d0 } });
for (let i = 1; i <= 6; i++) {
  const r = await publishDailyOfficialPost(new Date(d0.getTime() + i * 86400e3));
  if (r.title) titles.push(r.title);
  await prisma.post.updateMany({ where: { authorId: admin.id, createdAt: { gt: new Date(d0.getTime() + (i - 1) * 86400e3 + 3600e3) } }, data: { createdAt: new Date(d0.getTime() + i * 86400e3) } });
}
ok("O3", "7 ngày liền → 7 bài, KHÔNG trùng bài nào", titles.length === 7 && new Set(titles).size === 7, titles.join(" | "));
const posts = await prisma.post.findMany({ where: { authorId: admin.id }, select: { content: true, market: true } });
ok("O4", "Xen kẽ thị trường (có cả bài Mỹ/Úc hoặc bài chung)", new Set(posts.map((p) => p.market ?? "ALL")).size >= 2, JSON.stringify(posts.map((p) => p.market)));
ok("O5", "Bài thuế / quyền lợi có ghi nguồn hoặc lưu ý", posts.filter((p) => /thuế|tax|super/i.test(firstLine(p.content))).every((p) => /Nguồn|không thay cho tư vấn/i.test(p.content)));
process.env.OFFICIAL_DAILY_POST = "0";
const off = await publishDailyOfficialPost(new Date(d0.getTime() + 30 * 86400e3));
ok("O6", "OFFICIAL_DAILY_POST=0 → tắt", off.posted === false && off.reason === "đã tắt");
await prisma.post.deleteMany({ where: { authorId: admin.id } });
await prisma.user.delete({ where: { id: admin.id } });
console.log(`\nBài chính thức mỗi ngày: ${pass}/${pass + fail} PASS`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
