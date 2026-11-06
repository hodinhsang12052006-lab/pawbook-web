"use client";

// /tools — trang gom mọi công cụ (ô "Tất cả công cụ" ở hàng lối tắt trang chủ mobile). Trước đây /tools là 404.
import Navbar from "@/components/layout/Navbar";
import ToolsPanel from "@/components/layout/ToolsPanel";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function ToolsHubPage() {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 pb-28 pt-6 md:pb-10">
        <h1 className="text-2xl font-bold tracking-tight text-white">{tr("Công cụ", "Tools")}</h1>
        <div className="glass-card rounded-2xl p-2">
          <ToolsPanel variant="list" />
        </div>
      </main>
    </div>
  );
}
