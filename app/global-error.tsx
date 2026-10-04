"use client";

import React, { useEffect } from "react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// app/error.tsx only catches errors thrown by page/layout segments NESTED
// under the root layout — it can't catch an error thrown by app/layout.tsx
// itself. Per Next.js docs that case needs a separate app/global-error.tsx,
// which must render its own <html>/<body> since it replaces the entire root
// layout when triggered. Without this file, a crash in the root layout
// renders Next's default unstyled fallback instead of something
// recoverable.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useTr(); // render lại khi đổi VI/EN
  useEffect(() => {
    console.error(`Root layout error boundary caught an error (digest: ${error.digest ?? "none"}):`, error);
  }, [error]);

  return (
    <html lang="vi">
      {/* Style inline — layout gốc (và globals.css) không chạy khi trang này hiện. */}
      <body style={{ margin: 0, background: "#020617", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{tr("Đã có lỗi xảy ra", "Something went wrong")}</h2>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, maxWidth: 360 }}>{tr("Vui lòng thử tải lại. Nếu vẫn lỗi, hãy quay lại sau ít phút.", "Please try reloading. If it keeps failing, come back in a few minutes.")}</p>
          {error.digest && <p style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", margin: 0 }}>{tr("Mã lỗi: ", "Error code: ")}{error.digest}</p>}
          <button
            onClick={() => reset()}
            style={{ minHeight: 48, width: "100%", maxWidth: 360, border: 0, borderRadius: 16, background: "linear-gradient(90deg,#9333ea,#4f46e5,#db2777)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {tr("Tải lại trang", "Reload page")}
          </button>
        </div>
      </body>
    </html>
  );
}
