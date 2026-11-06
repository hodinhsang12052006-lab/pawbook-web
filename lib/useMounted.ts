"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * false trên máy chủ và trong lần render hydrate, true ngay sau đó. Dùng cho chữ phụ thuộc múi giờ / giờ
 * hiện tại của người xem ("3:16 AM", "Hôm nay", "5 phút trước"): máy chủ (UTC) và trình duyệt cho ra chữ
 * khác nhau → React báo lỗi hydrate #418. Render rỗng lúc hydrate rồi điền ngay sau đó thì 2 bên khớp.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
