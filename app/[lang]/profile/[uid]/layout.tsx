import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { alternates, langFrom, openGraph, trL } from "@/lib/i18n/server";

type Params = Promise<{ lang: string; uid: string }>;

const ROLE: Record<string, [vi: string, en: string]> = {
  ADMIN: ["Tài khoản chính thức", "Official account"],
  OWNER: ["Tiệm nail", "Nail salon"],
  CLIENT: ["Thành viên PawNail", "PawNail member"],
  TECHNICIAN: ["Thợ nail", "Nail technician"],
};

// Tiêu đề tab + bản xem trước khi chia sẻ link hồ sơ: tên + vai trò (+ thành phố).
// Chỉ dùng thông tin công khai.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { uid } = await params;
  const lang = await langFrom(params);
  const fallback = { title: trL(lang, "Hồ sơ", "Profile") };
  try {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, role: true, city: true } });
    if (!u) return fallback;
    const role = trL(lang, ...(ROLE[u.role] ?? ROLE.TECHNICIAN));
    const showCity = u.city && (u.role === "OWNER" || u.role === "TECHNICIAN");
    const title = `${u.name} · ${role}${showCity ? trL(lang, ` tại ${u.city}`, ` in ${u.city}`) : ""}`;
    const description =
      u.role === "OWNER"
        ? trL(lang, "Ảnh tiệm, tin tuyển, menu và đánh giá trên PawNail.", "Salon photos, open jobs, menu and reviews on PawNail.")
        : u.role === "TECHNICIAN"
          ? trL(lang, `Ảnh tay nghề, kỹ năng và đánh giá. Nhắn tin cho ${u.name} trên PawNail.`, `Portfolio, skills and reviews. Message ${u.name} on PawNail.`)
          : trL(lang, `Hồ sơ của ${u.name} trên PawNail.`, `${u.name} on PawNail.`);
    return { title, description, alternates: alternates(`/profile/${uid}`, lang), openGraph: openGraph(lang, { title, description }) };
  } catch {
    return fallback;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
