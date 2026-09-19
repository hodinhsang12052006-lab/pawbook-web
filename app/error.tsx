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

  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen text-white bg-gray-900 select-none">
      <h2 className="text-2xl font-bold text-red-500 mb-4">🚨 ỨNG DỤNG BỊ CRASH</h2>
      <p className="bg-black p-4 rounded text-red-300 font-mono text-sm max-w-2xl overflow-auto w-full break-words">
        {error.message || "Lỗi không xác định"}
      </p>
      <button onClick={() => reset()} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-bold transition-all active:scale-95 cursor-pointer">
        🔄 Tải lại trang
      </button>
    </div>
  );
}
