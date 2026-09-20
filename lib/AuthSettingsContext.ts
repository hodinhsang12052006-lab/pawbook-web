"use client";

import { createContext } from "react";

// Sống ở đây (không phải trong app/auth/layout.tsx) vì Next.js typegen cho
// layout chỉ chấp nhận export default/metadata/generateMetadata/... — export
// thêm 1 Context cùng file layout khiến `tsc` báo lỗi "incompatible with
// index signature" trên file .next/types sinh ra cho route đó.
export const AuthSettingsContext = createContext<{
  theme: "light" | "dark";
  toggleTheme: () => void;
  lang: "vi" | "en";
  setLang: (l: "vi" | "en") => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
  lang: "vi",
  setLang: () => {}
});
