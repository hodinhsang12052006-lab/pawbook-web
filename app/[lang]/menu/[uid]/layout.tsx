import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { alternates, langFrom, openGraph, trL } from "@/lib/i18n/server";

type Params = Promise<{ lang: string; uid: string }>;

// Bản xem trước khi chia sẻ link menu (iMessage, WhatsApp, Messenger, Zalo) —
// khách thường quét QR ở quầy: tên thợ / tiệm + số dịch vụ + ảnh bìa mẫu đầu.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { uid } = await params;
  const lang = await langFrom(params);
  const fallback = { title: trL(lang, "Menu dịch vụ nail", "Nail menu & prices") };
  try {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, role: true, city: true } });
    if (!u || (u.role !== "TECHNICIAN" && u.role !== "OWNER")) return fallback;
    const items = await prisma.menuItem.findMany({ where: { ownerId: uid, active: true }, select: { images: true }, orderBy: { sortOrder: "asc" }, take: 30 });
    let cover: string | undefined;
    for (const it of items) {
      try { const a = JSON.parse(it.images); if (Array.isArray(a) && a[0]) { cover = String(a[0]); break; } } catch {}
    }
    const n = items.length;
    const title = trL(lang, `${u.name} — Menu dịch vụ & bảng giá`, `${u.name} — Menu & prices`);
    const description = trL(
      lang,
      `${n} dịch vụ kèm giá và thời gian làm${u.city ? ` tại ${u.city}` : ""}. Gửi yêu cầu đặt lịch trên PawNail.`,
      `${n} ${n === 1 ? "service" : "services"} with prices and timing${u.city ? ` in ${u.city}` : ""}. Request a booking on PawNail.`
    );
    return { title, description, alternates: alternates(`/menu/${uid}`, lang), openGraph: openGraph(lang, { title, description, ...(cover ? { images: [cover] } : {}) }) };
  } catch {
    return fallback;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
