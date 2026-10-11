// Nội dung mỗi ngày: tin ngành → bài viết (Gemini giả, chống bịa số) + bài "4 mẫu nail hôm nay".
//   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/qa/content_daily_unit.mts
import http from "node:http";
import prismaMod from "../../lib/prisma";
const prisma = ((prismaMod as unknown as { default?: typeof prismaMod }).default ?? prismaMod);

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

// Gemini giả: trả bài viết theo tiêu đề tin; tin "BỊA" thì AI chèn con số không có trong nguồn
const gem = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const prompt = JSON.parse(b).contents[0].parts[0].text as string;
    const fake = prompt.includes("Salon tariffs");
    const out = {
      hook: fake ? "💸 Giá vật tư sắp tăng 37%?" : "⚖️ Bang này vừa siết giấy phép tiệm nail — chủ tiệm cần biết",
      points: fake ? ["Thuế nhập khẩu tăng 37% từ tháng sau"] : ["Bang đang xem lại quy định cấp giấy phép cho tiệm nail", "Chi tiết thời hạn áp dụng có trong bài gốc"],
      takeaway: "Chủ tiệm nên theo dõi thông báo của sở cấp phép bang và kiểm tra lại giấy tờ của tiệm.",
      hashtags: ["TinNganhNail", "GiayPhep"],
    };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }));
  });
});
await new Promise<void>((r) => gem.listen(0, "127.0.0.1", () => r()));
const port = (gem.address() as { port: number }).port;
Object.assign(process.env, { GEMINI_API_KEY: "test", GEMINI_ALLOW_TEST: "1", GEMINI_TEST_BASE: `http://127.0.0.1:${port}` });
const { publishNewsPosts } = await import("../../lib/newsPosts");
const { publishDesignGallery } = await import("../../lib/designGallery");

const admin = await prisma.user.create({ data: { email: `content.${Date.now()}@qa.test`, name: "PawNail Jobs QA", password: "x", role: "ADMIN" } });
process.env.OFFICIAL_ACCOUNT_ID = admin.id;
const now = new Date(Date.UTC(2026, 9, 12, 13));
const t = Date.now();
const news = [
  { title: `Texas lawmakers review nail salon licensing rules ${t}`, link: `https://example.com/a-${t}`, source: "KHOU", publishedAt: new Date(now.getTime() - 3600e3).toISOString(), lang: "en" as const, topic: "law" as const, market: "US" as const, summary: null },
  { title: `Salon tariffs hit nail supply costs ${t}`, link: `https://example.com/b-${t}`, source: "Reuters", publishedAt: new Date(now.getTime() - 7200e3).toISOString(), lang: "en" as const, topic: "business" as const, market: "US" as const, summary: null },
  { title: `Sydney nail technicians face new safety checks ${t}`, link: `https://example.com/c-${t}`, source: "ABC News", publishedAt: new Date(now.getTime() - 7200e3).toISOString(), lang: "en" as const, topic: "safety" as const, market: "AU" as const, summary: null },
  { title: `Old story ${t}`, link: `https://example.com/d-${t}`, source: "X", publishedAt: new Date(now.getTime() - 10 * 86400e3).toISOString(), lang: "en" as const, topic: "law" as const, market: "US" as const, summary: null },
];
const r1 = await publishNewsPosts(now, { news, max: 2 });
const posts = await prisma.post.findMany({ where: { authorId: admin.id }, orderBy: { createdAt: "asc" } });
ok("N1", "Đăng 2 tin ngành (Mỹ + Úc), bỏ tin cũ > 4 ngày", r1.posted.length === 2 && !r1.posted.some((x) => x.startsWith("Old")), JSON.stringify(r1));
// Lượt riêng (ngày khác) chỉ có tin mà AI chèn số "37%" không có trong nguồn
const fakeOnly = [{ ...news[1], link: `https://example.com/b2-${t}`, title: `Salon tariffs hit nail supply costs again ${t}`, publishedAt: new Date(now.getTime() + 5 * 86400e3 - 3600e3).toISOString() }];
const rf = await publishNewsPosts(new Date(now.getTime() + 5 * 86400e3), { news: fakeOnly, max: 2 });
const all = await prisma.post.findMany({ where: { authorId: admin.id }, select: { content: true } });
ok("N2", "Tin AI chèn số liệu KHÔNG có trong nguồn ('37%') → bị chặn, không đăng", rf.posted.length === 0 && rf.skipped.some((x) => x.includes("số liệu")) && !all.some((p) => p.content.includes("37%")), JSON.stringify(rf));
const p0 = posts[0]?.content || "";
ok("N3", "Bài có 📰 + ý chính + 'ý nghĩa với thợ/chủ tiệm' + Nguồn & link bài gốc + hashtag", p0.startsWith("📰") && p0.includes("• ") && p0.includes("👉") && p0.includes(`Nguồn: KHOU — https://example.com/a-${t}`) && p0.includes("#TinNganhNail"), p0);
ok("N4", "Gắn đúng thị trường (tin Úc → AU)", posts.some((p) => p.market === "AU") && posts.some((p) => p.market === "US"));
const r2 = await publishNewsPosts(new Date(now.getTime() + 3600e3), { news, max: 2 });
ok("N5", "Cùng ngày đã đủ 2 tin → không đăng thêm", r2.posted.length === 0);
const r3 = await publishNewsPosts(new Date(now.getTime() + 86400e3), { news, max: 2 });
ok("N6", "Ngày sau: tin đã đăng / đã chặn KHÔNG đăng lại", r3.posted.length === 0, JSON.stringify(r3));

// Bài ảnh mẫu
const ids: string[] = [];
for (let i = 0; i < 5; i++) {
  const d = await prisma.nailDesign.create({ data: { day: "2026-10-12", market: "US", title: `Mẫu thử ${t}-${i}`, titleEn: "x", description: "x", descriptionEn: "x", skills: "Gel-X", difficulty: 1, minutes: 30, priceHint: "$40", materials: "[]", steps: "[]", imageUrl: `https://res.cloudinary.com/demo/image/upload/s${i}.jpg`, status: "published", publishedAt: now, provider: "pawnail", prompt: "qa" } });
  ids.push(d.id);
}
const g1 = await publishDesignGallery(now);
const gp = await prisma.post.findFirst({ where: { authorId: admin.id, content: { startsWith: "✨ 4 mẫu nail" } } });
ok("G1", "Bài '4 mẫu nail hôm nay': 4 ảnh, có link /designs và nhãn 'Ảnh minh hoạ AI'", g1.posted === true && JSON.parse(gp?.mediaUrls || "[]").length === 4 && /\/designs/.test(gp?.content || "") && /Ảnh minh hoạ AI/.test(gp?.content || ""), JSON.stringify(g1));
const g2 = await publishDesignGallery(new Date(now.getTime() + 3600e3));
ok("G2", "Cùng ngày → không đăng bài ảnh thứ 2", g2.posted === false);
const g3 = await publishDesignGallery(new Date(now.getTime() + 86400e3));
const used = new Set(g1.ids);
ok("G3", "Ngày sau → không lặp mẫu đã giới thiệu", !g3.posted || !(g3.ids || []).some((x) => used.has(x)), JSON.stringify(g3));

await prisma.post.deleteMany({ where: { authorId: admin.id } });
await prisma.nailDesign.deleteMany({ where: { id: { in: ids } } });
await prisma.user.delete({ where: { id: admin.id } });
gem.close();
console.log(`\nNội dung mỗi ngày (tin ngành + ảnh mẫu): ${pass}/${pass + fail} PASS`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
