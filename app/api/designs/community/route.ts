import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/designs/community?limit=&offset= — ẢNH THẬT thợ & tiệm đăng (bài "Khoe tay nghề" có ảnh),
// hiện ở trang Mẫu nail cạnh ý tưởng PawNail. Chỉ lấy ảnh (bỏ video), mới nhất trước.
const isImage = (u: string) => !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) && !/\/video\/upload\//.test(u);

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit")) || 24));
  const offset = Math.min(5000, Math.max(0, Math.floor(Number(sp.get("offset")) || 0)));
  try {
    const rows = await prisma.post.findMany({
      where: { postType: "SHOWCASE", NOT: [{ mediaUrls: "[]" }, { mediaUrls: "" }] },
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
    return NextResponse.json({ items, hasMore: rows.length > limit }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    console.error("GET /api/designs/community error:", err);
    return NextResponse.json({ items: [], hasMore: false });
  }
}
