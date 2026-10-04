import type { Metadata } from "next";

// Tiêu đề tab riêng (layout cha app/auth/layout.tsx là client component nên
// không khai báo metadata được ở đó).
export const metadata: Metadata = {
  title: "Đăng nhập — PawNail Jobs",
  description: "Đăng nhập PawNail Jobs — việc làm & tay nghề nail tại Mỹ và Úc.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
