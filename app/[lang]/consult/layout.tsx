import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/consult", {
    title: ["Soi tay tư vấn", "Hand consult"],
    description: [
      "Chụp tay khách → tình trạng móng & da, quy trình nên làm và những mẫu nail hợp nhất. Công cụ cho thợ nail và chủ tiệm.",
      "Photograph a client's hand to see nail and skin condition, the recommended service steps and the designs that suit them best. A tool for nail techs and salon owners.",
    ],
    noindex: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
