import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/tools/radar", {
    title: ["Nail Radar — lương tham khảo theo bang", "Nail Radar — pay benchmarks by state"],
    description: [
      "Mức bao lương và chia turn ước tính theo bang và kỹ năng, để tham khảo.",
      "Estimated weekly pay and commission splits for nail techs by state and skill, for reference.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
