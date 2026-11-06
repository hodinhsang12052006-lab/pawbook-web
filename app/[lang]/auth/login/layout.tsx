import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng (layout cha app/auth/layout.tsx là client component nên
// không khai báo metadata được ở đó).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/login", {
    title: ["Đăng nhập", "Log in"],
    description: [
      "Đăng nhập để nhắn tin với tiệm, thợ và quản lý lịch hẹn, tin tuyển.",
      "Log in to message salons and techs and manage bookings and jobs.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
