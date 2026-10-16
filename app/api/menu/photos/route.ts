import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/menu/photos — ảnh THẬT của chính mình (portfolio thợ + bài "Khoe tay nghề") để tạo menu
// nhanh: chọn ảnh → điền tên + giá. Bỏ video, ảnh không phải Cloudinary, ảnh đã có trong menu.
const IMG = /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/[^\s"'<>]+$/i;
const parse = (s: string | null | undefined): string[] => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

export async function GET() {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const [tech, posts, menu] = await Promise.all([
    prisma.technicianProfile.findUnique({ where: { userId: me }, select: { portfolioImages: true } }),
    prisma.post.findMany({ where: { authorId: me, status: "published", anonymous: false, mediaUrls: { not: "[]" } }, orderBy: { createdAt: "desc" }, take: 60, select: { mediaUrls: true, content: true } }),
    prisma.menuItem.findMany({ where: { ownerId: me }, select: { images: true } }),
  ]);
  const used = new Set(menu.flatMap((m) => parse(m.images)));
  const seen = new Set<string>();
  const photos: { url: string; caption: string | null }[] = [];
  const add = (url: string, caption: string | null) => {
    if (!IMG.test(url) || used.has(url) || seen.has(url) || /\/pawbook\/designs\//.test(url)) return;
    seen.add(url);
    photos.push({ url, caption });
  };
  for (const u of parse(tech?.portfolioImages)) add(u, null);
  for (const p of posts) {
    // Chú thích bài → gợi ý tên mẫu (bỏ hashtag, emoji, xuống dòng)
    const cap = p.content.split("\n")[0].replace(/#[\p{L}\p{N}_]+/gu, "").replace(/[\p{Extended_Pictographic}️]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60) || null;
    for (const u of parse(p.mediaUrls)) add(u, cap);
  }
  return NextResponse.json({ photos: photos.slice(0, 60), menuCount: menu.length }, { headers: { "Cache-Control": "private, no-store" } });
}
