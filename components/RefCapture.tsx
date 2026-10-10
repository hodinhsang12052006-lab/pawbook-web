"use client";

import { useEffect } from "react";

// Link mời bạn bè (?ref=<id>) → nhớ 30 ngày trong cookie để lúc đăng ký gắn đúng người mời
// (khách thường xem vài trang rồi mới đăng ký). Không ghi đè lời mời đã có.
export default function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref || !/^[a-z0-9]{10,40}$/i.test(ref) || /(?:^|;\s*)pn_ref=/.test(document.cookie)) return;
      document.cookie = `pn_ref=${ref}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {}
  }, []);
  return null;
}
