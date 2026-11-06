"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Store, Phone, Lock, Mail, User as UserIcon, Loader2,
  ArrowRight, Home, CheckCircle2, Check,
} from "lucide-react";
import { AuthTitle, BackToRoles, CountryCodeSelect, ErrorBox, MarketSeg, Submit } from "@/components/auth/fields";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { guessState } from "@/lib/cityState";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { POSITIONS } from "@/lib/nailVocab";
import { useSessionUser } from "@/lib/SessionUserContext";
import { SURVEY } from "@/lib/ownerSurvey";
import { AU_ALL_CODES, stateName, US_ALL_CODES } from "@/lib/stateNames";
import SalonDiagnosticModal from "@/components/auth/SalonDiagnosticModal";
import { dt } from "@/lib/i18n/dataEn";
import { tr, currentLocale } from "@/lib/i18n/tr";
import { apiError } from "@/lib/i18n/apiError";

// Đủ 50 bang + DC / 8 bang Úc (10 bang đông thợ lên đầu).
const US_STATES = US_ALL_CODES;
const AU_STATES = AU_ALL_CODES;
// Đây vừa là nhãn hiển thị vừa là giá trị lưu DB (salaryType/urgentRole) —
// hiển thị cho MỌI người xem bất kể locale (JobBoard render verbatim), nên
// cố tình giữ tiếng Việt, không đưa vào t() để tránh dữ liệu lẫn ngôn ngữ.
// Vị trí cần tuyển — bộ từ vựng chung (lib/nailVocab.ts): "Thợ bột", "Thợ dip", "Thợ chân tay nước", "Thợ làm được tất cả".
const ROLE_OPTIONS = POSITIONS;
const SALARY_TYPES_US = ["Bao lương tuần", "% Ăn chia"];
const SALARY_TYPES_AU = ["Theo giờ AUD", "Theo tuần AUD"];

const ANSWER_DELAY_MS = 250;

interface SurveyAnswerRecord {
  key: string;
  title: string;
  answer: "A" | "B";
  tag: string | null;
  answeredAt: string;
}

