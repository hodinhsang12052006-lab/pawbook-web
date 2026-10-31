"use client";

import React, { useEffect } from "react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useTr(); // render lại khi đổi VI/EN
  useEffect(() => {
    console.error("Global Error boundary caught an error in messages:", error);
  }, [error]);

  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen text-white bg-gray-900 select-none">
      <h2 className="text-2xl font-bold text-red-500 mb-4">{tr("🚨 ỨNG DỤNG BỊ CRASH", "🚨 SOMETHING CRASHED")}</h2>
      <p className="bg-black p-4 rounded text-red-300 font-mono text-sm max-w-2xl overflow-auto w-full break-words">
        {error.message || tr("Lỗi không xác định", "Unknown error")}
      </p>
      <button onClick={() => reset()} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-bold transition-all active:scale-95 cursor-pointer">
        {tr("🔄 Tải lại trang", "🔄 Reload page")}
      </button>
    </div>
  );
}
