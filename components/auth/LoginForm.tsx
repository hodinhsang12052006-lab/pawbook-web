"use client";

import React, { useState, useContext } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { AuthSettingsContext } from "@/app/auth/layout";

const translations = {
  vi: {
    welcome: "Chào mừng trở lại!",
    desc: "Nhập email và mật khẩu của bạn để truy cập BITPAWOS.",
    emailLabel: "Địa chỉ Email",
    placeholderEmail: "name@example.com",
    passwordLabel: "Mật khẩu",
    placeholderPassword: "••••••••",
    forgotPassword: "Quên mật khẩu?",
    loginButton: "Đăng nhập",
    processing: "Đang xử lý...",
    noAccount: "Chưa có tài khoản?",
    registerNow: "Đăng ký ngay",
    errorEmpty: "Vui lòng nhập Email và Mật khẩu.",
    errorInvalid: "Email hoặc mật khẩu không chính xác.",
    errorUnknown: "Đã xảy ra lỗi không xác định. Vui lòng thử lại."
  },
  en: {
    welcome: "Welcome back!",
    desc: "Enter your email and password to access BITPAWOS.",
    emailLabel: "Email Address",
    placeholderEmail: "name@example.com",
    passwordLabel: "Password",
    placeholderPassword: "••••••••",
    forgotPassword: "Forgot password?",
    loginButton: "Login",
    processing: "Processing...",
    noAccount: "Don't have an account?",
    registerNow: "Register now",
    errorEmpty: "Please enter Email and Password.",
    errorInvalid: "Incorrect email or password.",
    errorUnknown: "Unknown error occurred. Please try again."
  }
};

export default function LoginForm() {
  const router = useRouter();
  const { theme, lang } = useContext(AuthSettingsContext);
  const t = translations[lang];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError(t.errorEmpty);
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
        if (res.error === "CredentialsSignin" || res.error.includes("credential")) {
          setError(t.errorInvalid);
        } else {
          setError(res.error);
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(t.errorUnknown);
    } finally {
      setLoading(false);
    }
  };

  // Theme-adaptive classes
  const inputBgClass = theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900";
  const labelClass = theme === "dark" ? "text-slate-300" : "text-slate-700";
  const textClass = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const dividerClass = theme === "dark" ? "border-slate-800" : "border-slate-200";

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Mobile-only Branding */}
      <div className="block lg:hidden text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className={`h-12 w-12 overflow-hidden rounded-xl border p-0.5 shadow-lg ${
            theme === "dark" ? "border-blue-500/40 bg-blue-500/10 shadow-blue-500/20" : "border-blue-500/20 bg-blue-50 shadow-blue-500/10"
          }`}>
            <img
              src="/cho1.jpg"
              alt="PawBook Logo"
              className="h-full w-full object-cover rounded-lg"
            />
          </div>
          <span className={`bg-gradient-to-r ${theme === "dark" ? "from-blue-400 to-indigo-500" : "from-blue-600 to-indigo-700"} bg-clip-text text-2xl font-black tracking-widest text-transparent uppercase select-none`}>
            BITPAWOS
          </span>
        </Link>
      </div>

      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
          {t.welcome}
        </h2>
        <p className={`text-sm ${textClass}`}>
          {t.desc}
        </p>
      </div>

      {error && (
        <div className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm ${
          theme === "dark" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-650"
        }`}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className={`block text-xs font-bold ${labelClass}`}
          >
            {t.emailLabel}
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.placeholderEmail}
              className={`block w-full rounded-xl h-12 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${inputBgClass}`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className={`block text-xs font-bold ${labelClass}`}
            >
              {t.passwordLabel}
            </label>
            <a
              href="#"
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
            >
              {t.forgotPassword}
            </a>
          </div>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.placeholderPassword}
              className={`block w-full rounded-xl h-12 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${inputBgClass}`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-655 h-12 text-sm font-bold text-white shadow-lg shadow-blue-600/15 hover:from-blue-500 hover:to-indigo-550 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.processing}</span>
            </>
          ) : (
            <span>{t.loginButton}</span>
          )}
        </button>
      </form>

      <div className={`text-center text-sm border-t pt-4 ${dividerClass} ${textClass}`}>
        {t.noAccount}{" "}
        <Link
          href="/auth/register"
          className="font-bold text-blue-600 hover:text-blue-500 transition-colors"
        >
          {t.registerNow}
        </Link>
      </div>
    </div>
  );
}
