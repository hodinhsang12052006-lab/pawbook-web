import type { Metadata } from "next";
import prisma from "@/lib/prisma";

// Bản xem trước khi chia sẻ link menu (Zalo, Messenger, FB) — tên thợ / tiệm + số mẫu + ảnh bìa mẫu đầu.
export async function generateMetadata({ params }: { params: Promise<{ uid: string }> }): Promise<Metadata> {
  const { uid } = await params;
  try {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, role: true, city: true } });
    if (!u || (u.role !== "TECHNICIAN" && u.role !== "OWNER")) return { title: "Menu nail — PawNail Jobs" };
    const items = await prisma.menuItem.findMany({ where: { ownerId: uid, active: true }, select: { images: true }, orderBy: { sortOrder: "asc" }, take: 30 });
    let cover: string | undefined;
    for (const it of items) {
      try { const a = JSON.parse(it.images); if (Array.isArray(a) && a[0]) { cover = String(a[0]); break; } } catch {}
    }
    const title = `Menu nail của ${u.name} — PawNail Jobs`;
    const description = `${items.length} mẫu nail kèm giá, thời gian làm${u.city ? ` tại ${u.city}` : ""}. Chọn mẫu và nhắn đặt lịch trực tiếp.`;
    return { title, description, openGraph: { title, description, ...(cover ? { images: [cover] } : {}) } };
  } catch {
    return { title: "Menu nail — PawNail Jobs" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
