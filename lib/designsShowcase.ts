// Public "real work" blocks of /designs, shared by their GET routes and the server-rendered first paint of /designs
// (lib/designsFirstPaint.ts): one query each, so the static page and the client's later pages agree.
import prisma from "@/lib/prisma";
import { realOnly, realUserWhere } from "@/lib/demo";
import { toPublicMenuItem } from "@/lib/menu";
import { menuI18nFor } from "@/lib/menuI18n";

// ẢNH THẬT thợ & tiệm đăng (bài "Khoe tay nghề" có ảnh) — chỉ lấy ảnh (bỏ video), mới nhất trước.
const isImage = (u: string) => !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) && !/\/video\/upload\//.test(u) && !/images\.unsplash\.com/i.test(u); // ảnh stock không phải tay nghề thật

/** GET /api/designs/community — throws on a DB error (the route answers an empty page). */
export async function communityShowcase(limit: number, offset: number) {
  const rows = await prisma.post.findMany({
    // CHỈ người dùng thật — bài mẫu (seed) dùng ảnh stock, không được gọi là "ảnh thật".
    where: { postType: "SHOWCASE", anonymous: false, status: "published", NOT: [{ mediaUrls: "[]" }, { mediaUrls: "" }], author: realUserWhere },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit + 1,
    select: {
      id: true, content: true, mediaUrls: true, createdAt: true, city: true,
      author: { select: { id: true, name: true, avatarUrl: true, role: true, city: true } },
      _count: { select: { likes: true } },
    },
  });
  const items = rows.slice(0, limit).flatMap((p) => {
    let media: unknown = [];
    try { media = JSON.parse(p.mediaUrls); } catch {}
    const images = (Array.isArray(media) ? media : []).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u) && isImage(u));
    if (!images.length) return [];
    return [{
      id: p.id, image: images[0], count: images.length, caption: p.content.slice(0, 140), likes: p._count.likes,
      createdAt: p.createdAt.toISOString(), city: p.city || p.author.city,
      author: { id: p.author.id, name: p.author.name, avatarUrl: p.author.avatarUrl, role: p.author.role },
    }];
  });
  return { items, hasMore: rows.length > limit };
}

// Mẫu có ẢNH THẬT trong menu của thợ / tiệm. Bỏ mẫu chép từ kho PawNail mà vẫn dùng ảnh AI (thư mục pawbook/designs):
// chỉ khoe tay nghề thật.
/** GET /api/menu/showcase — throws on a DB error. */
export async function menuShowcase(limit: number) {
  const rows = await prisma.menuItem.findMany({
    where: { active: true, images: { not: "[]" }, NOT: { images: { contains: "/pawbook/designs/" } }, owner: { role: { in: ["TECHNICIAN", "OWNER"] }, ...realOnly() } }, // không khoe menu của tài khoản mẫu
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { owner: { select: { id: true, name: true, avatarUrl: true, city: true } } },
  });
  const i18n = await menuI18nFor(rows);
  return rows.map((r) => ({ ...toPublicMenuItem(r, false, i18n.get(r.id)), owner: r.owner }));
}
