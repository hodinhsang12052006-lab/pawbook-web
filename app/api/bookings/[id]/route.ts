import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { NEXT, formatPhone, type BookingStatus } from "@/lib/booking";
import { withReviewUrl } from "@/lib/bookingServer";

// PATCH /api/bookings/:id { status, scheduledFor? } — thợ xác nhận / từ chối / đánh dấu đã làm.
// DELETE — thợ xoá hẳn yêu cầu (xoá luôn SĐT khách). Chỉ thợ / tiệm nhận lịch.
async function mine(id: string) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  const row = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!row) return { error: NextResponse.json({ error: "Không tìm thấy lịch hẹn." }, { status: 404 }) };
  if (row.techId !== me) return { error: NextResponse.json({ error: "Không phải lịch của bạn." }, { status: 403 }) };
  return { row };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await mine(id);
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; scheduledFor?: unknown };
  const status = String(body.status ?? "") as BookingStatus;
  const from = r.row.status as BookingStatus;
  if (!(NEXT[from] ?? []).includes(status)) return NextResponse.json({ error: "Không đổi được trạng thái này." }, { status: 400 });
  const scheduledFor = typeof body.scheduledFor === "string" ? body.scheduledFor.replace(/\s+/g, " ").trim().slice(0, 60) || null : r.row.scheduledFor;
  // Đã làm xong → tạo link đánh giá riêng cho đúng lịch này (chỉ khách thật đã đặt mới đánh giá được)
  const reviewToken = status === "done" ? r.row.reviewToken ?? randomBytes(18).toString("base64url") : r.row.reviewToken;
  const row = await prisma.bookingRequest.update({ where: { id }, data: { status, scheduledFor, reviewToken } });
  return NextResponse.json({ booking: withReviewUrl(req, { ...row, phoneDisplay: formatPhone(row.clientPhone) }) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await mine(id);
  if ("error" in r) return r.error;
  await prisma.bookingRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
