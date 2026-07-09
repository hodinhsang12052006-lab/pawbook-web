"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { User, Briefcase, Lock, Mail, Loader2, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, Store, Laptop, Smile } from "lucide-react";

export default function RegisterForm() {
  const router = useRouter();
  
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
        setError("Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.");
        return;
      }
      if (password.length < 6) {
        setError("Mật khẩu phải tối thiểu 6 ký tự.");
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
    setStep(2); // Auto-advance to Step 2 upon selecting profile persona
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
          bio: persona !== "BUSINESS" ? bio : undefined,
          shopName: persona === "BUSINESS" ? shopName : undefined,
          category: persona === "BUSINESS" ? category : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Đăng ký thất bại. Vui lòng thử lại.");
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
          setError("Đăng ký thành công nhưng không thể tự động đăng nhập. Vui lòng đăng nhập thủ công.");
        } else {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err) {
      setError("Đã xảy ra lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Mobile-only Branding */}
      <div className="block lg:hidden text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-xl border border-blue-500/20 bg-blue-50 p-0.5 shadow-lg shadow-blue-500/10">
            <img
              src="/cho1.jpg"
              alt="PawBook Logo"
              className="h-full w-full object-cover rounded-lg"
            />
          </div>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-2xl font-black tracking-widest text-transparent uppercase select-none">
            PawBook
          </span>
        </Link>
      </div>

      {/* Onboarding Header */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {step === 1 && "Chọn định danh của bạn"}
          {step === 2 && "Thiết lập thông tin tài khoản"}
          {step === 3 && "Cá nhân hóa hồ sơ của bạn"}
        </h2>
        <p className="text-sm text-slate-500">
          {step === 1 && "Nhóm định danh giúp chúng tôi tối ưu bảng tin & công việc phù hợp với bạn."}
          {step === 2 && "Nhập thông tin đăng nhập cơ bản để khởi tạo tài khoản bảo mật."}
          {step === 3 && (persona === "BUSINESS" ? "Thiết lập thông tin tiệm để tự động tạo gian hàng dịch vụ." : "Nhập kỹ năng nổi bật để bot AI PawBot tự động tìm job phù hợp.")}
        </p>
      </div>

      {/* Steps indicator bar */}
      <div className="flex items-center justify-between gap-2 max-w-xs mx-auto lg:mx-0">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-blue-600 animate-pulse" : "bg-slate-200"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-blue-600 animate-pulse" : "bg-slate-200"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-blue-600 animate-pulse" : "bg-slate-200"}`} />
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-650">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-650">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>Đăng ký thành công! Đang chuyển hướng sang đăng nhập...</span>
        </div>
      )}

      {/* STEP 1: PERSONA CHOOSING */}
      {step === 1 && (
        <div className="space-y-3 animate-fadeIn">
          <div
            onClick={() => handlePersonaSelect("CANDIDATE")}
            className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 cursor-pointer hover:border-blue-500/50 hover:bg-blue-50/30 shadow-sm hover:shadow transition-all duration-300"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Smile className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">👤 Khách hàng Cá nhân</h4>
              <p className="text-4xs text-slate-500 leading-relaxed mt-0.5">Khám phá dịch vụ, đặt lịch, mua sắm và trải nghiệm hệ sinh thái.</p>
            </div>
          </div>

          <div
            onClick={() => handlePersonaSelect("BUSINESS")}
            className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 cursor-pointer hover:border-blue-500/50 hover:bg-blue-50/30 shadow-sm hover:shadow transition-all duration-300"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">🏪 Doanh nghiệp & Cửa hàng</h4>
              <p className="text-4xs text-slate-500 leading-relaxed mt-0.5">Quản lý điểm bán, spa, dịch vụ địa phương và tuyển dụng.</p>
            </div>
          </div>

          <div
            onClick={() => handlePersonaSelect("SPECIALIST")}
            className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 cursor-pointer hover:border-blue-500/50 hover:bg-blue-50/30 shadow-sm hover:shadow transition-all duration-300"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">💼 Chuyên gia & Đối tác</h4>
              <p className="text-4xs text-slate-500 leading-relaxed mt-0.5">Cung cấp dịch vụ chuyên môn, nhận việc tự do và kiếm tiền.</p>
            </div>
          </div>

          {/* Social Logins */}
          <div className="relative my-6 pt-3">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-50 px-2 text-slate-500 font-semibold text-[10px]">Hoặc tiếp tục với</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4 fill-blue-650" viewBox="0 0 24 24">
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
            <label className="block text-xs font-bold text-slate-700">Họ và Tên</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full bg-white border border-slate-200 rounded-xl h-12 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Địa chỉ Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-white border border-slate-200 rounded-xl h-12 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Mật khẩu</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                minLength={6}
                className="w-full bg-white border border-slate-200 rounded-xl h-12 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrevStep}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-650 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại</span>
            </button>
            
            <button
              onClick={handleNextStep}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 h-12 text-xs font-bold text-white shadow-lg shadow-blue-600/15 hover:from-blue-500 hover:to-indigo-550 transition-all duration-200 cursor-pointer"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DYNAMIC PROFILE ONBOARDING */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
          {/* Candidates & Specialists profile onboarding */}
          {persona !== "BUSINESS" ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700">Kỹ năng / Lĩnh vực (Phân tách bằng dấu phẩy)</label>
                <div className="relative mt-1">
                  <Laptop className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="Next.js, Python, Kế toán thuế, SEO..."
                    className="w-full bg-white border border-slate-200 rounded-xl h-12 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Tóm tắt ngắn kinh nghiệm (Bio)</label>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tôi có 3 năm kinh nghiệm trong thiết kế phần mềm / làm MMO kiếm tiền ngách..."
                  rows={3}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </>
          ) : (
            <>
              {/* Business Owner profile onboarding */}
              <div>
                <label className="block text-xs font-bold text-slate-700">Tên Cửa Hàng / Spa / Tiệm của bạn</label>
                <div className="relative mt-1">
                  <Store className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="An Nhiên Spa, Điện Lạnh Bách Khoa..."
                    className="w-full bg-white border border-slate-200 rounded-xl h-12 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Ngành nghề kinh doanh</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Spa">Spa & Làm đẹp</option>
                  <option value="Điện lạnh">Điện lạnh & Điện tử</option>
                  <option value="Xây dựng">Xây dựng & Sửa nhà</option>
                  <option value="Sửa chữa">Sửa xe & Cứu hộ</option>
                </select>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-650 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại</span>
            </button>
            
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 h-12 text-xs font-bold text-white shadow-lg shadow-blue-600/15 hover:from-blue-500 hover:to-indigo-550 disabled:opacity-50 transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang hoàn tất đăng ký...</span>
                </>
              ) : (
                <span>Hoàn tất đăng ký</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Login Navigation footer */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-200 pt-4">
        Đã có tài khoản?{" "}
        <Link
          href="/auth/login"
          className="font-bold text-blue-600 hover:text-blue-500 hover:underline transition-colors"
        >
          Đăng nhập ngay
        </Link>
      </div>
    </div>
  );
}
