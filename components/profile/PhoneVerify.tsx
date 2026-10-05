"use client";

import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { tr, currentLocale } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { playSound } from "@/lib/sounds";

// Nút "Xác minh SĐT" cạnh ô số điện thoại (trang Tài khoản). Ẩn hoàn toàn khi
// máy chủ chưa bật SMS. `dirty` = người dùng vừa sửa số mà chưa lưu → nhắc lưu trước.
export default function PhoneVerify({ dirty = false, refreshKey = 0 }: { dirty?: boolean; refreshKey?: number }) {
  useTr(); // render lại khi đổi VI/EN
  const [st, setSt] = useState<{ enabled: boolean; verified: boolean; phone: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/phone/verify")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSt)
      .catch(() => {});
  }, [refreshKey]);

  if (!st?.enabled) return null;
  if (st.verified && !dirty) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
        <BadgeCheck className="h-4 w-4" /> {tr("Số điện thoại đã xác minh", "Phone number verified")}
      </p>
    );
  }

  const send = async () => {
    if (dirty) {
      toast(tr("Bấm “Lưu hồ sơ” với số mới trước, rồi xác minh.", "Save your profile with the new number first, then verify."), { icon: "💾" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/phone/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", locale: currentLocale() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || tr("Không gửi được mã.", "Couldn't send the code."));
      setSentTo(d.to);
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không gửi được mã.", "Couldn't send the code."));
    } finally {
      setSending(false);
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/phone/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check", code }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || tr("Mã không đúng.", "Wrong code."));
      playSound("success");
      toast.success(tr("Đã xác minh số điện thoại! Hồ sơ có dấu ✓ đáng tin hơn.", "Phone verified! Your profile now shows a trusted ✓."));
      setSt((s) => (s ? { ...s, verified: true } : s));
      setOpen(false);
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Mã không đúng.", "Wrong code."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <button type="button" onClick={send} disabled={sending} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/20 disabled:opacity-60">
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {tr("Xác minh SĐT qua SMS — tăng độ tin cậy", "Verify by SMS — build trust")}
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !checking && setOpen(false)}>
          <div role="dialog" aria-label={tr("Nhập mã xác minh", "Enter verification code")} className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-slate-900 p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <p className="text-base font-black text-white">{tr("Nhập mã 6 số", "Enter the 6-digit code")}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={tr("Đóng", "Close")} className="rounded-full p-1.5 text-slate-500 hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-slate-400">{tr(`Đã gửi SMS tới ${sentTo ?? "số của bạn"}.`, `We texted ${sentTo ?? "your number"}.`)}</p>
            <input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={tr("Mã xác minh", "Verification code")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && code.length >= 4 && check()}
              placeholder="••••••"
              className="input-field mt-4 text-center text-2xl font-black tracking-[0.5em]"
            />
            <button type="button" onClick={check} disabled={checking || code.length < 4} className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-sm font-black text-white disabled:opacity-50">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} {tr("Xác minh", "Verify")}
            </button>
            <button type="button" onClick={send} disabled={sending} className="mt-2 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-200">{tr("Chưa nhận được? Gửi lại", "Didn't get it? Resend")}</button>
          </div>
        </div>
      )}
    </>
  );
}
