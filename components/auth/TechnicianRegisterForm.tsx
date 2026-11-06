"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";
import {
  Phone, Lock, Mail, User as UserIcon, Loader2,
  ArrowLeft, ArrowRight, Upload, X, Flame, CheckCircle2, RefreshCw, Check,
} from "lucide-react";
import { stateName } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { tr, currentLocale } from "@/lib/i18n/tr";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { SIGNUP_SKILLS, techBenefits } from "@/lib/nailVocab";
import { useViewerMarket } from "@/lib/useViewerMarket";
import { useSessionUser } from "@/lib/SessionUserContext";
import { apiError } from "@/lib/i18n/apiError";
import { AuthTitle, BackToRoles, CountryCodeSelect, ErrorBox, MarketSeg, Submit } from "@/components/auth/fields";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];
// Giá trị lưu DB (specialties/desiredSalaryType/desiredBenefits), hiển thị
// cho MỌI người xem bất kể locale — cố tình giữ tiếng Việt, không qua t().
// Bộ từ vựng chung với hồ sơ / bộ lọc / đăng tin (lib/nailVocab.ts) — trước đây form này lưu giá trị riêng
// ("Bột (Acrylic/Ombre)", "Gel-X/Biab") nên hồ sơ và bộ lọc không nhận ra kỹ năng của thợ.
const SKILL_OPTIONS = SIGNUP_SKILLS;

