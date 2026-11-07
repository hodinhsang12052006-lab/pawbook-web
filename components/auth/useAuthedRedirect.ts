"use client";

import { useEffect } from "react";
import { hasViPrefix } from "@/lib/i18n/config";

// Đã đăng nhập mà mở /auth/register, /auth/login, /auth/forgot → đưa thẳng vào app (trang tĩnh, kiểm tra phía client).
//
// Vì sao kiểm tra phía client + tải lại cả trang: test thật trên production từng thấy người ĐÃ đăng nhập bị điều
// hướng "mềm" (RSC) tới /auth/register — chỉ trên hạ tầng Vercel, không tái hiện ở local. Fetch thẳng "/" bằng document
// request luôn đúng → window.location.replace (không router.push) để né đường RSC đó. Các trang /auth/* vẫn prerender
// tĩnh (không đọc session ở máy chủ).
//
// Chống vòng lặp: nếu trang đích TỰ NÓ lại đá người dùng về đây (nghi do cold-start Vercel), chỉ bounce 1 lần mỗi
// 5 giây; quay lại nhanh hơn thì hiện form bình thường thay vì lặp /→/auth/…→/ mãi.
//
// Không chuyển khi:
//  • URL có ?error= — lỗi đăng nhập Google/Facebook/Apple phải hiện được (next-auth đưa về /auth/login?error=…, kể cả
//    khi trình duyệt còn phiên cũ);
//  • phiên cần "Hoàn tất" (needsOnboarding) — SessionUserProvider tự đưa tới /auth/complete.
// Đích: ?callbackUrl= nếu là đường dẫn nội bộ ngoài /auth (cùng luật với LoginForm), nếu không thì trang chủ đúng ngôn
// ngữ của trang đang mở ("/vi" cho /vi/auth/…).
export function authedTarget(loc: Pick<Location, "pathname" | "search">): string {
  const cb = new URLSearchParams(loc.search).get("callbackUrl") || "";
  if (/^\/(?![/\\])/.test(cb) && !/^\/(?:(?:en|vi)\/)?auth(?:[/?#]|$)/.test(cb)) return cb;
  return hasViPrefix(loc.pathname) ? "/vi" : "/";
}

export function useAuthedRedirect() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) return;
    let bounced = 0;
    try {
      bounced = Number(sessionStorage.getItem("authBounceAt") || 0);
    } catch {}
    if (Date.now() - bounced < 5000) return;
    let live = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((session) => {
        if (!live || !session?.user?.id || session.user.needsOnboarding) return;
        try {
          sessionStorage.setItem("authBounceAt", String(Date.now()));
        } catch {}
        window.location.replace(authedTarget(window.location));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
}

/** For server-component pages (/auth/login, /auth/forgot): renders nothing, runs the check above. */
export function AuthedRedirect() {
  useAuthedRedirect();
  return null;
}
