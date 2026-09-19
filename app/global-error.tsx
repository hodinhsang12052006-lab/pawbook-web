"use client";

import React, { useEffect } from "react";

// app/error.tsx only catches errors thrown by page/layout segments NESTED
// under the root layout — it can't catch an error thrown by app/layout.tsx
// itself. Per Next.js docs that case needs a separate app/global-error.tsx,
// which must render its own <html>/<body> since it replaces the entire root
// layout when triggered. Without this file, a crash in the root layout
// renders Next's default unstyled fallback instead of something
// recoverable.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`Root layout error boundary caught an error (digest: ${error.digest ?? "none"}):`, error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="bg-gray-900">
        <div className="p-10 flex flex-col items-center justify-center min-h-screen text-white select-none">
          <h2 className="text-2xl font-bold text-red-500 mb-4">🚨 ỨNG DỤNG BỊ CRASH</h2>
          <p className="bg-black p-4 rounded text-red-300 font-mono text-sm max-w-2xl overflow-auto w-full break-words">
            {error.message || "Lỗi không xác định"}
          </p>
          <button onClick={() => reset()} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-bold transition-all active:scale-95 cursor-pointer">
            🔄 Tải lại trang
          </button>
        </div>
      </body>
    </html>
  );
}
