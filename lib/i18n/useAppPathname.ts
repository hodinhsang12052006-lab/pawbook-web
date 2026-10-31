"use client";

import { usePathname } from "next/navigation";
import { stripLocalePrefix } from "@/lib/i18n/config";

// usePathname() không có tiền tố ngôn ngữ. HTML tĩnh được prerender cho
// /en/jobs nhưng trình duyệt đang ở /jobs (edge rewrite) — đọc thẳng
// usePathname() sẽ lệch hydration và sai trạng thái "đang chọn" của thanh điều
// hướng. Bỏ ^/(en|vi) ở CẢ máy chủ lẫn trình duyệt → luôn ra cùng "/jobs".
export function useAppPathname(): string {
  return stripLocalePrefix(usePathname() ?? "/");
}
