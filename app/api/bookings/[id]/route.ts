import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { NEXT, formatPhone, isScheduledIso, type BookingStatus } from "@/lib/booking";
import { withReviewUrl } from "@/lib/bookingServer";
import { clientOfBooking } from "@/lib/bookingClients";
import { notifyUser } from "@/lib/notify";
import { scheduledLabel } from "@/lib/i18n/format";

// PATCH /api/bookings/:id { status, scheduledFor? } — thợ xác nhận / từ chối / đánh dấu đã làm.
// DELETE — thợ xoá hẳn yêu cầu (xoá luôn SĐT khách). Chỉ thợ / tiệm nhận lịch.
async function mine(id: string) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return { error: NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 }) };
  const row = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!row) return { error: NextResponse.json({ error: "Không tìm thấy lịch hẹn.", errorEn: "Couldn't find this booking." }, { status: 404 }) };
  if (row.techId !== me) return { error: NextResponse.json({ error: "Không phải lịch của bạn.", errorEn: "This isn't your booking." }, { status: 403 }) };
  return { row };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await mine(id);
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; scheduledFor?: unknown };
  const status = String(body.status ?? "") as BookingStatus;
  const from = r.row.status as BookingStatus;
  if (!(NEXT[from] ?? []).includes(status)) return NextResponse.json({ error: "Không đổi được trạng thái này.", errorEn: "This status can't be changed." }, { status: 400 });
  // Giờ chốt từ ô chọn ngày + giờ: "YYYY-MM-DDTHH:mm" (hiển thị / SMS định dạng theo ngôn ngữ + thị trường).
  // Xác nhận bắt buộc có giờ hợp lệ; dữ liệu cũ (chữ tự do) vẫn giữ nguyên khi chỉ đổi trạng thái khác.
  if (status === "confirmed" && !isScheduledIso(body.scheduledFor)) return NextResponse.json({ error: "Chọn ngày và giờ hẹn.", errorEn: "Pick a date and time." }, { status: 400 });
  const scheduledFor = isScheduledIso(body.scheduledFor) ? body.scheduledFor : r.row.scheduledFor;
  // Đã làm xong → tạo link đánh giá riêng cho đúng lịch này (chỉ khách thật đã đặt mới đánh giá được)
  const reviewToken = status === "done" ? r.row.reviewToken ?? randomBytes(18).toString("base64url") : r.row.reviewToken;
  const row = await prisma.bookingRequest.update({ where: { id }, data: { status, scheduledFor, reviewToken } });
  // Khách đặt khi đã đăng nhập → báo trong app (chuông) + thông báo đẩy khi thợ xác nhận / từ chối.
  if (status === "confirmed" || status === "declined") {
    const clientId = await clientOfBooking(row.id);
    if (clientId) {
      const tech = await prisma.user.findUnique({ where: { id: row.techId }, select: { name: true, market: true, role: true, jobs: { select: { salonName: true }, orderBy: { createdAt: "asc" }, take: 1 } } });
      const who = (tech?.role === "OWNER" && tech.jobs[0]?.salonName?.trim()) || tech?.name || "PawNail";
      const at = (l: "vi" | "en") => scheduledLabel(row.scheduledFor, l, tech?.market);
      const vi = status === "confirmed" ? `${who} đã xác nhận lịch hẹn của bạn${row.scheduledFor ? `: ${at("vi")}` : ""}.` : `${who} không nhận được lịch này. Bạn thử chọn ngày khác hoặc tiệm khác nhé.`;
      const en = status === "confirmed" ? `${who} confirmed your booking${row.scheduledFor ? `: ${at("en")}` : ""}.` : `${who} can't take this booking. Try another day or salon.`;
      await notifyUser(clientId, row.techId, vi, "/bookings", en).catch(() => {});
    }
  }
  return NextResponse.json({ booking: withReviewUrl(req, { ...row, phoneDisplay: formatPhone(row.clientPhone) }) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await mine(id);
  if ("error" in r) return r.error;
  await prisma.bookingRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
