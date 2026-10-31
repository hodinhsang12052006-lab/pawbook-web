import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/trends", {
    title: ["Xu hướng nail tuần này", "This week's nail trends"],
    description: [
      "Mẫu nail, màu và kỹ thuật đang lên trong tuần — cập nhật mỗi ngày.",
      "The nail designs, colors and techniques trending this week — updated daily.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
