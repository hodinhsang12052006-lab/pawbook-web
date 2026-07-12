"use client";

import React, { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Messages error boundary triggered:", error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-6">
        <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400 max-w-lg w-full">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold">Đã xảy ra lỗi khi kết nối khu chat</h4>
            <p className="text-xs text-red-450 leading-relaxed">
              {error.message || "Kết nối WebSocket hoặc API với Vercel Server gặp sự cố tạm thời."}
            </p>
          </div>
        </div>
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/20 active:scale-98 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Thử tải lại hộp thư</span>
        </button>
      </main>
    </div>
  );
}
