"use client";

import React, { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Store, Phone, Lock, Mail, User as UserIcon, Loader2, AlertCircle,
  ArrowRight, Home, CheckCircle2,
} from "lucide-react";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useSessionUser } from "@/lib/SessionUserContext";
import { SURVEY } from "@/lib/ownerSurvey";
import { stateName } from "@/lib/stateNames";
import SalonDiagnosticModal from "@/components/auth/SalonDiagnosticModal";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];
// Đây vừa là nhãn hiển thị vừa là giá trị lưu DB (salaryType/urgentRole) —
// hiển thị cho MỌI người xem bất kể locale (JobBoard render verbatim), nên
// cố tình giữ tiếng Việt, không đưa vào t() để tránh dữ liệu lẫn ngôn ngữ.
const ROLE_OPTIONS = ["Thợ Bột", "Thợ Dip", "Thợ Nước", "All-around"];
const SALARY_TYPES_US = ["Bao lương tuần", "% Ăn chia"];
const SALARY_TYPES_AU = ["Theo giờ AUD", "Theo tuần AUD"];

// Hiệu ứng bấm nút kiểu app native — dùng chung cho mọi nút chạm-để-chọn
const PRESS = "active:scale-[0.98] transition-transform duration-100";
const ANSWER_DELAY_MS = 250;

interface SurveyAnswerRecord {
  key: string;
  title: string;
  answer: "A" | "B";
  tag: string | null;
  answeredAt: string;
}

