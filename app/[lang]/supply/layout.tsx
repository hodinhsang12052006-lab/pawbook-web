import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/supply", {
    title: ["Chợ vật tư nail", "Nail supply exchange"],
    description: [
      "Tiệm đăng bán vật tư dư; người mua nhắn tin trực tiếp cho người bán.",
      "Salons list surplus nail supplies; buyers message the seller directly.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
