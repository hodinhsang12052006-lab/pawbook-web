import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";

// Admin duyệt "Tâm sự ẩn danh":
//   GET  → bài đang chờ (không hiện tên người gửi cho admin — chỉ vai trò + bang, giữ đúng lời hứa ẩn danh)
//   POST { postId, decision: "approve" | "reject" }
async function admin() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return me?.role === "ADMIN" ? id : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const rows = await prisma.post.findMany({
    where: { anonymous: true, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, content: true, createdAt: true, state: true, author: { select: { role: true } } },
  });
  return NextResponse.json({ pending: rows.map((r) => ({ id: r.id, content: r.content, createdAt: r.createdAt.toISOString(), state: r.state, role: r.author.role })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { postId?: unknown; decision?: unknown } | null;
  const postId = typeof b?.postId === "string" ? b.postId : "";
  const decision = b?.decision === "approve" ? "published" : b?.decision === "reject" ? "rejected" : null;
  if (!postId || !decision) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const post = await prisma.post.findFirst({ where: { id: postId, anonymous: true, status: "pending" }, select: { authorId: true } });
  if (!post) return NextResponse.json({ error: "Không tìm thấy bài chờ duyệt." }, { status: 404 });
  // Duyệt → lên đầu bảng tin (giờ đăng = lúc duyệt)
  await prisma.post.update({ where: { id: postId }, data: decision === "published" ? { status: decision, createdAt: new Date() } : { status: decision } });
  await sendPush(post.authorId, decision === "published"
    ? { title: "🤫 Tâm sự của bạn đã lên bảng tin", body: "Mọi người đang đọc — vào xem bình luận nhé.", url: "/?tab=feed", tag: "pn-anon-ok" }
    : { title: "Tâm sự chưa được đăng", body: "Bài có nêu tên tiệm/người hoặc thông tin riêng — bạn sửa lại rồi gửi lại nhé.", url: "/?tab=feed", tag: "pn-anon-no" }).catch(() => 0);
  return NextResponse.json({ ok: true, status: decision });
}
