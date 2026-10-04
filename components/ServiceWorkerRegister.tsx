"use client";

import { useEffect } from "react";

// next-pwa (v5) chỉ tự chèn mã đăng ký service worker vào entry của Pages
// Router ("main.js") — App Router dùng entry khác nên SW CHƯA TỪNG được đăng
// ký trên production: trang offline dự phòng, bộ nhớ đệm và thông báo đẩy
// đều không chạy. Đăng ký thủ công ở đây, sau khi trang tải xong để không
// tranh băng thông với nội dung đầu tiên.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
