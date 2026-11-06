// Khách ĐÃ ĐĂNG NHẬP gửi yêu cầu đặt lịch → gắn yêu cầu vào tài khoản khách, để khách xem lại ("Lịch hẹn của
// tôi": mới / đã hẹn / từ chối + giờ đã chốt) và nhận thông báo khi thợ xác nhận / từ chối. CHỈ chạy trên máy chủ.
//
// Lưu ở bảng AppSetting có sẵn thay vì thêm cột BookingRequest.clientId (thêm cột cần chạy SQL lên Turso TRƯỚC
// khi deploy, quên là mọi truy vấn lịch hẹn đều lỗi — cùng cách với lib/userLocale.ts, lib/postEn.ts):
//   "booking.client:<bookingId>"  → id khách
//   "client.bookings:<clientId>"  → JSON [bookingId…] (mới nhất trước, tối đa 100)
// Khách đặt KHÔNG cần tài khoản vẫn như cũ (chỉ thợ thấy, thợ gọi / nhắn SMS).
import prisma from "@/lib/prisma";

const LINK = (bookingId: string) => `booking.client:${bookingId}`;
const INDEX = (clientId: string) => `client.bookings:${clientId}`;
const MAX = 100;

export async function linkBookingToClient(bookingId: string, clientId: string): Promise<void> {
  if (!bookingId || !clientId) return;
  try {
    await prisma.appSetting.upsert({ where: { key: LINK(bookingId) }, update: { value: clientId }, create: { key: LINK(bookingId), value: clientId } });
    const cur = await prisma.appSetting.findUnique({ where: { key: INDEX(clientId) }, select: { value: true } });
    let ids: string[] = [];
    try {
      ids = JSON.parse(cur?.value || "[]");
    } catch {}
    const next = JSON.stringify([bookingId, ...ids.filter((x) => x !== bookingId)].slice(0, MAX));
    await prisma.appSetting.upsert({ where: { key: INDEX(clientId) }, update: { value: next }, create: { key: INDEX(clientId), value: next } });
  } catch (err) {
    console.error("linkBookingToClient error:", err);
  }
}

export async function clientOfBooking(bookingId: string): Promise<string | null> {
  try {
    return (await prisma.appSetting.findUnique({ where: { key: LINK(bookingId) }, select: { value: true } }))?.value ?? null;
  } catch {
    return null;
  }
}

export async function clientBookingIds(clientId: string): Promise<string[]> {
  try {
    const v = (await prisma.appSetting.findUnique({ where: { key: INDEX(clientId) }, select: { value: true } }))?.value;
    const ids = JSON.parse(v || "[]");
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Lịch hẹn của 1 khách (mới nhất trước) — chỉ những gì khách cần xem, KHÔNG có ghi chú nội bộ của thợ. */
export async function clientBookings(clientId: string) {
  const ids = await clientBookingIds(clientId);
  if (!ids.length) return [];
  const rows = await prisma.bookingRequest.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, itemName: true, itemPrice: true, preferredDate: true, preferredTime: true, status: true, scheduledFor: true, locale: true, createdAt: true, updatedAt: true,
      tech: { select: { id: true, name: true, avatarUrl: true, role: true, market: true, city: true, state: true, jobs: { select: { salonName: true }, orderBy: { createdAt: "asc" }, take: 1 } } },
    },
  });
  return rows.map(({ tech, ...b }) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    tech: { id: tech.id, name: (tech.role === "OWNER" && tech.jobs[0]?.salonName?.trim()) || tech.name, avatarUrl: tech.avatarUrl, market: tech.market, city: tech.city, state: tech.state },
  }));
}
