"use client";

import React, { useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";
import {
  Phone, Lock, Mail, User as UserIcon, Loader2, AlertCircle,
  ArrowLeft, ArrowRight, Upload, X, Flame, CheckCircle2, RefreshCw,
} from "lucide-react";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { stateName } from "@/lib/stateNames";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useSessionUser } from "@/lib/SessionUserContext";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];
// Giá trị lưu DB (specialties/desiredSalaryType/desiredBenefits), hiển thị
// cho MỌI người xem bất kể locale — cố tình giữ tiếng Việt, không qua t().
const SKILL_OPTIONS = ["Bột (Acrylic/Ombre)", "Dip/SNS", "Chân tay nước", "Design nghệ thuật", "Gel-X/Biab"];
const BENEFIT_OPTIONS = ["Có chỗ ở (Housing)", "Hỗ trợ dời bang", "Cần bảo lãnh Visa (EB-3/482)"];

// Hiệu ứng bấm nút kiểu app native — dùng chung cho mọi nút chạm-để-chọn
const PRESS = "active:scale-[0.98] transition-transform duration-100";

export default function TechnicianRegisterForm() {
  const router = useRouter();
  const { theme } = useContext(AuthSettingsContext);
  const { t } = useLanguage();
  const { refresh: refreshSession } = useSessionUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === "dark";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState<"+1" | "+61">("+1");
  const [phone, setPhone] = useState("");
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("");

  // Step 2
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [salaryMode, setSalaryMode] = useState<"Bao lương" | "Ăn chia %">("Bao lương");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [benefits, setBenefits] = useState<string[]>([]);

  // Step 3
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [status, setStatus] = useState<"URGENT" | "BETTER">("URGENT");

  const states = market === "US" ? US_STATES : AU_STATES;
  const cardClass = isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200";
  const labelClass = isDark ? "text-slate-300" : "text-slate-700";
  const inputClass = `w-full min-h-[48px] rounded-2xl border px-4 py-3 text-base focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all ${
    isDark ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
  }`;

  const toggleSpecialty = (s: string) => setSpecialties((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const toggleBenefit = (b: string) => setBenefits((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));

  // Bước 1 -> tạo tài khoản ngay + đăng nhập ngầm (signIn redirect:false), để
  // Bước 3 upload ảnh có session hợp lệ và người dùng không phải đăng nhập lại.
  const handleFinishStep1 = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password || !phone.trim() || !city.trim()) {
      setError(t("auth.common.requiredFieldsError"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password, role: "TECHNICIAN", market, state, city,
          phone: `${countryCode} ${phone.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.owner.registerFailed"));
        setLoading(false);
        return;
      }
      const signInResult = await signIn("credentials", { redirect: false, email, password });
      setLoading(false);
      if (!signInResult?.ok) {
        setError(t("auth.technician.loginFailedAfterRegister"));
        return;
      }
      // Cập nhật session dùng chung (Navbar/Sidebar) ngay lập tức, không cần
      // tải lại trang — đây là điều làm cho luồng cảm giác "instant".
      refreshSession();
      setStep(2);
    } catch {
      setError(t("auth.common.networkError"));
      setLoading(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const rawFile of Array.from(files).slice(0, 5 - portfolioImages.length)) {
        try {
          const file = await prepareFileForUpload(rawFile);
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (res.ok && data.url) {
            setPortfolioImages((prev) => [...prev, data.url]);
          } else {
            toast.error(data.error || `Không thể tải "${rawFile.name}" lên.`);
          }
        } catch (err) {
          toast.error(err instanceof FileTooLargeError ? err.message : `Lỗi mạng khi tải "${rawFile.name}" lên.`);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => setPortfolioImages((prev) => prev.filter((u) => u !== url));

  const handleFinish = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technician: {
            specialties: specialties.join(","),
            status,
            desiredSalaryType: salaryMode,
            desiredSalaryAmount: salaryAmount,
            desiredBenefits: benefits.join(","),
            portfolioImages,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("auth.technician.saveFailed"));
        setLoading(false);
        return;
      }
      refreshSession();
      toast.success("Chào mừng bạn đến với cộng đồng Nail! Đang mở bảng tin...", { duration: 3000, icon: "🎉" });
      // router.push (client-side, không full-page reload) — zero flash trắng màn hình
      router.push("/?tab=jobs");
    } catch {
      setError(t("auth.common.networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
          {step === 1 && t("auth.technician.step1Heading")}
          {step === 2 && t("auth.technician.step2Heading")}
          {step === 3 && t("auth.technician.step3Heading")}
        </h2>
        <p className={isDark ? "text-slate-400 text-sm" : "text-slate-500 text-sm"}>
          {t("auth.technician.stepProgress", { current: step })}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.technician.nameLabel")}</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.technician.namePlaceholder")} className={`${inputClass} pl-11`} />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.common.phoneLabel")}</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as "+1" | "+61")}
                className={`min-h-[48px] rounded-2xl border px-3 py-3 text-base font-bold ${isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
              >
                <option value="+1">🇺🇸 +1</option>
                <option value="+61">🇦🇺 +61</option>
              </select>
              <div className="relative flex-1">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.common.phonePlaceholder")} className={`${inputClass} pl-11`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMarket("US"); setState(US_STATES[0]); setCountryCode("+1"); }}
              className={`min-h-[48px] rounded-2xl py-3 text-sm font-bold border-2 ${PRESS} ${market === "US" ? "border-pink-500 bg-pink-500/10" : cardClass} ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {t("auth.common.marketUS")}
            </button>
            <button
              type="button"
              onClick={() => { setMarket("AU"); setState(AU_STATES[0]); setCountryCode("+61"); }}
              className={`min-h-[48px] rounded-2xl py-3 text-sm font-bold border-2 ${PRESS} ${market === "AU" ? "border-pink-500 bg-pink-500/10" : cardClass} ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {t("auth.common.marketAU")}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.common.stateLabel")}</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.common.cityLabel")}</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("auth.common.cityPlaceholder")} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.common.emailLoginLabel")}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.common.emailPlaceholder")} className={`${inputClass} pl-11`} />
            </div>
          </div>
          <div>
            <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.common.passwordLabel")}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.common.passwordHint")} className={`${inputClass} pl-11`} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinishStep1}
            disabled={loading}
            className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 py-3.5 text-base font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 disabled:opacity-50 ${PRESS}`}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>{t("auth.common.continue")}</span><ArrowRight className="h-5 w-5" /></>}
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-5 animate-fadeIn">
          <div>
            <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.technician.specialtiesLabel")}</label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className={`min-h-[48px] rounded-full px-3.5 py-2.5 text-sm font-bold border-2 transition-colors ${PRESS} ${specialties.includes(s) ? "border-pink-500 bg-pink-500/15 text-pink-400" : `${cardClass} ${labelClass}`}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.technician.desiredSalaryLabel")}</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSalaryMode("Bao lương")}
                className={`min-h-[48px] rounded-2xl py-2.5 text-sm font-bold border-2 ${PRESS} ${salaryMode === "Bao lương" ? "border-pink-500 bg-pink-500/10" : cardClass} ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Bao lương
              </button>
              <button
                type="button"
                onClick={() => setSalaryMode("Ăn chia %")}
                className={`min-h-[48px] rounded-2xl py-2.5 text-sm font-bold border-2 ${PRESS} ${salaryMode === "Ăn chia %" ? "border-pink-500 bg-pink-500/10" : cardClass} ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Ăn chia %
              </button>
            </div>
            <input
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder={salaryMode === "Bao lương" ? "VD: $1,200/tuần" : "VD: 60/40"}
              className={inputClass}
            />
          </div>

          <div>
            <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.technician.benefitsLabel")}</label>
            <div className="flex flex-wrap gap-2">
              {BENEFIT_OPTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBenefit(b)}
                  className={`min-h-[48px] rounded-full px-3.5 py-2.5 text-sm font-bold border-2 transition-colors ${PRESS} ${benefits.includes(b) ? "border-emerald-500 bg-emerald-500/15 text-emerald-400" : `${cardClass} ${labelClass}`}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className={`min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 font-bold ${cardClass} ${labelClass} ${PRESS}`}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className={`flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 py-3.5 text-base font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 ${PRESS}`}
            >
              <span>{t("auth.common.continue")}</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-5 animate-fadeIn">
          <div>
            <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.technician.uploadLabel")}</label>
            <div className="grid grid-cols-3 gap-2">
              {portfolioImages.map((url) => (
                <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 group">
                  <img src={url} alt="portfolio" className="h-full w-full object-cover" />
                  <button onClick={() => removeImage(url)} className={`absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white ${PRESS}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {portfolioImages.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`aspect-square rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-purple-500 hover:text-purple-400 transition-colors ${PRESS}`}
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[10px] font-bold">{t("auth.technician.uploadButton")}</span>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUploadPhoto} />
          </div>

          <div>
            <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.technician.statusLabel")}</label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setStatus("URGENT")}
                className={`w-full min-h-[48px] flex items-center gap-3 rounded-2xl p-4 border-2 ${PRESS} ${status === "URGENT" ? "border-red-500 bg-red-500/10" : cardClass}`}
              >
                <Flame className={`h-5 w-5 ${status === "URGENT" ? "text-red-400" : "text-slate-500"}`} />
                <span className={`font-bold ${status === "URGENT" ? "text-red-300" : labelClass}`}>{t("auth.technician.statusUrgent")}</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("BETTER")}
                className={`w-full min-h-[48px] flex items-center gap-3 rounded-2xl p-4 border-2 ${PRESS} ${status === "BETTER" ? "border-blue-500 bg-blue-500/10" : cardClass}`}
              >
                <RefreshCw className={`h-5 w-5 ${status === "BETTER" ? "text-blue-400" : "text-slate-500"}`} />
                <span className={`font-bold ${status === "BETTER" ? "text-blue-300" : labelClass}`}>{t("auth.technician.statusBetter")}</span>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className={`min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 font-bold ${cardClass} ${labelClass} ${PRESS}`}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className={`flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 py-3.5 text-base font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 disabled:opacity-50 ${PRESS}`}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /><span>{t("auth.technician.finishButton")}</span></>}
            </button>
          </div>
        </div>
      )}

      <p className={`text-center text-sm ${labelClass}`}>
        {t("auth.common.alreadyHaveAccount")}{" "}
        <Link href="/auth/login" className="font-bold text-purple-500 hover:text-purple-400 transition-colors">
          {t("auth.common.loginNow")}
        </Link>
      </p>
    </div>
  );
}
