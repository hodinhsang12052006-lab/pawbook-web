"use client";

import React, { useEffect } from "react";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Production Server Component errors arrive with the message redacted
    // ("...omitted in production builds...") — the digest is the only thing
    // that ties this to a specific server-side log line, so it must be
    // logged even though it looks redundant with error.message.
    console.error(`Route error boundary caught an error (digest: ${error.digest ?? "none"}):`, error);
  }, [error]);

  // Không hiện error.message cho người dùng — vừa khó hiểu, vừa có thể lộ
  // chi tiết nội bộ; chi tiết đã được log ở trên (và gửi Sentry).
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 px-6 text-center text-white select-none">
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-black">Đã có lỗi xảy ra</h2>
        <p className="text-sm text-slate-400">Vui lòng thử tải lại. Nếu vẫn lỗi, hãy quay lại sau ít phút.</p>
        {error.digest && <p className="text-[10px] text-slate-600 font-mono">Mã lỗi: {error.digest}</p>}
      </div>
      <button
        onClick={() => reset()}
        className="min-h-[48px] w-full max-w-sm rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 px-6 text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
      >
        Tải lại trang
      </button>
    </div>
  );
}
