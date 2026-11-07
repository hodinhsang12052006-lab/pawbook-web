"use client";

import { useSyncExternalStore } from "react";
import { isSeasonId, type SeasonId } from "@/lib/season";

// Mùa hiện tại của trang = html[data-season] (SEASON_BOOT đặt trước khi vẽ, applySeason() cập nhật khi đổi thị
// trường). Theo dõi bằng MutationObserver → component đổi theo ngay, không cần tải lại. Máy chủ: "base".
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-season"] });
  return () => mo.disconnect();
}
const read = (): SeasonId => {
  const v = document.documentElement.getAttribute("data-season");
  return isSeasonId(v) ? v : "base";
};

export function useSeason(): SeasonId {
  return useSyncExternalStore(subscribe, read, () => "base");
}
