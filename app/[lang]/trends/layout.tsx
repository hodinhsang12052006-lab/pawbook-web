import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/trends", {
    title: ["Xu hướng nail tuần này", "Nail trends this week"],
    description: [
      "Mẫu được yêu thích, hashtag đang lên và lương theo bang, từ hoạt động trên PawNail.",
      "Most-loved designs, rising hashtags and pay by state, from activity on PawNail.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
