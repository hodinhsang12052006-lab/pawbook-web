"use client";

import React, { use } from "react";
import Navbar from "@/components/layout/Navbar";
import NailMenu from "@/components/menu/NailMenu";
import { useTr } from "@/lib/i18n/useTr";

// /menu/[uid] — trang menu riêng (link chia sẻ / mã QR dán ở quầy).
export default function MenuPage({ params }: { params: Promise<{ uid: string }> }) {
  useTr();
  const { uid } = use(params);
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:pb-12">
        <NailMenu userId={uid} header />
      </main>
    </div>
  );
}
