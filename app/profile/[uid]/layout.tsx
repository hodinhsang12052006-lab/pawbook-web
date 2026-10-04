import type { Metadata } from "next";
import prisma from "@/lib/prisma";

// Tiêu đề tab + bản xem trước khi chia sẻ link hồ sơ (Zalo, Messenger, FB):
// tên người + vai trò. Chỉ dùng thông tin công khai.
export async function generateMetadata({ params }: { params: Promise<{ uid: string }> }): Promise<Metadata> {
  const { uid } = await params;
  try {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, role: true, city: true } });
    if (!u) return { title: "Hồ sơ — PawNail Jobs" };
    const role = u.role === "OWNER" ? "Chủ tiệm" : "Thợ Nail";
    const title = `${u.name} · ${role} — PawNail Jobs`;
    const description = `Hồ sơ ${role.toLowerCase()} ${u.name}${u.city ? ` tại ${u.city}` : ""} trên PawNail Jobs — xem đánh giá thật, portfolio và nhắn tin trực tiếp.`;
    return { title, description, openGraph: { title, description } };
  } catch {
    return { title: "Hồ sơ — PawNail Jobs" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
