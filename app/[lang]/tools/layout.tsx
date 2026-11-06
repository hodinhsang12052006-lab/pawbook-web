import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab cho trang gom công cụ /tools (page.tsx là client component nên không tự khai báo metadata được).
// /tools/radar và /tools/income-tracker có layout riêng, ghi đè tiêu đề này.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/tools", {
    title: ["Công cụ", "Tools"],
    description: [
      "Mọi công cụ PawNail ở một chỗ: tin nhắn, lịch hẹn, thử mẫu, mẫu nail mới, xu hướng và Nail Radar.",
      "Every PawNail tool in one place: messages, bookings, try-on, new nail designs, trends and Nail Radar.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
