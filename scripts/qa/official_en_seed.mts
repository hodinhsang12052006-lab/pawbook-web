// QA: dựng dữ liệu bài CHÍNH THỨC song ngữ trên DB local (file SQLite) để kiểm tra bảng tin EN / VI:
//   - tài khoản chính thức (ADMIN), vài mẫu nail gợi ý (không gọi AI),
//   - 1 bài chính thức cũ CHỈ có tiếng Việt (giống dữ liệu production trước 30/10/2026),
//   - bài ghim "Chào mừng" từ Bot nội dung kèm bản tiếng Anh, bài việc làm tuần này, chủ đề nóng (thăm dò), bài kiến thức.
// CHỈ chạy với DB file local:
//   TURSO_DATABASE_URL="file:<đường dẫn>/qa.db" npx tsx scripts/qa/official_en_seed.mts
import crypto from "node:crypto";

const url = process.env.TURSO_DATABASE_URL || "";
if (!url.startsWith("file:")) {
  console.error("❌ Chỉ chạy với DB file local (TURSO_DATABASE_URL=file:…). Dừng.");
  process.exit(1);
}

const { default: prisma } = await import("../../lib/prisma");
const { buildBotDrafts } = await import("../../lib/contentBot");
const { savePostEn, getPostEn } = await import("../../lib/postEn");
const { generateSamples } = await import("../../lib/aiDesigns");

let official = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
if (!official) {
  official = await prisma.user.create({ data: { email: "official@pawnail.test", name: "PawNail", role: "ADMIN", password: "x", market: "US", state: "TX", city: "Houston" }, select: { id: true } });
}
process.env.OFFICIAL_ACCOUNT_ID = official.id;
console.log("official", official.id);

if ((await prisma.nailDesign.count()) < 8) {
  const us = await generateSamples("US", 8);
  const au = await generateSamples("AU", 4);
  console.log("designs", us.created.length + au.created.length);
}

const now = new Date();
const mk = (content: string, at: Date) => prisma.post.create({ data: { id: "c" + crypto.randomBytes(12).toString("hex"), authorId: official!.id, content, postType: "GENERAL", mediaUrls: "[]", market: null, createdAt: at }, select: { id: true } });

// Bài cũ chỉ có tiếng Việt (không có bản EN) — người xem tiếng Anh KHÔNG được thấy.
const legacy = await mk("📌 Chào mừng đến với PawNail Jobs — bài cũ chỉ có tiếng Việt\n\n• Thợ tìm tiệm, chủ tiệm tìm thợ — nhắn tin, gọi điện trực tiếp.\n• Mẫu nail mới mỗi ngày kèm vật tư & cách làm.\n\n#PawNail", new Date(now.getTime() - 3 * 3600_000));
console.log("legacy VI-only", legacy.id);

// Bài ghim "Chào mừng" mới (Bot nội dung) — có bản tiếng Anh.
const welcome = buildBotDrafts({ market: "US", now, publishedTitles: new Set() }).find((d) => d.id.startsWith("welcome-"));
if (welcome?.textEn) {
  const p = await mk(welcome.text, new Date(now.getTime() - 2 * 3600_000));
  await savePostEn(p.id, welcome.textEn);
  console.log("welcome (EN+VI)", p.id);
}

// Bài "việc làm tuần này" cần ≥ 2 tin mới trong 7 ngày ở 1 bang — dữ liệu seed cũ → làm mới 3 tin cùng bang (chỉ DB local).
const anyJob = await prisma.job.findFirst({ select: { market: true, state: true } });
if (anyJob) {
  const ids = (await prisma.job.findMany({ where: { market: anyJob.market, state: anyJob.state }, select: { id: true }, take: 3 })).map((j) => j.id);
  await prisma.job.updateMany({ where: { id: { in: ids } }, data: { createdAt: new Date(now.getTime() - 3600_000) } });
}
const { publishJobDigest } = await import("../../lib/jobDigestPost");
const { publishHotTopicPost } = await import("../../lib/hotTopics");
const { publishDailyOfficialPost } = await import("../../lib/officialDaily");
console.log("job digest", JSON.stringify(await publishJobDigest(now)));
console.log("hot topic", JSON.stringify(await publishHotTopicPost(now)));
console.log("daily knowledge", JSON.stringify(await publishDailyOfficialPost(new Date(now.getTime() - 6 * 3600_000))));

const mine = await prisma.post.findMany({ where: { authorId: official.id }, select: { id: true, content: true }, orderBy: { createdAt: "desc" } });
const en = await getPostEn(mine.map((p) => p.id));
for (const p of mine) console.log(en.has(p.id) ? "EN+VI " : "VI-only", p.content.split("\n")[0].slice(0, 90), en.has(p.id) ? "| EN: " + en.get(p.id)!.content.split("\n")[0].slice(0, 80) : "");
await prisma.$disconnect();
