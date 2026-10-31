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
    const description = trL(
      lang,
      `Xem tay nghề, đánh giá và nhắn tin trực tiếp với ${u.name} trên PawNail.`,
      `See ${u.name}'s work and reviews, and message them directly on PawNail.`
    );
    return { title, description, alternates: alternates(`/profile/${uid}`, lang), openGraph: openGraph(lang, { title, description }) };
  } catch {
    return fallback;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
