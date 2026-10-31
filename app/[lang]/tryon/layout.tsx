import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab + bản xem trước theo ngôn ngữ (page.tsx là client component).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/tryon", {
    title: ["PawNail Try-On — Thử mẫu nail trên tay bạn", "PawNail Try-On — See nail looks on your hand"],
    description: [
      "Chụp ảnh bàn tay và xem trước mẫu nail ngay trên tay bạn trước khi đến tiệm.",
      "Take a photo of your hand and preview nail looks on it before you visit the salon.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
