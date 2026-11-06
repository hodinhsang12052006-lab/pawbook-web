"use client";

import { apiError } from "@/lib/i18n/apiError";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, MailCheck } from "lucide-react";
import { AuthTitle, ErrorBox, OkBox, Submit } from "@/components/auth/fields";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawsoftware.com";

/** /auth/forgot — nhập email nhận link đặt lại mật khẩu. */
export function ForgotPasswordForm() {
  useTr(); // render lại khi đổi VI/EN
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
      else if (!res.ok) setError(apiError(r, "Không gửi được, vui lòng thử lại.", "Couldn't send, please try again."));
      else setSent(true);
    } catch {
      setError(tr("Lỗi kết nối, vui lòng thử lại.", "Network error, please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pn-stack-24">
      <AuthTitle title={tr("Quên mật khẩu?", "Forgot your password?")} sub={tr("Nhập email bạn dùng để đăng ký — chúng tôi sẽ gửi link đặt mật khẩu mới.", "Enter the email you signed up with — we'll send you a link to set a new password.")} />

      {sent ? (
        <OkBox icon={<MailCheck aria-hidden style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />}>{tr("Nếu email này có tài khoản PawNail, chúng tôi vừa gửi link đặt lại mật khẩu (hiệu lực 30 phút). Kiểm tra hộp thư, cả mục Spam / Quảng cáo.", "If this email has a PawNail account, we've sent a reset link (valid for 30 minutes). Check your inbox, including Spam / Promotions.")}
        </OkBox>
      ) : disabled ? (
        <ErrorBox>
          {tr(`Tính năng tự đặt lại mật khẩu đang được hoàn thiện. Vui lòng liên hệ ${SUPPORT_EMAIL} để được cấp lại mật khẩu.`, `Self-service reset is coming soon. Please email ${SUPPORT_EMAIL} and we'll get you back in.`)}
        </ErrorBox>
      ) : (
        <form onSubmit={submit} className="pn-stack-16">
          {error && <ErrorBox>{error}</ErrorBox>}
          <div>
            <label htmlFor="forgot-email" className="pn-label">{tr("Địa chỉ email", "Email address")}</label>
            <div className="pn-field-icon">
              <Mail aria-hidden />
              <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("ban@email.com", "you@email.com")} className="pn-input" />
            </div>
          </div>
          <div style={{ paddingTop: 8 }}>
            <Submit busy={busy}>{tr("Gửi link đặt lại", "Send reset link")}</Submit>
          </div>
        </form>
      )}

      <p className="pn-center">
        <Link href="/auth/login" className="pn-a inline-flex items-center gap-1.5" style={{ fontSize: 15 }}>
          <ArrowLeft className="h-4 w-4" aria-hidden />{tr("Quay lại đăng nhập", "Back to sign in")}
        </Link>
      </p>
    </div>
  );
}

/** /auth/reset?token=… — đặt mật khẩu mới. */
export function ResetPasswordForm() {
  useTr();
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
      if (!res.ok) setError(res.status === 410 ? tr("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.", "This link has expired or was already used. Please request a new one.") : apiError(r, "Không đặt lại được, vui lòng thử lại.", "Couldn't reset, please try again."));
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
    <div className="pn-stack-24">
      <AuthTitle title={tr("Đặt mật khẩu mới", "Set a new password")} sub={tr("Chọn mật khẩu mới cho tài khoản PawNail của bạn (ít nhất 8 ký tự).", "Choose a new password for your PawNail account (at least 8 characters).")} />
      {done ? (
        <OkBox icon={<CheckCircle2 aria-hidden style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />}>{tr("Đã đổi mật khẩu! Đang chuyển sang trang đăng nhập…", "Password updated! Taking you to sign in…")}</OkBox>
      ) : !token ? (
        <ErrorBox>{tr("Link không hợp lệ. Hãy mở đúng link trong email, hoặc yêu cầu link mới.", "Invalid link. Open the link from your email, or request a new one.")}</ErrorBox>
      ) : (
        <form onSubmit={submit} className="pn-stack-16">
          {error && <ErrorBox>{error}</ErrorBox>}
          {[["new-password", tr("Mật khẩu mới", "New password"), pw, setPw], ["confirm-password", tr("Nhập lại mật khẩu", "Confirm password"), pw2, setPw2]].map(([id, label, val, set]) => (
            <div key={id as string}>
              <label htmlFor={id as string} className="pn-label">{label as string}</label>
              <div className="pn-field-icon">
                <Lock aria-hidden />
                <input id={id as string} type={show ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="pn-input" style={{ paddingRight: 48 }} />
                {id === "new-password" && (
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? tr("Ẩn mật khẩu", "Hide password") : tr("Hiện mật khẩu", "Show password")} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[14px] text-[#a69ba4] hover:text-white">
                    {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div style={{ paddingTop: 8 }}>
            <Submit busy={busy}>{tr("Lưu mật khẩu mới", "Save new password")}</Submit>
          </div>
        </form>
      )}
      {(!done) && (
        <p className="pn-center">
          <Link href={token ? "/auth/login" : "/auth/forgot"} className="pn-a inline-flex items-center gap-1.5" style={{ fontSize: 15 }}>
            <ArrowLeft className="h-4 w-4" aria-hidden />{token ? tr("Quay lại đăng nhập", "Back to sign in") : tr("Yêu cầu link mới", "Request a new link")}
          </Link>
        </p>
      )}
    </div>
  );
}
