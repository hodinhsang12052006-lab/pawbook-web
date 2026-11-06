// Số liệu "cộng đồng" KHÔNG tính bài của tài khoản chính thức (ADMIN) và nói đúng nguồn của tin tổng hợp:
//   - Xu hướng (lib/trends): hashtag nổi / bài hot không lấy bài ADMIN dù có hashtag + lượt thích
//   - Toast hoạt động (/api/activity): không có bài ADMIN; tin tổng hợp không bị nói là tiệm "vừa đăng"
// Chạy trên 1 SQLite TẠM đúng schema (scripts/qa/_temp_sqlite.ts) — không đụng prisma/dev.db, không đụng Turso.
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/community_stats_unit.mts
import { useTempSqlite } from "./_temp_sqlite";
const { db: prisma, cleanup } = useTempSqlite("community_stats");

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

const t = Date.now();
const tag = `QaTag${t}`;
const admin = await prisma.user.create({ data: { email: `cs.admin.${t}@qa.test`, name: `Official ${t}`, password: "x", role: "ADMIN", market: "US" } });
const tech = await prisma.user.create({ data: { email: `cs.tech.${t}@qa.test`, name: `Tech ${t}`, password: "x", role: "TECHNICIAN", market: "US" } });
const fans = await Promise.all([1, 2, 3].map((i) => prisma.user.create({ data: { email: `cs.fan${i}.${t}@qa.test`, name: `Fan ${i}`, password: "x", role: "TECHNICIAN", market: "US" } })));
const IMG = JSON.stringify(["https://res.cloudinary.com/demo/image/upload/sample.jpg"]);
const mkPost = (authorId: string, n: number, tg = tag) => prisma.post.create({ data: { authorId, content: `Mẫu mới #${tg} ${n}`, postType: "GENERAL", mediaUrls: IMG, market: "US", status: "published", anonymous: false } as any });
const adminPosts = [await mkPost(admin.id, 1), await mkPost(admin.id, 2), await mkPost(admin.id, 3)];
for (const p of adminPosts) for (const f of fans) await prisma.postLike.create({ data: { postId: p.id, userId: f.id } as any });
// Đối chứng: bài THÀNH VIÊN thật (thợ) vẫn được tính
const techTag = `QaTech${t}`;
const techPosts = [await mkPost(tech.id, 4, techTag), await mkPost(tech.id, 5, techTag)];
for (const p of techPosts) await prisma.postLike.create({ data: { postId: p.id, userId: fans[0].id } as any });

const { getTrends } = await import("../../lib/trends");
const tr1 = await getTrends("US" as any);
ok("C1", "Bài ADMIN có hashtag + ảnh + lượt thích KHÔNG thành hashtag nổi / bài hot của cộng đồng", !tr1.hashtags.some((h) => h.tag.toLowerCase() === tag.toLowerCase()) && !tr1.hotPosts.some((p) => adminPosts.some((a) => a.id === p.id)), JSON.stringify({ tags: tr1.hashtags.slice(0, 5), hot: tr1.hotPosts.map((p) => p.id) }));
ok("C1b", "Đối chứng: hashtag + bài hot của THỢ thật vẫn được tính", tr1.hashtags.some((h) => h.tag.toLowerCase() === techTag.toLowerCase()) && techPosts.every((tp) => tr1.hotPosts.some((p) => p.id === tp.id)), JSON.stringify({ tags: tr1.hashtags.slice(0, 5), hot: tr1.hotPosts.map((p) => p.id) }));

const act = await import("../../app/api/activity/route");
const ev1 = (await (await act.GET()).json()) as { kind: string; title: string; text: string; href?: string; actor?: { id: string } }[];
ok("C2", "Toast hoạt động không có bài của tài khoản chính thức; bài thợ thật vẫn có", !ev1.some((e) => e.kind === "post" && e.actor?.id === admin.id) && ev1.some((e) => e.kind === "post" && e.actor?.id === tech.id), JSON.stringify(ev1.filter((e) => e.kind === "post")));

// Tin từ nhóm cộng đồng (source=ingest) vừa nhận: toast ghi "Từ nhóm cộng đồng PawNail … đang tuyển", không "vừa đăng"
const owner = await prisma.user.create({ data: { email: `cs.owner.${t}@qa.test`, name: "Owner", password: "x", role: "OWNER", market: "US" } });
const ing = await prisma.job.create({ data: { ownerId: owner.id, title: "Cần thợ Bột", salonName: `Agg Nails ${t}`, description: "x", market: "US", state: "TX", city: "Houston", salaryType: "Bao lương tuần", salaryAmount: "$1,200/tuần", skills: "Bột/Acrylic", benefits: "", phone: "(713) 555-0142", source: "ingest", sourcePostedAt: new Date(), expiresAt: new Date(Date.now() + 5 * 86400e3) } as any });
const ev2 = (await (await act.GET()).json()) as { kind: string; title: string; text: string; href?: string; en?: { title: string; text: string } }[];
const agg = ev2.find((e) => e.href === `/jobs/${ing.id}`);
ok("C3", "Toast: tin từ nhóm ghi 'Từ nhóm cộng đồng PawNail / Shared from PawNail community groups', không nói tiệm 'vừa đăng / just posted'", !!agg && agg.title === "Từ nhóm cộng đồng PawNail" && !/vừa đăng/.test(agg.text) && agg.en?.title === "Shared from PawNail community groups" && !/just posted/.test(agg.en?.text || ""), JSON.stringify(agg));

await prisma.job.delete({ where: { id: ing.id } });
await prisma.postLike.deleteMany({ where: { postId: { in: [...adminPosts, ...techPosts].map((p) => p.id) } } });
await prisma.post.deleteMany({ where: { id: { in: [...adminPosts, ...techPosts].map((p) => p.id) } } });
await prisma.user.deleteMany({ where: { id: { in: [admin.id, tech.id, owner.id, ...fans.map((f) => f.id)] } } });
await cleanup();
console.log(`\nSố liệu cộng đồng: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