export default function TechnicianRegisterForm({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { refresh: refreshSession } = useSessionUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  // Visa theo đúng thị trường (Mỹ: EB-3, Úc: 482)
  const BENEFIT_OPTIONS = techBenefits(market);
  // Thị trường mặc định theo người xem (IP / ngôn ngữ / múi giờ) — tới khi họ tự bấm Mỹ / Úc.
  const { market: viewerMarket } = useViewerMarket();
  const marketTouched = useRef(false);
  useEffect(() => {
    if (marketTouched.current || viewerMarket === market) return;
    setMarket(viewerMarket);
    setState((viewerMarket === "US" ? US_STATES : AU_STATES)[0]);
    setCountryCode(viewerMarket === "US" ? "+1" : "+61");
    setBenefits([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerMarket]);
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
          name, email, password, role: "TECHNICIAN", locale: currentLocale(), market, state, city,
          phone: `${countryCode} ${phone.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiError(data, t("auth.owner.registerFailed"), t("auth.owner.registerFailed")));
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
            toast.error(apiError(data, `Không thể tải "${rawFile.name}" lên.`, `Couldn't upload "${rawFile.name}".`));
          }
        } catch (err) {
          toast.error(err instanceof FileTooLargeError ? err.message : tr(`Lỗi mạng khi tải "${rawFile.name}" lên.`, `Network error uploading "${rawFile.name}".`));
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
        setError(apiError(data, t("auth.technician.saveFailed"), t("auth.technician.saveFailed")));
        setLoading(false);
        return;
      }
      refreshSession();
      toast.success(tr("Chào mừng bạn! Đang mở việc làm gần bạn…", "Welcome! Opening jobs near you…"), { duration: 3000, icon: "🎉" });
      // router.push (client-side, không full-page reload) — zero flash trắng màn hình
      router.push("/?tab=jobs");
    } catch {
      setError(t("auth.common.networkError"));
      setLoading(false);
    }
  };

  const setMarketAll = (m: "US" | "AU") => { marketTouched.current = true; setMarket(m); setState((m === "US" ? US_STATES : AU_STATES)[0]); setCountryCode(m === "US" ? "+1" : "+61"); setBenefits([]); };

  return (
    <div className="pn-stack-24">
      <div>
        {step === 1 && <BackToRoles onBack={onBack} />}
        <AuthTitle
          title={step === 1 ? t("auth.technician.step1Heading") : step === 2 ? t("auth.technician.step2Heading") : t("auth.technician.step3Heading")}
          sub={t("auth.technician.stepProgress", { current: step })}
        />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="pn-stack-24">
          <div className="pn-stack-16">
            <div>
              <label htmlFor="tr-name" className="pn-label">{t("auth.technician.nameLabel")}</label>
              <div className="pn-field-icon">
                <UserIcon aria-hidden />
                <input id="tr-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.technician.namePlaceholder")} className="pn-input" />
              </div>
            </div>
            <div>
              <label htmlFor="tr-phone" className="pn-label">{t("auth.common.phoneLabel")}</label>
              <div className="flex gap-2">
                <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                <div className="pn-field-icon flex-1">
                  <Phone aria-hidden />
                  <input id="tr-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.common.phonePlaceholder")} className="pn-input" />
                </div>
              </div>
            </div>
          </div>

          <div className="pn-stack-16">
            <MarketSeg value={market} onChange={setMarketAll} label={tr("Bạn làm ở đâu?", "Where do you work?")} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tr-state" className="pn-label">{t("auth.common.stateLabel")}</label>
                <select id="tr-state" value={state} onChange={(e) => setState(e.target.value)} className="pn-input">
                  {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tr-city" className="pn-label">{t("auth.common.cityLabel")}</label>
                <input id="tr-city" autoComplete="address-level2" value={city} onChange={(e) => { setCity(e.target.value); const g = guessState(market, e.target.value); if (g && (states as readonly string[]).includes(g)) setState(g); }} placeholder={t("auth.common.cityPlaceholder")} className="pn-input" />
              </div>
            </div>
          </div>

          <div className="pn-stack-16">
            <div>
              <label htmlFor="tr-email" className="pn-label">{t("auth.common.emailLoginLabel")}</label>
              <div className="pn-field-icon">
                <Mail aria-hidden />
                <input id="tr-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.common.emailPlaceholder")} className="pn-input" />
              </div>
            </div>
            <div>
              <label htmlFor="tr-pass" className="pn-label">{t("auth.common.passwordLabel")}</label>
              <div className="pn-field-icon">
                <Lock aria-hidden />
                <input id="tr-pass" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.common.passwordHint")} className="pn-input" />
              </div>
            </div>
          </div>

          <Submit type="button" onClick={handleFinishStep1} busy={loading}>
            {!loading && <><span>{t("auth.common.continue")}</span><ArrowRight className="h-[18px] w-[18px]" aria-hidden /></>}
          </Submit>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="pn-stack-24">
          <fieldset>
            <legend className="pn-label">{t("auth.technician.specialtiesLabel")}</legend>
            <div className="pn-pills" style={{ marginTop: 4 }}>
              {SKILL_OPTIONS.map((s) => (
                <button key={s} type="button" aria-pressed={specialties.includes(s)} onClick={() => toggleSpecialty(s)} className="pn-pill">
                  {specialties.includes(s) && <Check aria-hidden />}
                  {valueLabel(s)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="pn-stack-16">
            <legend className="pn-label">{t("auth.technician.desiredSalaryLabel")}</legend>
            <div className="pn-seg" role="group" aria-label={t("auth.technician.desiredSalaryLabel")}>
              {(["Bao lương", "Ăn chia %"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={salaryMode === m} onClick={() => setSalaryMode(m)}>{valueLabel(m)}</button>
              ))}
            </div>
            <input
              aria-label={t("auth.technician.desiredSalaryLabel")}
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder={salaryMode === "Bao lương" ? tr("VD: $1,200/tuần", "e.g. $1,200/week") : tr("VD: 60/40", "e.g. 60/40")}
              className="pn-input"
            />
          </fieldset>

          <fieldset>
            <legend className="pn-label">{t("auth.technician.benefitsLabel")}</legend>
            <div className="pn-pills" style={{ marginTop: 4 }}>
              {BENEFIT_OPTIONS.map((b) => (
                <button key={b} type="button" aria-pressed={benefits.includes(b)} onClick={() => toggleBenefit(b)} className="pn-pill">
                  {benefits.includes(b) && <Check aria-hidden />}
                  {valueLabel(b, market)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="pn-btn pn-ghost" aria-label={tr("Quay lại", "Back")} style={{ height: 52, padding: "0 18px" }}>
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <div className="flex-1">
              <Submit type="button" onClick={() => setStep(3)}>
                <span>{t("auth.common.continue")}</span><ArrowRight className="h-[18px] w-[18px]" aria-hidden />
              </Submit>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="pn-stack-24">
          <div>
            <p className="pn-label">{t("auth.technician.uploadLabel")}</p>
            <div className="pn-uploads">
              {portfolioImages.map((url) => (
                <div key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={tr("Ảnh tác phẩm", "Portfolio photo")} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(url)} aria-label={tr("Xoá ảnh", "Remove photo")} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              {portfolioImages.length < 5 && (
                <div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="pn-upload-add">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
                    <span>{t("auth.technician.uploadButton")}</span>
                  </button>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUploadPhoto} />
          </div>

          <fieldset className="space-y-2">
            <legend className="pn-label">{t("auth.technician.statusLabel")}</legend>
            <button type="button" aria-pressed={status === "URGENT"} onClick={() => setStatus("URGENT")} className="pn-choice">
              <Flame aria-hidden />
              <span className="font-semibold">{t("auth.technician.statusUrgent")}</span>
            </button>
            <button type="button" aria-pressed={status === "BETTER"} onClick={() => setStatus("BETTER")} className="pn-choice">
              <RefreshCw aria-hidden />
              <span className="font-semibold">{t("auth.technician.statusBetter")}</span>
            </button>
          </fieldset>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="pn-btn pn-ghost" aria-label={tr("Quay lại", "Back")} style={{ height: 52, padding: "0 18px" }}>
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <div className="flex-1">
              <Submit type="button" onClick={handleFinish} busy={loading}>
                {!loading && <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden />}
                <span>{t("auth.technician.finishButton")}</span>
              </Submit>
            </div>
          </div>
        </div>
      )}

      <p className="pn-muted pn-center">
        {t("auth.common.alreadyHaveAccount")}{" "}
        <Link href="/auth/login" className="pn-a">{t("auth.common.loginNow")}</Link>
      </p>
    </div>
  );
}
