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
    <div className="flex min-h-screen select-none flex-col items-center justify-center bg-slate-950 p-10 text-center text-white">
      <h2 className="mb-2 text-2xl font-black text-white">{tr("Không tải được tin nhắn", "Messages couldn't load")}</h2>
      <p className="max-w-md text-sm text-slate-400">{tr("Vui lòng tải lại. Nếu vẫn lỗi, hãy liên hệ hỗ trợ.", "Please reload. If it keeps happening, contact support.")}</p>
      <button onClick={() => reset()} className="mt-6 min-h-[44px] cursor-pointer rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-2 font-bold transition-all active:scale-95">
        {tr("Tải lại", "Reload")}
      </button>
    </div>
  );
}
