"use client";

import React, { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { Capacitor } from "@capacitor/core";
import { Loader2 } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Nút "Tiếp tục với Google / Apple" — chỉ hiện provider máy chủ ĐÃ bật (có
// khoá). Ẩn trong app native (Capacitor): Google chặn đăng nhập trong WebView
// ("disallowed_useragent"); không có đăng nhập bên thứ 3 trong app native thì
// App Store cũng không bắt buộc "Sign in with Apple".
const ORDER = ["apple", "google", "test-oauth"];

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.79-3.33-1.81-1.42-.14-2.77.84-3.49.84-.72 0-1.83-.82-3.01-.8-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.32 1.16-.05 1.6-.75 3-.75s1.79.75 3.01.72c1.25-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.46-3.71zM14.08 5.85c.64-.78 1.07-1.85.95-2.93-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.07-.52 2.72-1.31z" />
    </svg>
  );
}

export default function SocialLogin({ dark = true, divider = true, heading }: { dark?: boolean; divider?: boolean; heading?: string }) {
  useTr(); // render lại khi đổi VI/EN
  const [providers, setProviders] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    getProviders()
      .then((p) => setProviders(Object.keys(p || {}).filter((id) => id !== "credentials").sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))))
      .catch(() => {});
  }, []);

  if (!providers.length) return null;
  const go = (id: string) => {
    setBusy(id);
    signIn(id, { callbackUrl: "/auth/complete" });
  };

  return (
    <div className="space-y-2.5">
      {heading && <p className={`text-center text-xs font-bold uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>{heading}</p>}
      {providers.map((id) => {
        const label =
          id === "google" ? tr("Tiếp tục với Google", "Continue with Google") : id === "apple" ? tr("Tiếp tục với Apple", "Continue with Apple") : tr("Tiếp tục với Test OAuth", "Continue with Test OAuth");
        const style =
          id === "apple"
            ? "bg-black text-white ring-1 ring-white/20 hover:bg-neutral-900"
            : "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50";
        return (
          <button key={id} type="button" disabled={!!busy} onClick={() => go(id)} className={`flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl text-sm font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 ${style}`}>
            {busy === id ? <Loader2 className="h-5 w-5 animate-spin" /> : id === "google" ? <GoogleLogo /> : id === "apple" ? <AppleLogo /> : <span aria-hidden>🔑</span>}
            {label}
          </button>
        );
      })}
      {divider && <div className="flex items-center gap-3 py-1">
        <span className={`h-px flex-1 ${dark ? "bg-slate-800" : "bg-slate-200"}`} />
        <span className={`text-xs font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>{tr("hoặc dùng email", "or use email")}</span>
        <span className={`h-px flex-1 ${dark ? "bg-slate-800" : "bg-slate-200"}`} />
      </div>}
    </div>
  );
}
