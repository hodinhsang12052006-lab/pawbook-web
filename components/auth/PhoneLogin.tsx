"use client";

import { apiError } from "@/lib/i18n/apiError";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Smartphone } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { Submit } from "@/components/auth/fields";
import { tr } from "@/lib/i18n/tr";

// Đăng nhập / đăng ký bằng SĐT: nhập số → nhận mã 6 số qua SMS → nhập mã.
// Số đã xác minh → vào tài khoản cũ; số mới → tạo tài khoản rồi chọn vai trò + khu vực.
export default function PhoneLogin() {
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
      if (!r.ok) { setErr(apiError(j, "Không gửi được mã, thử lại sau.", "Couldn't send the code, try again later.")); return; }
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

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="pn-social">
        <Smartphone aria-hidden style={{ color: "#c2b7bf" }} />{tr("Tiếp tục với số điện thoại", "Continue with phone number")}
      </button>
    );
  }

  return (
    <div className="pn-list" style={{ padding: 16 }} data-testid="phone-login">
      {step === "phone" ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="pn-stack-16">
          <div>
            <label htmlFor="pl-phone" className="pn-label">{tr("Số điện thoại của bạn", "Your phone number")}</label>
            <div className="flex gap-2">
              <div className="pn-seg" role="group" aria-label={tr("Quốc gia", "Country")} style={{ flex: "0 0 auto" }}>
                {(["US", "AU"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={market === m} onClick={() => setMarket(m)} aria-label={m === "US" ? tr("+1 (Mỹ)", "+1 (US)") : tr("+61 (Úc)", "+61 (AU)")}>
                    <span aria-hidden className="inline-flex"><Flag code={m} className="h-3.5 w-5" /></span>{m === "US" ? "+1" : "+61"}
                  </button>
                ))}
              </div>
              <input id="pl-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={market === "US" ? "408 555 0123" : "0412 345 678"} className="pn-input" />
            </div>
            <p className="pn-hint">{tr("Chỉ nhận số Mỹ hoặc Úc. Có thể mất phí tin nhắn theo nhà mạng.", "US or Australian numbers only. Carrier message rates may apply.")}</p>
          </div>
          <Submit busy={busy} disabled={phone.replace(/\D/g, "").length < 9}>{tr("Gửi mã xác minh", "Send code")}</Submit>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="pn-stack-16">
          <div>
            <label htmlFor="pl-code" className="pn-label">{tr(`Nhập mã 6 số đã gửi tới ${to}`, `Enter the 6-digit code sent to ${to}`)}</label>
            <input
              id="pl-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }}
              placeholder="••••••" className="pn-input text-center font-mono" style={{ fontSize: 24, letterSpacing: "0.5em" }}
            />
          </div>
          <Submit busy={busy} disabled={code.length < 6}>{tr("Xác minh & vào PawNail", "Verify & continue")}</Submit>
          <div className="flex items-center justify-between" style={{ fontSize: 14 }}>
            <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="min-h-[36px] text-[#c2b7bf] hover:text-white">{tr("← Đổi số", "← Change number")}</button>
            <button type="button" onClick={send} disabled={wait > 0 || busy} className="min-h-[36px] font-semibold text-[#f59bbe] disabled:text-[#a69ba4]">{wait > 0 ? tr(`Gửi lại sau ${wait}s`, `Resend in ${wait}s`) : tr("Gửi lại mã", "Resend code")}</button>
          </div>
        </form>
      )}
      {err && <p role="alert" className="pn-error" style={{ marginTop: 12 }}>{err}</p>}
    </div>
  );
}
