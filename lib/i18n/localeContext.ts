"use client";

import { createContext } from "react";
import { bindLocaleContext } from "@/lib/i18n/tr";
import type { Locale } from "@/lib/i18n/config";

// Ngôn ngữ của task đang render — tr() đọc nó trên máy chủ (xem lib/i18n/tr.ts).
// Mặc định null = "không nằm trong LanguageProvider".
export const LocaleContext = createContext<Locale | null>(null);
bindLocaleContext(LocaleContext);