export default function OwnerRegisterForm() {
  const router = useRouter();
  const { theme } = useContext(AuthSettingsContext);
  const { t } = useLanguage();
  const { refresh: refreshSession } = useSessionUser();
  const isDark = theme === "dark";

  // phase: "setup" (screen 1) -> "survey" (screen 2, 5 questions) ->
  // "diagnostic" (màn hình chẩn đoán sau khi tạo tài khoản thành công)
  const [phase, setPhase] = useState<"setup" | "survey" | "diagnostic">("setup");
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [pains, setPains] = useState<string[]>([]);
  const [answers, setAnswers] = useState<SurveyAnswerRecord[]>([]);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Screen 1 fields
  const [name, setName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState<"+1" | "+61">("+1");
  const [phone, setPhone] = useState("");
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("");
  const [urgentRole, setUrgentRole] = useState<string[]>([]);
  const [salaryType, setSalaryType] = useState(SALARY_TYPES_US[0]);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [hasHousing, setHasHousing] = useState(false);

  const states = market === "US" ? US_STATES : AU_STATES;
  const salaryTypes = market === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU;

  const cardClass = isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200";
  const labelClass = isDark ? "text-slate-300" : "text-slate-700";
  const inputClass = `w-full min-h-[48px] rounded-2xl border px-4 py-3 text-base focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all ${
    isDark ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
  }`;

  const toggleRole = (r: string) => setUrgentRole((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const handleStartSurvey = () => {
    setError("");
    if (!name.trim() || !salonName.trim() || !email.trim() || !password || !phone.trim() || !city.trim()) {
      setError(t("auth.common.requiredFieldsError"));
      return;
    }
    setPhase("survey");
    setSurveyIndex(0);
  };

  // Bấm đáp án -> hiện tick ngay lập tức -> giữ 250ms cho người dùng thấy đã
  // chọn -> trượt sang câu kế tiếp (hoặc hoàn tất nếu là câu cuối).
  const handleAnswer = (isPainAnswer: boolean) => {
    if (advancing || loading) return;
    setSelectedOption(isPainAnswer ? "A" : "B");
    setAdvancing(true);
    setTimeout(() => submitAnswer(isPainAnswer), ANSWER_DELAY_MS);
  };

  const submitAnswer = async (isPainAnswer: boolean) => {
    const q = SURVEY[surveyIndex];
    const nextPains = isPainAnswer ? [...pains, q.tag] : pains;
    setPains(nextPains);

    const nextAnswers: SurveyAnswerRecord[] = [
      ...answers,
      {
        key: q.key,
        title: q.title,
        answer: isPainAnswer ? "A" : "B",
        tag: isPainAnswer ? q.tag : null,
        answeredAt: new Date().toISOString(),
      },
    ];
    setAnswers(nextAnswers);

    if (surveyIndex < SURVEY.length - 1) {
      setSurveyIndex((i) => i + 1);
      setSelectedOption(null);
      setAdvancing(false);
      return;
    }

    // Câu cuối cùng — hoàn tất đăng ký, tạo tài khoản + đăng nhập ngầm ngay
    setAdvancing(false);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password, role: "OWNER", market, state, city,
          phone: `${countryCode} ${phone.trim()}`,
          salonName, urgentRole, salaryType, salaryAmount, hasHousing,
          diagnosedPains: nextPains,
          surveyAnswers: nextAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.owner.registerFailed"));
        setLoading(false);
        return;
      }
      const signInResult = await signIn("credentials", { redirect: false, email, password });
      if (signInResult?.ok) {
        // Cập nhật session dùng chung (Navbar/Sidebar) ngay lập tức
        refreshSession();
        setLoading(false);
        // Không chuyển hướng ngay — hiện màn hình chẩn đoán vận hành trước,
        // điều hướng thật sự xảy ra khi họ bấm CTA trong SalonDiagnosticModal.
        setPhase("diagnostic");
      } else {
        setLoading(false);
        router.push("/auth/login");
      }
    } catch {
      setError(t("auth.common.networkError"));
      setLoading(false);
    }
  };

  // CTA cuối màn hình chẩn đoán — đưa họ về sàn với market/state của tiệm
  // đã điền sẵn để bộ lọc trang chủ tự khớp luôn, khỏi phải chọn lại.
  const handleFinishDiagnostic = () => {
    toast.success("Chào mừng bạn đến với cộng đồng Nail! Đang mở bảng tin...", { duration: 3000, icon: "🎉" });
    const params = new URLSearchParams({ tab: "jobs", market, state });
    router.push(`/?${params.toString()}`);
  };

  if (phase === "diagnostic") {
    return <SalonDiagnosticModal salonName={salonName} pains={pains} onFinish={handleFinishDiagnostic} />;
  }

  if (phase === "survey") {
    const q = SURVEY[surveyIndex];
    return (
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-pink-400" : "text-pink-600"}`}>
            {t("auth.owner.surveyIntro")}
          </p>
          <div className="flex gap-1.5">
            {SURVEY.map((_, idx) => (
              <div key={idx} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${idx <= surveyIndex ? "bg-pink-500" : isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            ))}
          </div>
          <p className={`text-xs ${labelClass}`}>{t("auth.owner.surveyProgress", { current: surveyIndex + 1, total: SURVEY.length, title: q.title })}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <h2 className={`text-xl font-extrabold leading-snug transition-opacity duration-200 ${isDark ? "text-white" : "text-slate-900"}`}>
          {q.question}
        </h2>

        <div className="space-y-3">
          <button
            type="button"
            disabled={loading || advancing}
            onClick={() => handleAnswer(true)}
            className={`w-full text-left rounded-2xl border-2 p-4 transition-all disabled:cursor-not-allowed ${PRESS} ${
              selectedOption === "A" ? "border-pink-500 bg-pink-500/10" : `${cardClass} hover:border-pink-500/50`
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`text-sm leading-relaxed ${labelClass}`}>{q.optionA}</span>
              {selectedOption === "A" && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-pink-400" />}
            </div>
          </button>
          <button
            type="button"
            disabled={loading || advancing}
            onClick={() => handleAnswer(false)}
            className={`w-full text-left rounded-2xl border-2 p-4 transition-all disabled:cursor-not-allowed ${PRESS} ${
              selectedOption === "B" ? "border-emerald-500 bg-emerald-500/10" : `${cardClass} hover:border-emerald-500/50`
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`text-sm leading-relaxed ${labelClass}`}>{q.optionB}</span>
              {selectedOption === "B" && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />}
            </div>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("auth.owner.creatingShop")}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
          {t("auth.owner.heading")}
        </h2>
        <p className={isDark ? "text-slate-400 text-sm" : "text-slate-500 text-sm"}>
          {t("auth.owner.subheading")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.owner.nameLabel")}</label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.owner.namePlaceholder")} className={`${inputClass} pl-11`} />
          </div>
        </div>

        <div>
          <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.owner.salonLabel")}</label>
          <div className="relative">
            <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder={t("auth.owner.salonPlaceholder")} className={`${inputClass} pl-11`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setMarket("US"); setState(US_STATES[0]); setCountryCode("+1"); setSalaryType(SALARY_TYPES_US[0]); }}
            className={`min-h-[48px] rounded-2xl py-3 text-sm font-bold border-2 ${PRESS} ${market === "US" ? "border-pink-500 bg-pink-500/10" : cardClass} ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {t("auth.common.marketUS")}
          </button>
          <button
            type="button"
            onClick={() => { setMarket("AU"); setState(AU_STATES[0]); setCountryCode("+61"); setSalaryType(SALARY_TYPES_AU[0]); }}
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
          <label className={`block text-sm font-bold mb-1.5 ${labelClass}`}>{t("auth.owner.phoneLabel")}</label>
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

        <div>
          <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.owner.urgentRoleLabel")}</label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={`min-h-[48px] rounded-full px-3.5 py-2.5 text-sm font-bold border-2 transition-colors ${PRESS} ${urgentRole.includes(r) ? "border-pink-500 bg-pink-500/15 text-pink-400" : `${cardClass} ${labelClass}`}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`block text-sm font-bold mb-2 ${labelClass}`}>{t("auth.owner.salaryLabel")}</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {salaryTypes.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSalaryType(st)}
                className={`min-h-[48px] rounded-2xl py-2.5 text-xs font-bold border-2 ${PRESS} ${salaryType === st ? "border-pink-500 bg-pink-500/10" : cardClass} ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {st}
              </button>
            ))}
          </div>
          <input value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder={t("auth.owner.salaryPlaceholder")} className={inputClass} />
        </div>

        <button
          type="button"
          onClick={() => setHasHousing(!hasHousing)}
          className={`w-full min-h-[48px] flex items-center gap-3 rounded-2xl p-4 border-2 ${PRESS} ${hasHousing ? "border-emerald-500 bg-emerald-500/10" : cardClass}`}
        >
          <Home className={`h-5 w-5 ${hasHousing ? "text-emerald-400" : "text-slate-500"}`} />
          <span className={`font-bold ${hasHousing ? "text-emerald-300" : labelClass}`}>{t("auth.owner.housing")}</span>
        </button>

        <div className="pt-2 border-t border-slate-800/60 space-y-4">
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
        </div>

        <button
          type="button"
          onClick={handleStartSurvey}
          className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 py-3.5 text-base font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 ${PRESS}`}
        >
          <span>{t("auth.owner.startSurveyButton")}</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <p className={`text-center text-sm ${labelClass}`}>
        {t("auth.common.alreadyHaveAccount")}{" "}
        <Link href="/auth/login" className="font-bold text-purple-500 hover:text-purple-400 transition-colors">
          {t("auth.common.loginNow")}
        </Link>
      </p>
    </div>
  );
}
