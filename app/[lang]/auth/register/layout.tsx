import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng (layout cha app/auth/layout.tsx là client component nên
// không khai báo metadata được ở đó).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/register", {
    title: ["Tạo tài khoản", "Create your account"],
    description: [
      "Tham gia PawNail với vai trò khách, thợ nail hoặc chủ tiệm. Không thu phí thợ và tiệm.",
      "Join PawNail as a nail client, technician or salon owner. No fees for techs or salons.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
