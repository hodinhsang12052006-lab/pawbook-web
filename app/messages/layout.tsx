import type { Metadata } from "next";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export const metadata: Metadata = { title: "Tin nhắn — PawNail Jobs" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
