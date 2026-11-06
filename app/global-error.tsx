"use client";

import React, { useEffect, useState } from "react";

// app/[lang]/error.tsx only catches errors thrown by page/layout segments NESTED
// under the root layout — it can't catch an error thrown by the root layout
// (app/[lang]/layout.tsx) itself. Per Next.js docs that case needs a separate
// app/global-error.tsx, which must render its own <html>/<body> since it
// replaces the entire root layout when triggered.
//
// No LanguageProvider exists here (the root layout is what failed), so useTr()
// would throw and crash the last-resort page. English by default; switch to
// Vietnamese after mount only if the page was Vietnamese (/vi/* URL or the
// bitpaw_locale cookie).
const TEXT = {
  en: { title: "Something went wrong", body: "Please try reloading. If it keeps failing, come back in a few minutes.", code: "Error code: ", reload: "Reload page" },
  vi: { title: "Đã có lỗi xảy ra", body: "Vui lòng thử tải lại. Nếu vẫn lỗi, hãy quay lại sau ít phút.", code: "Mã lỗi: ", reload: "Tải lại trang" },
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<"en" | "vi">("en");
  useEffect(() => {
    console.error(`Root layout error boundary caught an error (digest: ${error.digest ?? "none"}):`, error);
  }, [error]);
  useEffect(() => {
    try {
      const vi = /^\/vi(?:\/|$)/.test(window.location.pathname) || /(?:^|;\s*)bitpaw_locale=vi(?:;|$)/.test(document.cookie);
      // Chỉ đọc được URL/cookie sau khi mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (vi) setLang("vi");
    } catch {}
  }, []);
  const t = TEXT[lang];

  return (
    <html lang={lang}>
      {/* Style inline — layout gốc (và globals.css) không chạy khi trang này hiện. */}
      <body style={{ margin: 0, background: "#0b0b0c", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{t.title}</h2>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, maxWidth: 360 }}>{t.body}</p>
          {error.digest && <p style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", margin: 0 }}>{t.code}{error.digest}</p>}
          <button
            onClick={() => reset()}
            style={{ minHeight: 48, width: "100%", maxWidth: 360, border: 0, borderRadius: 16, background: "linear-gradient(90deg,#9333ea,#4f46e5,#db2777)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {t.reload}
          </button>
        </div>
      </body>
    </html>
  );
}
