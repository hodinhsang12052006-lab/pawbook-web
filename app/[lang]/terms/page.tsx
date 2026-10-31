import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";
import Navbar from "@/components/layout/Navbar";
import TermsContent from "@/components/legal/TermsContent";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/terms", {
    title: ["Điều khoản dịch vụ", "Terms of Service"],
    description: [
      "Điều khoản dịch vụ của PawNail — nền tảng cho tiệm nail, thợ nail và khách tại Mỹ và Úc.",
      "PawNail's Terms of Service — the platform for nail salons, nail techs and their clients in the US & Australia.",
    ],
  });
}

// Nội dung song ngữ (VI/EN theo nút đổi ngôn ngữ) nằm ở components/legal/TermsContent.tsx.
export default function Page() {
  return (
    <div className="flex flex-col min-h-screen text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 pb-24 md:pb-10 space-y-8 text-sm leading-relaxed text-slate-300">
        <TermsContent />
      </main>
    </div>
  );
}
