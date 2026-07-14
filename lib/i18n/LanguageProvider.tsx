"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import vi from "./dictionaries/vi.json";
import en from "./dictionaries/en.json";

export type Locale = "vi" | "en";

const DICTIONARIES: Record<Locale, any> = { vi, en };
const STORAGE_KEY = "bitpaw_locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  // Nested-key lookup, e.g. t("messenger.title"), with {placeholder}
  // interpolation, e.g. t("messenger.replyingTo", { name: "Alice" }).
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "vi";
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "vi";
}

function lookup(dict: any, key: string): string | undefined {
  return key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Start with "vi" (matches the server-rendered <html lang="vi">) and only
  // switch after mount — reading localStorage/navigator during the initial
  // render would mismatch the server HTML and trigger a hydration error.
  const [locale, setLocaleState] = useState<Locale>("vi");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Locale | null) : null;
    setLocaleState(saved === "en" || saved === "vi" ? saved : detectBrowserLocale());
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore write failures (private browsing / storage disabled).
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "vi" ? "en" : "vi");
  }, [locale, setLocale]);

  useEffect(() => {
    if (hydrated) document.documentElement.lang = locale;
  }, [locale, hydrated]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = DICTIONARIES[locale];
    let str = lookup(dict, key) ?? lookup(DICTIONARIES.vi, key) ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return str;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, toggleLocale, t }), [locale, setLocale, toggleLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
