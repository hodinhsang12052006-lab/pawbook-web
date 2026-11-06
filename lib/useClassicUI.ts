"use client";

import { useSyncExternalStore } from "react";

// true khi <html data-ui-classic> (trang khách "/" + /auth/*): component dùng chung giữ markup cũ ở đó.
// Thuộc tính do script đầu trang đặt trước khi vẽ và BottomNav đồng bộ khi đăng nhập/đăng xuất → theo dõi bằng
// MutationObserver để đổi giao diện ngay khi thuộc tính đổi.
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ui-classic"] });
  return () => mo.disconnect();
}
const get = () => document.documentElement.hasAttribute("data-ui-classic");

export function useClassicUI(): boolean {
  return useSyncExternalStore(subscribe, get, () => false);
}
