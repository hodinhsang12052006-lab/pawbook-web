"use client";

import { createContext } from "react";

// Sống ở đây (không phải trong app/auth/layout.tsx) vì Next.js typegen cho
// layout chỉ chấp nhận export default/metadata/generateMetadata/... — export
// thêm 1 Context cùng file layout khiến `tsc` báo lỗi "incompatible with
// index signature" trên file .next/types sinh ra cho route đó.
//
// Chỉ còn `theme` — `lang`/`setLang` đã bị xóa: đó là một state ngôn ngữ
// RIÊNG, cục bộ cho mỗi lần mount layout, hoàn toàn tách biệt khỏi
// `useLanguage()`/`LanguageProvider` (lib/i18n) mà Navbar/MessagesContent
// đang dùng thật. Kết quả là bấm đổi ngôn ngữ ở trang đăng nhập chỉ đổi
// giá trị dropdown chứ không dịch được chữ nào (OwnerRegisterForm,
// TechnicianRegisterForm, RolePicker thậm chí còn không đọc `lang` này).
// Toàn bộ trang auth giờ dùng chung `useLanguage()` như phần còn lại của
// app — có persist localStorage sẵn, không cần state riêng nữa.
export const AuthSettingsContext = createContext<{
  theme: "light" | "dark";
  toggleTheme: () => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
});