export default function OwnerRegisterForm({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { refresh: refreshSession } = useSessionUser();

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
    await finishRegistration(nextPains, nextAnswers);
  };

  // Tạo tài khoản với những câu đã trả lời (bỏ qua khảo sát = mảng rỗng/dở dang).
  // Không có "nỗi đau" nào → vào thẳng app, khỏi màn chẩn đoán.
  const finishRegistration = async (nextPains: string[], nextAnswers: SurveyAnswerRecord[]) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password, role: "OWNER", locale: currentLocale(), market, state, city,
          phone: `${countryCode} ${phone.trim()}`,
          salonName, urgentRole, salaryType, salaryAmount, hasHousing,
          diagnosedPains: nextPains,
          surveyAnswers: nextAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiError(data, t("auth.owner.registerFailed"), t("auth.owner.registerFailed")));
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
        if (nextPains.length) setPhase("diagnostic");
        else handleFinishDiagnostic();
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
    toast.success(tr("Chào mừng bạn! Đang mở danh sách thợ gần tiệm…", "Welcome! Opening techs near your salon…"), { duration: 3000, icon: "🎉" });
    // Việc đầu tiên của chủ tiệm là nhắn thợ → mở thẳng tab Thợ rảnh.
    const params = new URLSearchParams({ tab: "portfolio", market, state });
    router.push(`/?${params.toString()}`);
  };

  if (phase === "diagnostic") {
    return <SalonDiagnosticModal salonName={salonName} pains={pains} onFinish={handleFinishDiagnostic} />;
  }

  if (phase === "survey") {
    const q = SURVEY[surveyIndex];
    return (
      <div className="pn-stack-24">
        <div className="space-y-3">
          <p className="pn-meta">{t("auth.owner.surveyIntro")}</p>
          <div className="pn-progress" aria-hidden>
            {SURVEY.map((_, idx) => (
              <span key={idx} data-on={idx <= surveyIndex ? "" : undefined} />
            ))}
          </div>
          <p className="pn-meta">{t("auth.owner.surveyProgress", { current: surveyIndex + 1, total: SURVEY.length, title: dt(q.title) })}</p>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <h1 className="pn-display pn-h1">{dt(q.question)}</h1>

        <div className="space-y-3">
          <button type="button" disabled={loading || advancing} aria-pressed={selectedOption === "A"} onClick={() => handleAnswer(true)} className="pn-choice">
            <span className="flex-1">{dt(q.optionA)}</span>
            {selectedOption === "A" && <CheckCircle2 aria-hidden />}
          </button>
          <button type="button" disabled={loading || advancing} aria-pressed={selectedOption === "B"} onClick={() => handleAnswer(false)} className="pn-choice">
            <span className="flex-1">{dt(q.optionB)}</span>
            {selectedOption === "B" && <CheckCircle2 aria-hidden />}
          </button>
        </div>

        {!loading && (
          <button type="button" disabled={advancing} onClick={() => finishRegistration(pains, answers)} className="pn-btn pn-ghost pn-ghost--block">
            {t("auth.owner.skipSurvey")}
          </button>
        )}

        {loading && (
          <p className="pn-meta flex items-center justify-center gap-2" role="status">
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
            <span>{t("auth.owner.creatingShop")}</span>
          </p>
        )}
      </div>
    );
  }

  const setMarketAll = (m: "US" | "AU") => { setMarket(m); setState((m === "US" ? US_STATES : AU_STATES)[0]); setCountryCode(m === "US" ? "+1" : "+61"); setSalaryType((m === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU)[0]); };

  return (
    <div className="pn-stack-24">
      <div>
        <BackToRoles onBack={onBack} />
        <AuthTitle title={t("auth.owner.heading")} sub={t("auth.owner.subheading")} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="pn-stack-16">
        <div>
          <label htmlFor="ow-name" className="pn-label">{t("auth.owner.nameLabel")}</label>
          <div className="pn-field-icon">
            <UserIcon aria-hidden />
            <input id="ow-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.owner.namePlaceholder")} className="pn-input" />
          </div>
        </div>
        <div>
          <label htmlFor="ow-salon" className="pn-label">{t("auth.owner.salonLabel")}</label>
          <div className="pn-field-icon">
            <Store aria-hidden />
            <input id="ow-salon" autoComplete="organization" value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder={t("auth.owner.salonPlaceholder")} className="pn-input" />
          </div>
        </div>
      </div>

      <div className="pn-stack-16">
        <MarketSeg value={market} onChange={setMarketAll} label={tr("Tiệm ở đâu?", "Where is your salon?")} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ow-state" className="pn-label">{t("auth.common.stateLabel")}</label>
            <select id="ow-state" value={state} onChange={(e) => setState(e.target.value)} className="pn-input">
              {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ow-city" className="pn-label">{t("auth.common.cityLabel")}</label>
            <input id="ow-city" autoComplete="address-level2" value={city} onChange={(e) => { setCity(e.target.value); const g = guessState(market, e.target.value); if (g && (states as readonly string[]).includes(g)) setState(g); }} placeholder={t("auth.common.cityPlaceholder")} className="pn-input" />
          </div>
        </div>
        <div>
          <label htmlFor="ow-phone" className="pn-label">{t("auth.owner.phoneLabel")}</label>
          <div className="flex gap-2">
            <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
            <div className="pn-field-icon flex-1">
              <Phone aria-hidden />
              <input id="ow-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.common.phonePlaceholder")} className="pn-input" />
            </div>
          </div>
        </div>
      </div>

      <div className="pn-stack-16">
        <fieldset>
          <legend className="pn-label">{t("auth.owner.urgentRoleLabel")}</legend>
          <div className="pn-pills" style={{ marginTop: 4 }}>
            {ROLE_OPTIONS.map((r) => (
              <button key={r} type="button" aria-pressed={urgentRole.includes(r)} onClick={() => toggleRole(r)} className="pn-pill">
                {urgentRole.includes(r) && <Check aria-hidden />}
                {valueLabel(r)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="pn-stack-16">
          <legend className="pn-label">{t("auth.owner.salaryLabel")}</legend>
          <div className="pn-seg" role="group" aria-label={t("auth.owner.salaryLabel")}>
            {salaryTypes.map((st) => (
              <button key={st} type="button" aria-pressed={salaryType === st} onClick={() => setSalaryType(st)}>{valueLabel(st)}</button>
            ))}
          </div>
          <input aria-label={t("auth.owner.salaryLabel")} value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder={t("auth.owner.salaryPlaceholder")} className="pn-input" />
        </fieldset>

        <button type="button" aria-pressed={hasHousing} onClick={() => setHasHousing(!hasHousing)} className="pn-choice">
          <Home aria-hidden />
          <span className="flex-1 font-semibold">{t("auth.owner.housing")}</span>
          {hasHousing && <Check aria-hidden />}
        </button>
      </div>

      <div className="pn-stack-16">
        <div>
          <label htmlFor="ow-email" className="pn-label">{t("auth.common.emailLoginLabel")}</label>
          <div className="pn-field-icon">
            <Mail aria-hidden />
            <input id="ow-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.common.emailPlaceholder")} className="pn-input" />
          </div>
        </div>
        <div>
          <label htmlFor="ow-pass" className="pn-label">{t("auth.common.passwordLabel")}</label>
          <div className="pn-field-icon">
            <Lock aria-hidden />
            <input id="ow-pass" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.common.passwordHint")} className="pn-input" />
          </div>
        </div>
      </div>

      <Submit type="button" onClick={handleStartSurvey}>
        <span>{t("auth.owner.startSurveyButton")}</span>
        <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
      </Submit>

      <p className="pn-muted pn-center">
        {t("auth.common.alreadyHaveAccount")}{" "}
        <Link href="/auth/login" className="pn-a">{t("auth.common.loginNow")}</Link>
      </p>
    </div>
  );
}
