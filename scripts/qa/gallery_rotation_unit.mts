// Bài ảnh "✨ 4 mẫu nail" vẫn đăng khi MỌI mẫu Flow đã từng được giới thiệu (lỗi thật: ảnh Flow nhập lên các mẫu cũ
// đã giới thiệu → từ 12/11/2026 không còn bài ảnh nào trên bảng tin). Chạy trên BẢN CHÉP DB QA local, không production:
//   env -u TURSO_AUTH_TOKEN TURSO_DATABASE_URL="file:<bản chép DB QA>" npx tsx scripts/qa/gallery_rotation_unit.mts
if (!String(process.env.TURSO_DATABASE_URL || "").startsWith("file:")) throw new Error("Chỉ chạy trên DB file local (bản chép DB QA)");
const prisma = (await import("../../lib/prisma")).default;
const { publishDesignGallery, GALLERY_PREFIX } = await import("../../lib/designGallery");
let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + JSON.stringify(detail)}`);
};

const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
process.env.OFFICIAL_ACCOUNT_ID = admin!.id;
// 20 mẫu Flow đã đăng, ảnh https, quanh năm (đủ để không lặp 12 mẫu của ngày gần nhất) — DB QA ít mẫu thì tạo thêm
const stamp = Date.now();
for (let i = 0; i < 20; i++) {
  await prisma.nailDesign.create({
    data: {
      id: `qagal${stamp}${String(i).padStart(2, "0")}`, day: "2026-11-20", market: "US", title: `QA mẫu quay vòng ${i}`, titleEn: `QA rotation ${i}`,
      description: "Mẫu thử", descriptionEn: "Test", skills: "Gel-X", difficulty: 1, minutes: 45, priceHint: "$45", materials: "[]", steps: "[]",
      imageUrl: `https://res.cloudinary.com/demo/image/upload/v1/qa_gallery_${stamp}_${i}.jpg`, provider: "sample", prompt: `qa[flow:QG${i}:2026-11-20]`,
      status: "published", publishedAt: new Date(stamp - i * 1000), occasion: null,
    },
  });
}
await prisma.post.deleteMany({ where: { authorId: admin!.id, content: { startsWith: GALLERY_PREFIX } } });
const flowIds = (await prisma.nailDesign.findMany({ where: { prompt: { contains: "[flow:" } }, select: { id: true } })).map((d) => d.id);
await prisma.appSetting.upsert({ where: { key: "gallery_featured_designs" }, update: { value: JSON.stringify(flowIds) }, create: { key: "gallery_featured_designs", value: JSON.stringify(flowIds) } });

const r1 = await publishDesignGallery(new Date());
const post = await prisma.post.findFirst({ where: { authorId: admin!.id, content: { startsWith: GALLERY_PREFIX } }, orderBy: { createdAt: "desc" } });
ok("G1", "Mọi mẫu Flow đã từng giới thiệu → vẫn đăng bài 4 ảnh (quay vòng), không còn 'chưa đủ 4 mẫu Flow'", r1.posted === true && r1.ids?.length === 4, r1);
ok("G1b", "Quay vòng nhưng KHÔNG lặp 12 mẫu giới thiệu gần nhất", !(r1.ids || []).some((id) => flowIds.slice(-12).includes(id)), { ids: r1.ids, n: flowIds.length });
ok("G2", "Bài có đủ 4 ảnh https của mẫu Flow", !!post && JSON.parse(post.mediaUrls || "[]").filter((u: string) => u.startsWith("https://")).length === 4, post?.mediaUrls);
const r2 = await publishDesignGallery(new Date());
ok("G3", "Gọi lại ngay → không đăng chồng (chờ lượt sau)", r2.posted === false && /chờ lượt sau/.test(r2.reason || ""), r2);

console.log(`\nBài ảnh mẫu nail (quay vòng): ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
