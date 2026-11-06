import type { Metadata } from "next";
// Messenger V2 — CSS riêng, chỉ tải trên /messages (mọi quy tắc nằm dưới .pn-msgr)
import "./messenger.css";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export const metadata: Metadata = { title: "Tin nhắn — PawNail Jobs" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
