import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import TermsContent from "@/components/legal/TermsContent";

export const metadata: Metadata = {
  title: "Điều khoản dịch vụ · Terms of Service — PawNail Jobs",
  description: "Điều khoản dịch vụ của PawNail Jobs · Terms of Service for PawNail Jobs, connecting nail salons and nail techs in the US & Australia.",
};

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
