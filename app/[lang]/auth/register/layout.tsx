import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng (layout cha app/auth/layout.tsx là client component nên
// không khai báo metadata được ở đó).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/register", {
    title: ["Tạo tài khoản", "Create your account"],
    description: [
      "Tạo tài khoản PawNail — thử mẫu nail, gửi yêu cầu đặt lịch, giới thiệu tay nghề và tìm việc nail tại Mỹ và Úc.",
      "Create a PawNail account — try on nail looks, request salon bookings, show your work and find nail tech jobs in the US & Australia.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
