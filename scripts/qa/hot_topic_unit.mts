// Chủ đề nóng: chấm điểm theo tín hiệu tool → đăng bài thảo luận + thăm dò; không trùng trong ngày / 10 ngày.
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/qa/hot_topic_unit.mts
import prismaMod from "../../lib/prisma";
import { publishHotTopicPost, recordTopicSignals, TOPIC_BANK } from "../../lib/hotTopics";
const prisma = ((prismaMod as unknown as { default?: typeof prismaMod }).default ?? prismaMod);

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

const admin = await prisma.user.create({ data: { email: `hot.${Date.now()}@qa.test`, name: "PawNail QA", password: "x", role: "ADMIN" } });
process.env.OFFICIAL_ACCOUNT_ID = admin.id;
await prisma.appSetting.deleteMany({ where: { key: { in: ["hot_topic_scores", "hot_topic_last"] } } });
const now = new Date(Date.UTC(2026, 9, 13, 1));
await recordTopicSignals([{ topic: "khách bỏ về không trả tiền, bùng hẹn", likes: 300, comments: 200 }, { topic: "chia turn", likes: 5, comments: 1 }], now.getTime());
const r1 = await publishHotTopicPost(now);
const p1 = await prisma.post.findFirst({ where: { authorId: admin.id }, include: { poll: true } });
ok("H1", "Chủ đề nóng nhất theo tín hiệu (khách bùng/quỵt) được đăng, kèm thăm dò 4 lựa chọn", r1.key === "no-pay" && !!p1?.poll && JSON.parse(p1.poll.options).length === 4 && p1.content.startsWith("💬"), JSON.stringify(r1));
ok("H2", "Bài không chứa tên người / nội dung gốc từ nhóm (chỉ bài PawNail tự viết)", !/bùng hẹn, likes/.test(p1?.content || ""));
const r2 = await publishHotTopicPost(new Date(now.getTime() + 3600e3));
ok("H3", "Cùng ngày → không đăng chủ đề thứ 2", r2.posted === false);
const keys: string[] = [r1.key!];
for (let d = 1; d <= 5; d++) { const r = await publishHotTopicPost(new Date(now.getTime() + d * 86400e3)); if (r.key) keys.push(r.key); }
ok("H4", "6 ngày liền → 6 chủ đề khác nhau (không lặp trong 10 ngày)", keys.length === 6 && new Set(keys).size === 6, keys.join(","));
ok("H5", "Kho có đủ chủ đề, mỗi chủ đề 2–4 lựa chọn", TOPIC_BANK.length >= 10 && TOPIC_BANK.every((t) => t.options.length >= 2 && t.options.length <= 4));
const posts = await prisma.post.findMany({ where: { authorId: admin.id }, select: { id: true } });
await prisma.post.deleteMany({ where: { id: { in: posts.map((p) => p.id) } } });
await prisma.user.delete({ where: { id: admin.id } });
console.log(`\nChủ đề nóng: ${pass}/${pass + fail} PASS`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
