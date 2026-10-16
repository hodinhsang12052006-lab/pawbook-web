import type { Metadata } from "next";

export const metadata: Metadata = { title: "Đánh giá buổi làm nail — PawNail Jobs", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
