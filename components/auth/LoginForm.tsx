"use client";

import React, { useState, useContext } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const PRESS = "active:scale-[0.98] transition-transform duration-100";

export default function LoginForm() {
  const router = useRouter();
  const { theme } = useContext(AuthSettingsContext);
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        if (res.error === "CredentialsSignin" || res.error.includes("credential")) {
          setError(t("auth.login.errorInvalid"));
        } else {
          setError(res.error);
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(t("auth.login.errorUnknown"));
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
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
          {t("auth.login.welcome")}
        </h2>
        <p className={`text-sm ${textClass}`}>
          {t("auth.login.desc")}
        </p>
      </div>

      {error && (
        <div className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm ${
          theme === "dark" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600"
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
            {t("auth.login.emailLabel")}
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.common.emailPlaceholder")}
              className={`block w-full min-h-[48px] rounded-2xl h-12 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${inputBgClass}`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className={`block text-xs font-bold ${labelClass}`}
            >
              {t("auth.login.passwordLabel")}
            </label>
            <button
              type="button"
              onClick={() =>
                toast(t("auth.login.forgotPasswordHint"), { icon: "🔒", duration: 6000 })
              }
              className="text-xs font-semibold text-purple-500 hover:text-purple-400 transition-colors cursor-pointer"
            >
              {t("auth.login.forgotPassword")}
            </button>
          </div>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`block w-full min-h-[48px] rounded-2xl h-12 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${inputBgClass}`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 min-h-[48px] h-12 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-all duration-200 cursor-pointer ${PRESS}`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("auth.login.processing")}</span>
            </>
          ) : (
            <span>{t("auth.login.loginButton")}</span>
          )}
        </button>
      </form>

      <div className={`text-center text-sm border-t pt-4 ${dividerClass} ${textClass}`}>
        {t("auth.login.noAccount")}{" "}
        <Link
          href="/auth/register"
          className="font-bold text-purple-500 hover:text-purple-400 transition-colors"
        >
          {t("auth.login.registerNow")}
        </Link>
      </div>
    </div>
  );
}
