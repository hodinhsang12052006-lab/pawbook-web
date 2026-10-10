"use client";

import React, { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, MailCheck } from "lucide-react";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

const PRESS = "active:scale-[0.98] transition-transform duration-100";
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawos.com";

function useStyles() {
  const { theme } = useContext(AuthSettingsContext);
  const dark = theme === "dark";
  return {
    dark,
    input: `block w-full min-h-[48px] rounded-2xl h-12 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${dark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"} border`,
    label: `block text-xs font-bold ${dark ? "text-slate-300" : "text-slate-700"}`,
    muted: `text-sm ${dark ? "text-slate-400" : "text-slate-500"}`,
    title: `text-2xl font-bold tracking-tight sm:text-3xl ${dark ? "text-white" : "text-slate-900"}`,
    btn: `flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 text-sm font-bold text-white shadow-lg shadow-purple-600/25 disabled:opacity-60 ${PRESS}`,
    error: `flex items-start gap-2.5 rounded-xl border p-4 text-sm ${dark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600"}`,
    ok: `flex items-start gap-2.5 rounded-xl border p-4 text-sm ${dark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`,
  };
}

/** /auth/forgot — nhập email nhận link đặt lại mật khẩu. */
export function ForgotPasswordForm() {
  useTr(); // render lại khi đổi VI/EN
  const c = useStyles();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false); // máy chủ chưa bật gửi email

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const r = await res.json().catch(() => ({}));
      if (res.status === 503 && r.fallback) setDisabled(true);
      else if (res.status === 429) setError(tr("Bạn thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.", "Too many attempts. Please wait 15 minutes and try again."));
      else if (!res.ok) setError(r.error || tr("Không gửi được, vui lòng thử lại.", "Couldn't send, please try again."));
      else setSent(true);
    } catch {
      setError(tr("Lỗi kết nối, vui lòng thử lại.", "Network error, please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={c.title}>{tr("Quên mật khẩu?", "Forgot your password?")}</h2>
        <p className={c.muted}>{tr("Nhập email bạn dùng để đăng ký — chúng tôi sẽ gửi link đặt mật khẩu mới.", "Enter the email you signed up with — we'll send you a link to set a new password.")}</p>
      </div>

      {sent ? (
        <div className={c.ok} role="status">
          <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>{tr("Nếu email này có tài khoản PawNail, chúng tôi vừa gửi link đặt lại mật khẩu (hiệu lực 30 phút). Kiểm tra hộp thư, cả mục Spam / Quảng cáo.", "If this email has a PawNail account, we've sent a reset link (valid for 30 minutes). Check your inbox, including Spam / Promotions.")}</span>
        </div>
      ) : disabled ? (
        <div className={c.error} role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>{tr(`Tính năng tự đặt lại mật khẩu đang được hoàn thiện. Vui lòng liên hệ ${SUPPORT_EMAIL} để được cấp lại mật khẩu.`, `Self-service reset is coming soon. Please email ${SUPPORT_EMAIL} and we'll get you back in.`)}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className={c.error} role="alert"><AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" /><span>{error}</span></div>
          )}
          <div>
            <label htmlFor="forgot-email" className={c.label}>{tr("Địa chỉ email", "Email address")}</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"><Mail className="h-4 w-4 text-slate-400" /></div>
              <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" className={c.input} />
            </div>
          </div>
          <button type="submit" disabled={busy} className={c.btn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {tr("Gửi link đặt lại", "Send reset link")}
          </button>
        </form>
      )}

      <Link href="/auth/login" className={`flex items-center justify-center gap-1.5 text-sm font-semibold text-purple-500 hover:text-purple-400`}>
        <ArrowLeft className="h-4 w-4" />{tr(" Quay lại đăng nhập", " Back to sign in")}
      </Link>
    </div>
  );
}

/** /auth/reset?token=… — đặt mật khẩu mới. */
export function ResetPasswordForm() {
  useTr();
  const c = useStyles();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError(tr("Mật khẩu cần ít nhất 8 ký tự.", "Password must be at least 8 characters."));
    if (pw !== pw2) return setError(tr("Hai mật khẩu chưa giống nhau.", "The passwords don't match."));
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) setError(res.status === 410 ? tr("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.", "This link has expired or was already used. Please request a new one.") : r.error || tr("Không đặt lại được, vui lòng thử lại.", "Couldn't reset, please try again."));
      else {
        setDone(true);
        setTimeout(() => router.push("/auth/login"), 2500);
      }
    } catch {
      setError(tr("Lỗi kết nối, vui lòng thử lại.", "Network error, please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={c.title}>{tr("Đặt mật khẩu mới", "Set a new password")}</h2>
        <p className={c.muted}>{tr("Chọn mật khẩu mới cho tài khoản PawNail của bạn (ít nhất 8 ký tự).", "Choose a new password for your PawNail account (at least 8 characters).")}</p>
      </div>
      {done ? (
        <div className={c.ok} role="status"><CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" /><span>{tr("Đã đổi mật khẩu! Đang chuyển sang trang đăng nhập…", "Password updated! Taking you to sign in…")}</span></div>
      ) : !token ? (
        <div className={c.error} role="alert"><AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" /><span>{tr("Link không hợp lệ. Hãy mở đúng link trong email, hoặc yêu cầu link mới.", "Invalid link. Open the link from your email, or request a new one.")}</span></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className={c.error} role="alert"><AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" /><span>{error}</span></div>}
          {[["new-password", tr("Mật khẩu mới", "New password"), pw, setPw], ["confirm-password", tr("Nhập lại mật khẩu", "Confirm password"), pw2, setPw2]].map(([id, label, val, set]) => (
            <div key={id as string}>
              <label htmlFor={id as string} className={c.label}>{label as string}</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"><Lock className="h-4 w-4 text-slate-400" /></div>
                <input id={id as string} type={show ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className={`${c.input} pr-11`} />
                {id === "new-password" && (
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? tr("Ẩn mật khẩu", "Hide password") : tr("Hiện mật khẩu", "Show password")} className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="submit" disabled={busy} className={c.btn}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {tr("Lưu mật khẩu mới", "Save new password")}</button>
        </form>
      )}
      {(!done) && (
        <Link href={token ? "/auth/login" : "/auth/forgot"} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-purple-500 hover:text-purple-400">
          <ArrowLeft className="h-4 w-4" />{token ? tr(" Quay lại đăng nhập", " Back to sign in") : tr(" Yêu cầu link mới", " Request a new link")}
        </Link>
      )}
    </div>
  );
}
