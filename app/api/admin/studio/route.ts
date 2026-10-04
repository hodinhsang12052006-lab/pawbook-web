import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getSignals } from "@/lib/trendSignals";
import { getIndustryNews } from "@/lib/industryFeed";
import { buildDrafts } from "@/lib/contentDrafts";

// Phòng nội dung (chỉ ADMIN, xác minh trong DB):
//   GET    ?market=US|AU  — tín hiệu + tin ngành + bài nháp + bài đã đăng
//   POST   { kind, title, body, href?, market? } — duyệt & đăng lên bảng tin (PawNail Studio)
//   DELETE { id } — gỡ bài
async function admin() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (me?.role !== Role.ADMIN) return { error: NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 }) };
  return { id };
}

const KINDS = ["pulse", "gap", "salary", "hashtag", "pain", "news", "custom"];

export async function GET(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const market = new URL(req.url).searchParams.get("market") === "AU" ? "AU" : "US";
  const [signals, news] = await Promise.all([getSignals(market), getIndustryNews()]);
  let posts: unknown[] = [];
  try {
    posts = await prisma.studioPost.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  } catch {}
  return NextResponse.json({ signals, news, drafts: buildDrafts(signals, news), posts });
}

export async function POST(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const b = await req.json().catch(() => ({}));
  const ok =
    KINDS.includes(b.kind) &&
    typeof b.title === "string" && b.title.trim().length >= 3 && b.title.length <= 200 &&
    typeof b.body === "string" && b.body.trim().length >= 3 && b.body.length <= 1200 &&
    (b.href == null || (typeof b.href === "string" && b.href.length <= 500 && (/^\/(?!\/)/.test(b.href) || /^https:\/\//.test(b.href))));
  if (!ok) return NextResponse.json({ error: "Bài không hợp lệ." }, { status: 400 });
  try {
    const post = await prisma.studioPost.create({
      data: { kind: b.kind, title: b.title.trim(), body: b.body.trim(), href: b.href || null, market: b.market === "AU" ? "AU" : b.market === "US" ? "US" : null, createdById: a.id! },
    });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    console.error("studio post error:", err);
    return NextResponse.json({ error: "Chưa đăng được (cần tạo bảng StudioPost)." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  try {
    await prisma.studioPost.delete({ where: { id } });
  } catch {}
  return NextResponse.json({ ok: true });
}
