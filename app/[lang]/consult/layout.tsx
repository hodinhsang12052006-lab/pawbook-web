import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/consult", {
    title: ["Soi tay tư vấn", "Hand consult for nail pros"],
    description: [
      "Chụp tay khách (khi khách đồng ý) để có tóm tắt tình trạng móng, dịch vụ nên làm và mẫu phù hợp.",
      "Photograph a client's hands, with their consent, for a nail-condition summary, a suggested service and matching designs.",
    ],
    noindex: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
