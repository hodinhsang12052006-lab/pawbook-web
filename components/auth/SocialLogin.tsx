"use client";

import React, { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { Capacitor } from "@capacitor/core";
import { KeyRound, Loader2 } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import PhoneLogin from "@/components/auth/PhoneLogin";
import { useTr } from "@/lib/i18n/useTr";

// Nút "Tiếp tục với Google / Apple / Facebook" — chỉ hiện provider máy chủ ĐÃ bật (có khoá). Ẩn trong app native
// (Capacitor): Google chặn đăng nhập trong WebView ("disallowed_useragent"); không có đăng nhập bên thứ 3 trong app
// native thì App Store cũng không bắt buộc "Sign in with Apple". Kiểu: viên trung tính (không khối màu thương hiệu),
// logo 20px: Google nhiều màu, Facebook #1877F2, Apple trắng.
const ORDER = ["apple", "google", "facebook", "test-oauth"];

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#1877F2" aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}
function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.79-3.33-1.81-1.42-.14-2.77.84-3.49.84-.72 0-1.83-.82-3.01-.8-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.32 1.16-.05 1.6-.75 3-.75s1.79.75 3.01.72c1.25-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.46-3.71zM14.08 5.85c.64-.78 1.07-1.85.95-2.93-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.07-.52 2.72-1.31z" />
    </svg>
  );
}

/**
 * `lead`: divider text shown ABOVE the buttons (only when a provider is enabled) — e.g. "or" on the role picker.
 * `heading`: small sentence-case line above the buttons. `divider`: "or use email" rule BELOW them (forms).
 */
export default function SocialLogin({ divider = true, heading, lead }: { divider?: boolean; heading?: string; lead?: string }) {
  useTr(); // render lại khi đổi VI/EN
  const [providers, setProviders] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    // App native: Google/Facebook chặn đăng nhập trong WebView → ẩn. Đăng nhập SĐT cũng ẩn trong app
    // native cho tới khi Twilio hết bản dùng thử (bản thử chỉ gửi mã tới số đã xác minh — người duyệt
    // App Store/CH Play bấm vào không nhận được mã = bị từ chối). Bật lại: NEXT_PUBLIC_NATIVE_PHONE_LOGIN=1.
    const native = Capacitor.isNativePlatform();
    const nativePhone = process.env.NEXT_PUBLIC_NATIVE_PHONE_LOGIN === "1";
    getProviders()
      .then((p) => setProviders(Object.keys(p || {}).filter((id) => id !== "credentials" && (!native || (nativePhone && id === "phone-otp"))).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))))
      .catch(() => {});
  }, []);

  if (!providers.length) return null;
  const hasPhone = providers.includes("phone-otp");
  const social = providers.filter((id) => id !== "phone-otp");
  const go = (id: string) => {
    setBusy(id);
    signIn(id, { callbackUrl: "/auth/complete" });
  };

  return (
    <div className="space-y-2.5">
      {lead && <div className="pn-or" style={{ marginBottom: 16 }}>{lead}</div>}
      {heading && <p className="pn-social-head">{heading}</p>}
      {social.map((id) => {
        const label =
          id === "google" ? tr("Tiếp tục với Google", "Continue with Google") : id === "apple" ? tr("Tiếp tục với Apple", "Continue with Apple") : id === "facebook" ? tr("Tiếp tục với Facebook", "Continue with Facebook") : tr("Tiếp tục với Test OAuth", "Continue with Test OAuth");
        return (
          <button key={id} type="button" disabled={!!busy} onClick={() => go(id)} className="pn-social">
            {busy === id ? <Loader2 className="animate-spin" aria-hidden /> : id === "google" ? <GoogleLogo /> : id === "apple" ? <AppleLogo /> : id === "facebook" ? <FacebookLogo /> : <KeyRound aria-hidden />}
            {label}
          </button>
        );
      })}
      {hasPhone && <PhoneLogin />}
      {divider && <div className="pn-or" style={{ paddingTop: 6 }}>{tr("hoặc dùng email", "or use email")}</div>}
    </div>
  );
}
