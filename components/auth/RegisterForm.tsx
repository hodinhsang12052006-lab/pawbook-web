"use client";

import React, { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { User, Briefcase, Lock, Mail, Loader2, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, Store, Laptop, Smile } from "lucide-react";
import { AuthSettingsContext } from "@/app/auth/layout";

const translations = {
  vi: {
    titleStep1: "Chọn định danh của bạn",
    titleStep2: "Thiết lập thông tin tài khoản",
    titleStep3: "Cá nhân hóa hồ sơ của bạn",
    descStep1: "Nhóm định danh giúp chúng tôi tối ưu bảng tin & công việc phù hợp với bạn.",
    descStep2: "Nhập thông tin đăng nhập cơ bản để khởi tạo tài khoản bảo mật.",
    descStep3Candidate: "Cá nhân hóa sở thích và thông tin của bạn.",
    descStep3Business: "Thiết lập thông tin tiệm để tự động tạo gian hàng dịch vụ.",
    descStep3Specialist: "Nhập kỹ năng nổi bật để bot AI PawBot tự động tìm job phù hợp.",
    personaCandidate: "👤 Khách hàng Cá nhân",
    personaCandidateDesc: "Khám phá dịch vụ, đặt lịch, mua sắm và trải nghiệm hệ sinh thái.",
    personaBusiness: "🏪 Doanh nghiệp & Cửa hàng",
    personaBusinessDesc: "Quản lý điểm bán, spa, dịch vụ địa phương và tuyển dụng.",
    personaSpecialist: "💼 Chuyên gia & Đối tác",
    personaSpecialistDesc: "Cung cấp dịch vụ chuyên môn, nhận việc tự do và kiếm tiền.",
    orContinueWith: "Hoặc tiếp tục với",
    fullName: "Họ và Tên",
    placeholderName: "Nguyễn Văn A",
    emailAddress: "Địa chỉ Email",
    placeholderEmail: "name@example.com",
    password: "Mật khẩu",
    placeholderPassword: "Tối thiểu 6 ký tự",
    back: "Quay lại",
    continue: "Tiếp tục",
    complete: "Hoàn tất đăng ký",
    completing: "Đang hoàn tất đăng ký...",
    hasAccount: "Đã có tài khoản?",
    loginNow: "Đăng nhập ngay",
    interests: "Sở thích / Dịch vụ quan tâm",
    placeholderInterests: "Spa, làm thú cưng, mua sắm, ăn uống...",
    selfDesc: "Mô tả bản thân",
    placeholderBio: "Giới thiệu ngắn về bản thân bạn...",
    businessCategory: "Ngành nghề kinh doanh",
    businessIntro: "Giới thiệu cửa hàng",
    placeholderShop: "Tên tiệm, địa chỉ, slogan hoặc giới thiệu ngắn...",
    skills: "Kỹ năng chuyên môn",
    placeholderSkills: "Thiết kế, Lập trình, Kế toán, Chăm sóc da...",
    experience: "Kinh nghiệm làm việc",
    placeholderExp: "Tóm tắt kinh nghiệm làm việc của bạn...",
    errorEmptyFields: "Vui lòng điền đầy đủ thông tin yêu cầu.",
    errorShortPassword: "Mật khẩu phải tối thiểu 6 ký tự.",
    errorRegisterFailed: "Đăng ký thất bại. Vui lòng thử lại.",
    successMsg: "Đăng ký thành công! Đang chuyển hướng...",
    errorAutoLogin: "Đăng ký thành công nhưng không thể tự động đăng nhập. Vui lòng đăng nhập thủ công.",
    errorConnection: "Đã xảy ra lỗi kết nối. Vui lòng thử lại."
  },
  en: {
    titleStep1: "Choose your identity",
    titleStep2: "Account configuration",
    titleStep3: "Personalize your profile",
    descStep1: "Your identity helps us optimize feeds and matches for you.",
    descStep2: "Enter basic credentials to secure your account.",
    descStep3Candidate: "Personalize your interests and profile details.",
    descStep3Business: "Configure store details to set up your services.",
    descStep3Specialist: "Enter key skills to let PawBot match you automatically.",
    personaCandidate: "👤 Individual Customer",
    personaCandidateDesc: "Explore services, book appointments, shop, and experience the ecosystem.",
    personaBusiness: "🏪 Business & Store",
    personaBusinessDesc: "Manage point of sales, spas, local services, and hiring.",
    personaSpecialist: "💼 Expert & Partner",
    personaSpecialistDesc: "Provide expert services, freelancing, and make money.",
    orContinueWith: "Or continue with",
    fullName: "Full Name",
    placeholderName: "John Doe",
    emailAddress: "Email Address",
    placeholderEmail: "name@example.com",
    password: "Password",
    placeholderPassword: "Minimum 6 characters",
    back: "Back",
    continue: "Continue",
    complete: "Complete Registration",
    completing: "Completing registration...",
    hasAccount: "Already have an account?",
    loginNow: "Login now",
    interests: "Interests / Services of interest",
    placeholderInterests: "Spa, grooming, shopping, dining...",
    selfDesc: "Self description",
    placeholderBio: "Brief introduction about yourself...",
    businessCategory: "Business Category",
    businessIntro: "Store Introduction",
    placeholderShop: "Shop name, address, slogan or brief intro...",
    skills: "Specialized Skills",
    placeholderSkills: "Design, Coding, Accounting, Skincare...",
    experience: "Work Experience",
    placeholderExp: "Summary of your professional experience...",
    errorEmptyFields: "Please fill out all required fields.",
    errorShortPassword: "Password must be at least 6 characters.",
    errorRegisterFailed: "Registration failed. Please try again.",
    successMsg: "Registration successful! Redirecting...",
    errorAutoLogin: "Registration succeeded but auto-login failed. Please login manually.",
    errorConnection: "Connection error occurred. Please try again."
  }
};

export default function RegisterForm() {
  const router = useRouter();
  const { theme, lang } = useContext(AuthSettingsContext);
  const t = translations[lang];

  // Wizard steps: 1 (Persona), 2 (Credentials), 3 (Details)
  const [step, setStep] = useState(1);
  
  // Form State
  const [persona, setPersona] = useState<"CANDIDATE" | "SPECIALIST" | "BUSINESS">("CANDIDATE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Dynamic step 3 fields
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("Spa");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleNextStep = () => {
    if (step === 2) {
      if (!name || !email || !password) {
        setError(t.errorEmptyFields);
        return;
      }
      if (password.length < 6) {
        setError(t.errorShortPassword);
        return;
      }
    }
    setError(null);
    setStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep((prev) => prev - 1);
  };

  const handlePersonaSelect = (selected: "CANDIDATE" | "SPECIALIST" | "BUSINESS") => {
    setPersona(selected);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          persona,
          skills: persona !== "BUSINESS" ? skills : undefined,
          bio: persona === "BUSINESS" ? undefined : bio,
          shopName: persona === "BUSINESS" ? shopName : undefined,
          category: persona === "BUSINESS" ? category : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t.errorRegisterFailed);
      } else {
        setSuccess(true);
        const currentEmail = email;
        const currentPassword = password;

        // Reset state
        setName("");
        setEmail("");
        setPassword("");
        setSkills("");
        setBio("");
        setShopName("");

        // Auto-login
        const loginRes = await signIn("credentials", {
          email: currentEmail,
          password: currentPassword,
          redirect: false,
        });

        if (loginRes?.error) {
          setError(t.errorAutoLogin);
        } else {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err) {
      setError(t.errorConnection);
    } finally {
      setLoading(false);
    }
  };

  // Theme-adaptive classes
  const inputBgClass = theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900";
  const labelClass = theme === "dark" ? "text-slate-300" : "text-slate-700";
  const cardBgClass = theme === "dark" ? "bg-slate-900/40 border-slate-800 hover:bg-slate-900/60 hover:border-blue-500/50" : "bg-white border-slate-200 hover:bg-blue-50/30 hover:border-blue-500/50 shadow-sm hover:shadow";
  const cardTitleClass = theme === "dark" ? "text-slate-100" : "text-slate-850";
  const cardDescClass = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const dividerClass = theme === "dark" ? "border-slate-800" : "border-slate-200";
  const textClass = theme === "dark" ? "text-slate-300" : "text-slate-650";
  const btnSecClass = theme === "dark" ? "border-slate-850 bg-slate-900 text-slate-300 hover:bg-slate-850" : "border-slate-200 bg-white text-slate-650 hover:bg-slate-50";

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

      {/* Onboarding Header */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
          {step === 1 && t.titleStep1}
          {step === 2 && t.titleStep2}
          {step === 3 && t.titleStep3}
        </h2>
        <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
          {step === 1 && t.descStep1}
          {step === 2 && t.descStep2}
          {step === 3 && (
            persona === "BUSINESS" 
              ? t.descStep3Business 
              : (persona === "SPECIALIST" ? t.descStep3Specialist : t.descStep3Candidate)
          )}
        </p>
      </div>

      {/* Steps indicator bar */}
      <div className="flex items-center justify-between gap-2 max-w-xs mx-auto lg:mx-0">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-blue-600 animate-pulse" : (theme === "dark" ? "bg-slate-800" : "bg-slate-200")}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-blue-600 animate-pulse" : (theme === "dark" ? "bg-slate-800" : "bg-slate-200")}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-blue-600 animate-pulse" : (theme === "dark" ? "bg-slate-800" : "bg-slate-200")}`} />
      </div>

      {error && (
        <div className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs ${
          theme === "dark" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-650"
        }`}>
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs ${
          theme === "dark" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-650"
        }`}>
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>{t.successMsg}</span>
        </div>
      )}

      {/* STEP 1: PERSONA CHOOSING */}
      {step === 1 && (
        <div className="space-y-3 animate-fadeIn">
          <div
            onClick={() => handlePersonaSelect("CANDIDATE")}
            className={`group p-4 flex items-center gap-4 cursor-pointer rounded-2xl border transition-all duration-300 ${cardBgClass}`}
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
              theme === "dark" ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white" : "bg-blue-50 border border-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            }`}>
              <Smile className="h-5 w-5" />
            </div>
            <div>
              <h4 className={`text-xs font-bold ${cardTitleClass}`}>{t.personaCandidate}</h4>
              <p className={`text-4xs leading-relaxed mt-0.5 ${cardDescClass}`}>{t.personaCandidateDesc}</p>
            </div>
          </div>

          <div
            onClick={() => handlePersonaSelect("BUSINESS")}
            className={`group p-4 flex items-center gap-4 cursor-pointer rounded-2xl border transition-all duration-300 ${cardBgClass}`}
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
              theme === "dark" ? "bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:bg-purple-600 group-hover:text-white" : "bg-purple-50 border border-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white"
            }`}>
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h4 className={`text-xs font-bold ${cardTitleClass}`}>{t.personaBusiness}</h4>
              <p className={`text-4xs leading-relaxed mt-0.5 ${cardDescClass}`}>{t.personaBusinessDesc}</p>
            </div>
          </div>

          <div
            onClick={() => handlePersonaSelect("SPECIALIST")}
            className={`group p-4 flex items-center gap-4 cursor-pointer rounded-2xl border transition-all duration-300 ${cardBgClass}`}
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
              theme === "dark" ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white" : "bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
            }`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h4 className={`text-xs font-bold ${cardTitleClass}`}>{t.personaSpecialist}</h4>
              <p className={`text-4xs leading-relaxed mt-0.5 ${cardDescClass}`}>{t.personaSpecialistDesc}</p>
            </div>
          </div>

          {/* Social Logins */}
          <div className="relative my-6 pt-3">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className={`w-full border-t ${dividerClass}`} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className={`px-2 font-semibold text-[10px] ${
                theme === "dark" ? "bg-slate-950 text-slate-500" : "bg-gray-50 text-slate-500"
              }`}>{t.orContinueWith}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => signIn("google")}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850 hover:border-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.37 3.68 1.48 7.58l3.96 3.07C6.38 7.56 8.97 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.92c2.2-2.03 3.67-5.01 3.67-8.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.44 14.65c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.48 7.01C.53 8.91 0 11.01 0 13.2s.53 4.29 1.48 6.19l3.96-3.07c-.24-.71-.38-1.48-.38-2.28z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.92c-1.1.74-2.52 1.18-4.2 1.18-3.03 0-5.62-2.52-6.56-5.61l-3.96 3.07C3.37 19.52 7.35 23 12 23z"
                />
              </svg>
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={() => signIn("facebook")}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850 hover:border-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <svg className={`h-4 w-4 ${theme === "dark" ? "fill-blue-400" : "fill-blue-600"}`} viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: BASIC CREDENTIALS */}
      {step === 2 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <label className={`block text-xs font-bold ${labelClass}`}>{t.fullName}</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.placeholderName}
                className={`w-full rounded-xl h-12 pl-10 pr-4 text-xs placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${inputBgClass}`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold ${labelClass}`}>{t.emailAddress}</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.placeholderEmail}
                className={`w-full rounded-xl h-12 pl-10 pr-4 text-xs placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${inputBgClass}`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold ${labelClass}`}>{t.password}</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.placeholderPassword}
                className={`w-full rounded-xl h-12 pl-10 pr-4 text-xs placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${inputBgClass}`}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrevStep}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-4 text-xs font-semibold transition-all duration-200 cursor-pointer ${btnSecClass}`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </button>
            
            <button
              onClick={handleNextStep}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 h-12 text-xs font-bold text-white shadow-lg shadow-blue-600/15 hover:from-blue-500 hover:to-indigo-555 transition-all duration-200 cursor-pointer"
            >
              <span>{t.continue}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DYNAMIC PROFILE ONBOARDING */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
          
          {/* Dynamic Onboarding inputs conditional on Step 1 Persona Selection */}
          {persona === "CANDIDATE" && (
            <>
              {/* Individual / Customer specific onboarding */}
              <div>
                <label className={`block text-xs font-bold ${labelClass}`}>{t.interests}</label>
                <div className="relative mt-1">
                  <Smile className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder={t.placeholderInterests}
                    className={`w-full rounded-xl h-12 pl-9 pr-4 text-xs placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputBgClass}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold ${labelClass}`}>{t.selfDesc}</label>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t.placeholderBio}
                  rows={3}
                  className={`w-full mt-1 rounded-xl px-3 py-2.5 text-xs placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputBgClass}`}
                />
              </div>
            </>
          )}

          {persona === "SPECIALIST" && (
            <>
              {/* Specialist / Expert specific onboarding */}
              <div>
                <label className={`block text-xs font-bold ${labelClass}`}>{t.skills}</label>
                <div className="relative mt-1">
                  <Laptop className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder={t.placeholderSkills}
                    className={`w-full rounded-xl h-12 pl-9 pr-4 text-xs placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputBgClass}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold ${labelClass}`}>{t.experience}</label>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t.placeholderExp}
                  rows={3}
                  className={`w-full mt-1 rounded-xl px-3 py-2.5 text-xs placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputBgClass}`}
                />
              </div>
            </>
          )}

          {persona === "BUSINESS" && (
            <>
              {/* Business Owner / Shop specific onboarding */}
              <div>
                <label className={`block text-xs font-bold ${labelClass}`}>{t.businessCategory}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full mt-1 rounded-xl px-3 py-3 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputBgClass}`}
                >
                  <option value="Spa" className={theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>Spa & Làm đẹp</option>
                  <option value="Điện lạnh" className={theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>Điện lạnh & Điện tử</option>
                  <option value="Xây dựng" className={theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>Xây dựng & Sửa nhà</option>
                  <option value="Sửa chữa" className={theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>Sửa xe & Cứu hộ</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-bold ${labelClass}`}>{t.businessIntro}</label>
                <textarea
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t.placeholderShop}
                  rows={3}
                  className={`w-full mt-1 rounded-xl px-3 py-2.5 text-xs placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputBgClass}`}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-4 text-xs font-semibold transition-all duration-200 cursor-pointer ${btnSecClass}`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </button>
            
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 h-12 text-xs font-bold text-white shadow-lg shadow-blue-600/15 hover:from-blue-500 hover:to-indigo-555 disabled:opacity-50 transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.completing}</span>
                </>
              ) : (
                <span>{t.complete}</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Login Navigation footer */}
      <div className={`text-center text-xs border-t pt-4 ${dividerClass} ${textClass}`}>
        {t.hasAccount}{" "}
        <Link
          href="/auth/login"
          className="font-bold text-blue-650 hover:text-blue-500 hover:underline transition-colors"
        >
          {t.loginNow}
        </Link>
      </div>
    </div>
  );
}
