import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab + bản xem trước theo ngôn ngữ (page.tsx là client component).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/tryon", {
    title: ["Thử mẫu nail trên tay — PawNail Try-On", "PawNail Try-On — try nail looks on your hand"],
    description: [
      "Chụp ảnh bàn tay, xem 10 mẫu gợi ý trên chính móng của bạn. Xử lý ngay trên điện thoại.",
      "Take a photo of your hand and see 10 suggested looks on your own nails. It runs on your phone.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
