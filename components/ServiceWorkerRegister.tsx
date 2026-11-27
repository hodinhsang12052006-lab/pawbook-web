"use client";

import { useEffect } from "react";
import { initNativePush, nativeAutoEnable } from "@/lib/nativePush";
import { resumePushAfterLogin } from "@/lib/pushClient";
import { isBubbleMode } from "@/lib/bubbleMode";
import { useSessionUser } from "@/lib/SessionUserContext";

// next-pwa (v5) chỉ tự chèn mã đăng ký service worker vào entry của Pages
// Router ("main.js") — App Router dùng entry khác nên SW CHƯA TỪNG được đăng
// ký trên production: trang offline dự phòng, bộ nhớ đệm và thông báo đẩy
// đều không chạy. Đăng ký thủ công ở đây, sau khi trang tải xong để không
// tranh băng thông với nội dung đầu tiên.
export default function ServiceWorkerRegister() {
  // App native: bấm thông báo → mở đúng trang + làm mới token Firebase. Web: vừa đăng xuất rồi đăng nhập lại → gắn
  // lại thông báo đẩy của trình duyệt cho tài khoản mới (lib/pushClient.ts resumePushAfterLogin).
  const userId = useSessionUser().user?.id;
  useEffect(() => {
    initNativePush().catch(() => {});
    if (!isBubbleMode()) resumePushAfterLogin().catch(() => {});
  }, []);
  // App native, đã đăng nhập (kể cả vừa đăng nhập — không tải lại trang): máy chưa nhận thông báo → tự bật, để cuộc gọi
  // đến đổ chuông khi app ở nền / đã đóng (lib/nativePush.ts nativeAutoEnable).
  useEffect(() => {
    if (userId) void initNativePush().catch(() => {}).then(() => nativeAutoEnable());
  }, [userId]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || isBubbleMode()) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
