"use client";

// Thử mẫu PawNail (trang riêng, /tryon): khách thử mẫu trên tay mình rồi đưa tiệm xem; thợ dùng ngay tại quầy.
import React from "react";
import Link from "next/link";
import { Sparkles, Store } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import NailStudio from "@/components/studio/NailStudio";
import { useSessionUser } from "@/lib/SessionUserContext";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function TryOnPage() {
  useTr();
  const { user } = useSessionUser();
  const isClient = !user || user.role === "CLIENT";
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-6 pb-28">
        <header className="space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-300 ring-1 ring-pink-500/25"><Sparkles className="h-3.5 w-3.5" />{tr("Thử mẫu PawNail", "PawNail Try-On")}</p>
          <h1 className="text-2xl font-black tracking-tight text-white [text-wrap:balance]">{isClient ? tr("Thử mẫu nail trên chính tay bạn", "Try nail looks on your own hand") : tr("Tạo mẫu trên tay khách", "Try-on looks for your client")}</h1>
          <p className="text-sm text-slate-400 [text-wrap:pretty]">
            {isClient
              ? tr("Chụp mu bàn tay — PawNail tự nhận móng, soi tông da + dáng móng của bạn rồi vẽ 10 mẫu trend hợp tay ngay trên móng thật. Thích mẫu nào thì đưa tiệm xem.", "Snap the back of your hand — PawNail finds your nails, reads your skin tone and nail shape, then paints 10 trending looks that suit you right on your real nails. Show your favourite to a salon.")
              : tr("Chụp tay khách — máy tự nhận móng, soi tông da + dáng móng, vẽ 10 mẫu trend hợp tay khách kèm giá gợi ý. Lưu ảnh hoặc gửi khách trong tin nhắn (nút ✨).", "Snap the client's hand — we find the nails, read skin tone and nail shape, and paint 10 trending looks that suit the client, with suggested prices. Save, or send from Messages (✨ button).")}
          </p>
        </header>
        <NailStudio market={user?.market === "AU" ? "AU" : "US"} />
        {isClient && (
          <Link href="/salons" className="flex items-center gap-3 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <Store className="h-6 w-6 flex-shrink-0 text-amber-300" />
            <span className="text-sm font-bold text-white">{tr("Tìm tiệm làm mẫu bạn thích →", "Find a salon for your favourite look →")}</span>
          </Link>
        )}
      </main>
    </div>
  );
}
