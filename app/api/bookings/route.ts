import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { sendPush } from "@/lib/push";
import { STATUSES, dateLabel, formatPhone, parseBooking, TIME_LABEL, type BookingTime } from "@/lib/booking";
import { priceLabel } from "@/lib/menu";

// POST /api/bookings — KHÁCH (không cần tài khoản) gửi yêu cầu đặt lịch cho 1 thợ / tiệm.
//   Chống spam: ô bẫy "website" (bot điền → giả vờ thành công), 5 lần / giờ / IP, 40 lần / ngày / thợ,
//   cùng SĐT gửi lại trong 10 phút → không tạo trùng. SĐT chỉ thợ đó xem được.
// GET /api/bookings?status=new — thợ / tiệm xem lịch hẹn của mình (+ đếm theo trạng thái).
const HOUR = 60 * 60 * 1000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true }, { status: 201 }); // bot
  const parsed = parseBooking(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  const ipKey = `book-ip:${getClientIp(req)}`;
  const techKey = `book-tech:${v.techId}`;
  if (isRateLimited(ipKey, 5, HOUR) || isRateLimited(techKey, 40, 24 * HOUR)) return NextResponse.json({ error: "Bạn gửi hơi nhiều, thử lại sau ít phút nhé." }, { status: 429 });

  const tech = await prisma.user.findUnique({ where: { id: v.techId }, select: { id: true, name: true, role: true } });
  if (!tech || (tech.role !== "TECHNICIAN" && tech.role !== "OWNER")) return NextResponse.json({ error: "Không tìm thấy thợ / tiệm." }, { status: 404 });

  // Tên + giá mẫu lấy từ DB (không tin dữ liệu khách gửi lên)
  let itemName: string | null = null;
  let itemPrice: string | null = null;
  if (v.menuItemId) {
    const it = await prisma.menuItem.findFirst({ where: { id: v.menuItemId, ownerId: tech.id, active: true }, select: { name: true, priceFrom: true, priceTo: true } });
    if (!it) return NextResponse.json({ error: "Mẫu này không còn trong menu." }, { status: 404 });
    itemName = it.name;
    itemPrice = priceLabel(it.priceFrom, it.priceTo);
  }

  const dup = await prisma.bookingRequest.findFirst({
    where: { techId: tech.id, clientPhone: v.clientPhone, menuItemId: v.menuItemId, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ ok: true, id: dup.id, duplicate: true }, { status: 200 });

  recordAttempt(ipKey, HOUR);
  recordAttempt(techKey, 24 * HOUR);
  const row = await prisma.bookingRequest.create({
    data: { techId: tech.id, menuItemId: v.menuItemId, itemName, itemPrice, clientName: v.clientName, clientPhone: v.clientPhone, preferredDate: v.preferredDate, preferredTime: v.preferredTime, note: v.note, locale: v.locale },
    select: { id: true },
  });
  const when = [dateLabel(v.preferredDate, "vi"), v.preferredTime ? TIME_LABEL[v.preferredTime as BookingTime][0].toLowerCase() : ""].filter(Boolean).join(" ");
  await sendPush(tech.id, {
    title: "📅 Khách đặt lịch mới",
    body: `${v.clientName}${itemName ? ` · ${itemName}` : ""}${when ? ` · ${when}` : ""} — bấm để gọi / nhắn xác nhận`,
    url: "/bookings",
    tag: "pn-booking",
  }).catch(() => 0);
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function GET(req: Request) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.get("status"))) ? String(sp.get("status")) : null;
  const [rows, grouped] = await Promise.all([
    sp.get("count") === "1"
      ? Promise.resolve([])
      : prisma.bookingRequest.findMany({ where: { techId: me, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.bookingRequest.groupBy({ by: ["status"], where: { techId: me }, _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, grouped.find((g) => g.status === s)?._count._all ?? 0]));
  return NextResponse.json(
    { counts, bookings: rows.map((r) => ({ ...r, phoneDisplay: formatPhone(r.clientPhone) })) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
