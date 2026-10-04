"use client";

import { useCallback } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Dịch tại chỗ: tr("Việc làm", "Jobs"). Đặt cả 2 ngôn ngữ ngay cạnh nhau
// trong component — dễ đọc, không lệch khoá như từ điển JSON khổng lồ. Bộ từ
// điển (t("menu.…")) vẫn dùng cho các chuỗi đã có sẵn.
export function useTr() {
  const { locale } = useLanguage();
  const tr = useCallback((vi: string, en: string) => (locale === "en" ? en : vi), [locale]);
  return { tr, locale };
}
