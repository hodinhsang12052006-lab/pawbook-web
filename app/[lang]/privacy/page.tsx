import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";
import Navbar from "@/components/layout/Navbar";
import PrivacyContent from "@/components/legal/PrivacyContent";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/privacy", {
    title: ["Chính sách bảo mật", "Privacy policy"],
    description: [
      "Chính sách bảo mật của PawNail — nền tảng cho tiệm nail, thợ nail và khách tại Mỹ và Úc.",
      "PawNail's Privacy Policy — the platform for nail salons, nail techs and their clients in the US & Australia.",
    ],
  });
}

// Nội dung song ngữ (VI/EN theo nút đổi ngôn ngữ) nằm ở components/legal/PrivacyContent.tsx.
export default function Page() {
  return (
    <div className="flex flex-col min-h-screen text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 pb-24 md:pb-10 space-y-8 text-sm leading-relaxed text-slate-300">
        <PrivacyContent />
      </main>
    </div>
  );
}
