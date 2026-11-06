import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { translatePost, translateEnabled } from "@/lib/translateEn";
import { joinEn, splitEn } from "@/lib/officialEn";

// GET /api/posts/[id]/translate?to=en|vi — "Xem bản dịch" trên bảng tin.
//  - Chỉ người đã đăng nhập (giới hạn 40 lượt/giờ/người, đệm trong bộ nhớ máy chủ).
//  - Bài chính thức (ADMIN) dịch sang EN: lưu luôn bản EN vào bài (EN_MARK) → lần sau không cần gọi AI.
//  - Bài người dùng: chỉ đệm trong bộ nhớ (không sửa bài của người khác).
const cache = new Map<string, string>();
const hits = new Map<string, number[]>();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id;
  if (!uid) return NextResponse.json({ error: "login" }, { status: 401 });
  if (!translateEnabled()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const { id } = await params;
  const to = new URL(req.url).searchParams.get("to") === "vi" ? "vi" : "en";
  const key = `${id}:${to}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ text: hit });

  const now = Date.now();
  const mine = (hits.get(uid) ?? []).filter((t) => now - t < 3_600_000);
  if (mine.length >= 40) return NextResponse.json({ error: "rate" }, { status: 429 });
  hits.set(uid, [...mine, now]);

  const post = await prisma.post.findUnique({ where: { id }, select: { content: true, status: true, anonymous: true, author: { select: { role: true } } } });
  if (!post || post.status !== "published") return NextResponse.json({ error: "not found" }, { status: 404 });
  const official = post.author.role === "ADMIN";
  const { vi, en } = official ? splitEn(post.content) : { vi: post.content, en: null };
  if (official && to === "en" && en) return NextResponse.json({ text: en });
  const text = await translatePost(vi, to);
  if (!text) return NextResponse.json({ error: "failed" }, { status: 502 });
  if (cache.size > 800) cache.delete(cache.keys().next().value as string);
  cache.set(key, text);
  if (official && to === "en") await prisma.post.update({ where: { id }, data: { content: joinEn(vi, text) } }).catch(() => {});
  return NextResponse.json({ text });
}
