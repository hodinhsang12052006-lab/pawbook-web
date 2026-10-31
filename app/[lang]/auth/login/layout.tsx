import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng (layout cha app/auth/layout.tsx là client component nên
// không khai báo metadata được ở đó).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/login", {
    title: ["Đăng nhập", "Sign in"],
    description: [
      "Đăng nhập PawNail — thử mẫu nail, tìm tiệm và việc làm nail tại Mỹ và Úc.",
      "Sign in to PawNail — nail try-on, salons and nail tech jobs in the US & Australia.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
