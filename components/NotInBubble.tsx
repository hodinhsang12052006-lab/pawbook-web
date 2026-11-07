"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isBubbleMode } from "@/lib/bubbleMode";

// Lớp phủ toàn app (lời mời cài app / bật thông báo, toast "việc mới", gợi ý ngôn ngữ, thanh dưới…) KHÔNG chạy trong
// bong bóng chat Android (lib/bubbleMode.ts): trước đây chỉ bị CSS ẩn nên hẹn giờ / fetch của chúng vẫn chạy trong
// WebView nhỏ đó. Layout gốc được prerender (không đọc User-Agent được) → máy chủ luôn vẽ children; trình duyệt nhận ra
// bong bóng ngay sau khi hydrate thì gỡ ra (html[data-bubble] + CSS đã ẩn chúng từ khung hình đầu nên không nháy).
const noop = () => () => {};

export default function NotInBubble({ children }: { children: ReactNode }) {
  const bubble = useSyncExternalStore(noop, isBubbleMode, () => false);
  return bubble ? null : <>{children}</>;
}
