import type { Metadata } from "next";

// Tiêu đề tab riêng (layout cha app/auth/layout.tsx là client component nên
// không khai báo metadata được ở đó).
export const metadata: Metadata = {
  title: "Đăng ký miễn phí — PawNail Jobs",
  description: "Tạo tài khoản PawNail Jobs miễn phí — thợ tìm việc gấp, chủ tiệm tìm thợ giỏi tại Mỹ & Úc.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
