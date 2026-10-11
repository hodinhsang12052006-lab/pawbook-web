import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { findPhone, parseJobPost } from "@/lib/jobIngest/parse";
import { blockPhone, ingestBatch, INGEST_SOURCE } from "@/lib/jobIngest/ingest";

// Admin: đăng hộ tiệm bằng tay + xử lý yêu cầu "Nhận tin" / "Gỡ tin".
//   GET                                   → yêu cầu đang chờ + thống kê tin đăng hộ
//   POST { action: "preview", text }       → xem trước kết quả tách (chưa lưu)
//   POST { action: "post", posts: [...] }  → đăng (giống /api/ingest/jobs)
//   POST { action: "resolve", requestId, decision: "remove"|"claim"|"dismiss" }
async function admin() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return me?.role === "ADMIN" ? id : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const now = new Date();
  const [requests, active, expired] = await Promise.all([
    prisma.jobRequest.findMany({ where: { handledAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { job: { select: { id: true, salonName: true, city: true, state: true, phone: true } } } }),
    prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { gt: now } } }),
    prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { lte: now } } }),
  ]);
  return NextResponse.json({ requests, active, expired }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; text?: string; posts?: unknown; requestId?: string; decision?: string };
  if (b.action === "preview") return NextResponse.json(parseJobPost(String(b.text || "").slice(0, 6000)));
  if (b.action === "post") {
    const posts = Array.isArray(b.posts) ? b.posts.slice(0, 200) : [];
    if (!posts.length) return NextResponse.json({ error: "Chưa có bài nào." }, { status: 400 });
    return NextResponse.json(await ingestBatch(posts as never));
  }
  if (b.action === "resolve" && b.requestId) {
    const r = await prisma.jobRequest.findUnique({ where: { id: b.requestId }, include: { job: { select: { id: true, phone: true } } } });
    if (!r) return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404 });
    if (b.decision === "remove") {
      const e164 = findPhone(r.job.phone)?.e164;
      if (e164) await blockPhone(e164); // không đăng lại số này
      await prisma.jobRequest.updateMany({ where: { jobId: r.jobId, handledAt: null }, data: { handledAt: new Date() } });
      await prisma.job.delete({ where: { id: r.jobId } });
      return NextResponse.json({ ok: true, removed: true });
    }
    if (b.decision === "claim") {
      if (!r.userId) return NextResponse.json({ error: "Người gửi chưa đăng nhập — nhờ họ đăng ký tài khoản chủ tiệm rồi gửi lại khi đã đăng nhập." }, { status: 400 });
      const u = await prisma.user.findUnique({ where: { id: r.userId }, select: { role: true } });
      if (u?.role !== "OWNER") return NextResponse.json({ error: "Tài khoản người gửi không phải chủ tiệm." }, { status: 400 });
      await prisma.job.update({ where: { id: r.jobId }, data: { ownerId: r.userId, source: null, sourceKey: null, expiresAt: null } });
      await prisma.jobRequest.update({ where: { id: r.id }, data: { handledAt: new Date() } });
      return NextResponse.json({ ok: true, claimed: true });
    }
    await prisma.jobRequest.update({ where: { id: r.id }, data: { handledAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
}
