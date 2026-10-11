"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, Smartphone } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { tr } from "@/lib/i18n/tr";

// Đăng nhập / đăng ký bằng SĐT: nhập số → nhận mã 6 số qua SMS → nhập mã.
// Số đã xác minh → vào tài khoản cũ; số mới → tạo tài khoản rồi chọn vai trò + khu vực.
export default function PhoneLogin({ dark = true }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/auth/phone/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, market, locale: document.documentElement.lang === "en" ? "en" : "vi" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || tr("Không gửi được mã, thử lại sau.", "Couldn't send the code, try again later.")); return; }
      setTo(j.to || phone); setStep("code"); setWait(30); setCode("");
      setTimeout(() => codeRef.current?.focus(), 50);
    } finally { setBusy(false); }
  };
  const verify = async (c = code) => {
    if (c.length < 6 || busy) return;
    setErr(""); setBusy(true);
    const r = await signIn("phone-otp", { phone, market, code: c, redirect: false });
    // Tải lại hẳn trang để toàn app nhận phiên mới; /auth/complete tự chuyển vào app nếu hồ sơ đã đủ.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (r?.ok && !r.error) { window.location.href = "/auth/complete"; return; }
    setBusy(false);
    setErr(tr("Mã không đúng hoặc đã hết hạn — kiểm tra lại tin nhắn.", "Wrong or expired code — check your text message."));
  };

  const field = `w-full rounded-2xl px-4 py-3 text-base outline-none ring-1 focus:ring-2 focus:ring-pink-500 ${dark ? "bg-slate-950/60 text-white ring-white/10 placeholder:text-slate-500" : "bg-white text-slate-900 ring-slate-300"}`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98]">
        <Smartphone className="h-5 w-5" />{tr("Tiếp tục với số điện thoại", "Continue with phone number")}
      </button>
    );
  }

  return (
    <div className={`space-y-3 rounded-2xl p-4 ring-1 ${dark ? "bg-white/[0.03] ring-white/10" : "bg-slate-50 ring-slate-200"}`} data-testid="phone-login">
      {step === "phone" ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-3">
          <label htmlFor="pl-phone" className={`block text-sm font-bold ${dark ? "text-white" : "text-slate-800"}`}>{tr("Số điện thoại của bạn", "Your phone number")}</label>
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-2xl p-1 ring-1 ring-white/10" role="group" aria-label={tr("Quốc gia", "Country")}>
              {(["US", "AU"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={market === m} onClick={() => setMarket(m)} className={`flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 text-xs font-bold ${market === m ? "bg-pink-600 text-white" : dark ? "text-slate-400" : "text-slate-500"}`}>
                  <Flag code={m} className="h-3 w-4" />{m === "US" ? "+1" : "+61"}
                </button>
              ))}
            </div>
            <input id="pl-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={market === "US" ? "408 555 0123" : "0412 345 678"} className={field} />
          </div>
          <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 9} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Gửi mã xác minh", "Send code")}
          </button>
          <p className={`text-[11px] ${dark ? "text-slate-500" : "text-slate-500"}`}>{tr("Chỉ nhận số Mỹ hoặc Úc. Có thể mất phí tin nhắn theo nhà mạng.", "US or Australian numbers only. Carrier message rates may apply.")}</p>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
          <label htmlFor="pl-code" className={`block text-sm font-bold ${dark ? "text-white" : "text-slate-800"}`}>{tr(`Nhập mã 6 số đã gửi tới ${to}`, `Enter the 6-digit code sent to ${to}`)}</label>
          <input
            id="pl-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }}
            placeholder="••••••" className={`${field} text-center font-mono text-2xl tracking-[0.5em]`}
          />
          <button type="submit" disabled={busy || code.length < 6} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Xác minh & vào PawNail", "Verify & continue")}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="min-h-[36px] text-slate-400 hover:text-white">{tr("← Đổi số", "← Change number")}</button>
            <button type="button" onClick={send} disabled={wait > 0 || busy} className="min-h-[36px] font-semibold text-pink-300 disabled:text-slate-500">{wait > 0 ? tr(`Gửi lại sau ${wait}s`, `Resend in ${wait}s`) : tr("Gửi lại mã", "Resend code")}</button>
          </div>
        </form>
      )}
      {err && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 ring-1 ring-red-500/20">{err}</p>}
    </div>
  );
}
