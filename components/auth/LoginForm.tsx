"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import SocialLogin from "@/components/auth/SocialLogin";
import { AuthTitle, ErrorBox, Submit } from "@/components/auth/fields";
import { tr } from "@/lib/i18n/tr";
import { apiError } from "@/lib/i18n/apiError";
import { safeInternalPath } from "@/lib/safeRedirect";
import { localeHref } from "@/lib/i18n/localeHref";

export default function LoginForm() {
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lỗi quay về từ Google/Apple (?error=...) — hiện thông báo dễ hiểu.
  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code) return;
    setError(
      code === "OAuthEmail"
        ? tr("Tài khoản Google/Facebook/Apple này không có email đã xác minh (VD: Facebook lập bằng số điện thoại) — hãy dùng cách khác hoặc đăng ký bằng email.", "That Google/Facebook/Apple account has no verified email (e.g. a phone-only Facebook) — try another way or sign up with email.")
        : tr("Đăng nhập bằng Google/Facebook/Apple chưa thành công. Thử lại hoặc dùng email.", "Google/Facebook/Apple sign-in didn't complete. Try again or use email.")
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError(t("auth.login.errorEmpty"));
      setLoading(false);
      return;
    }

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        // authorize() (lib/authOptions.ts) báo lỗi bằng tiếng Việt → đổi sang câu theo ngôn ngữ trang.
        if (res.error === "CredentialsSignin" || res.error.includes("credential") || /không chính xác/i.test(res.error)) {
          setError(t("auth.login.errorInvalid"));
        } else if (/đầy đủ email/i.test(res.error)) {
          setError(t("auth.login.errorEmpty"));
        } else if (/tạm khóa|tạm khoá/i.test(res.error)) {
          setError(tr("Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.", "Too many failed sign-in attempts. Please try again in 15 minutes."));
        } else {
          setError(apiError({ error: res.error }, t("auth.login.errorUnknown"), "Something went wrong. Please try again."));
        }
      } else {
        // Test thật trên production phát hiện router.push("/") + router.refresh()
        // (điều hướng "mềm" qua RSC của Next.js) đôi lúc bị máy chủ redirect
        // sai sang /auth/register — chỉ xảy ra trên hạ tầng production, không
        // tái hiện được ở local, và chỉ với request dạng RSC chứ không phải
        // tải trang thường (đã verify: fetch thẳng "/" bằng document request
        // luôn đúng). Dùng window.location thay vì router của Next.js để né
        // hẳn đường dẫn RSC bị lỗi đó — tải lại toàn trang nhưng đảm bảo luôn
        // vào đúng nơi.
        // ?callbackUrl= (VD: khách bấm "Muốn làm mẫu này" khi chưa đăng nhập) — chỉ nhận đường dẫn CÙNG trang web
        // (lib/safeRedirect.ts: "/<TAB>/evil.com", "//evil.com", "/\evil.com" → về trang chủ).
        window.location.href = safeInternalPath(new URLSearchParams(window.location.search).get("callbackUrl")) || localeHref("/");
      }
    } catch {
      setError(t("auth.login.errorUnknown"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pn-stack-24">
      <AuthTitle title={t("auth.login.welcome")} sub={t("auth.login.desc")} />

      {error && <ErrorBox>{error}</ErrorBox>}

      <SocialLogin />

      <form onSubmit={handleSubmit} className="pn-stack-16">
        <div>
          <label htmlFor="email" className="pn-label">{t("auth.login.emailLabel")}</label>
          <div className="pn-field-icon">
            <Mail aria-hidden />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.common.emailPlaceholder")}
              aria-invalid={error && !email ? true : undefined}
              className="pn-input"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="pn-label">{t("auth.login.passwordLabel")}</label>
            <Link href="/auth/forgot" className="pn-a" style={{ fontSize: 14, lineHeight: "20px", marginBottom: 6 }}>
              {t("auth.login.forgotPassword")}
            </Link>
          </div>
          <div className="pn-field-icon">
            <Lock aria-hidden />
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.login.passwordPlaceholder")}
              aria-invalid={error && !password ? true : undefined}
              className="pn-input"
            />
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <Submit busy={loading}>{loading ? t("auth.login.processing") : t("auth.login.loginButton")}</Submit>
        </div>
      </form>

      <p className="pn-muted pn-center">
        {t("auth.login.noAccount")}{" "}
        <Link href="/auth/register" className="pn-a">{t("auth.login.registerNow")}</Link>
      </p>
    </div>
  );
}
