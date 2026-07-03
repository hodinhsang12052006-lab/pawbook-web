"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { User, Briefcase, Lock, Mail, Loader2, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, Store, Laptop } from "lucide-react";

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
      {/* Onboarding Header */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {step === 1 && "Chọn định danh của bạn"}
          {step === 2 && "Thiết lập thông tin tài khoản"}
          {step === 3 && "Cá nhân hóa hồ sơ của bạn"}
        </h2>
        <p className="text-sm text-slate-400">
          {step === 1 && "Nhóm định danh giúp chúng tôi tối ưu bảng tin & công việc phù hợp với bạn."}
          {step === 2 && "Nhập thông tin đăng nhập cơ bản để khởi tạo tài khoản bảo mật."}
          {step === 3 && (persona === "BUSINESS" ? "Thiết lập thông tin tiệm để tự động tạo gian hàng dịch vụ." : "Nhập kỹ năng nổi bật để bot AI PawBot tự động tìm job phù hợp.")}
        </p>
      </div>

      {/* Steps indicator bar */}
      <div className="flex items-center justify-between gap-2 max-w-xs mx-auto lg:mx-0">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-blue-600 animate-pulse" : "bg-slate-800"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-blue-600 animate-pulse" : "bg-slate-800"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-blue-600 animate-pulse" : "bg-slate-800"}`} />
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-400">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span>Đăng ký thành công! Đang chuyển hướng sang đăng nhập...</span>
        </div>
      )}

      {/* STEP 1: PERSONA CHOOSING */}
      {step === 1 && (
        <div className="space-y-3 animate-fadeIn">
          <div
            onClick={() => handlePersonaSelect("CANDIDATE")}
            className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-500/40 hover:bg-slate-900/50 transition-all duration-300"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">👩💻 Dân Tech / MMO Freelancer</h4>
              <p className="text-4xs text-slate-500 leading-relaxed mt-0.5">Tìm việc freelance, chia sẻ tool automation và kiếm coin.</p>
            </div>
          </div>

          <div
            onClick={() => handlePersonaSelect("SPECIALIST")}
            className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-500/40 hover:bg-slate-900/50 transition-all duration-300"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">💼 Chuyên gia (Kế toán / HR / Thuế)</h4>
              <p className="text-4xs text-slate-500 leading-relaxed mt-0.5">Cung cấp dịch vụ chuyên môn doanh nghiệp và nhận dự án.</p>
            </div>
          </div>

          <div
            onClick={() => handlePersonaSelect("BUSINESS")}
            className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-500/40 hover:bg-slate-900/50 transition-all duration-300"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">🏢 Chủ Cửa Hàng / Spa / Tiệm Địa Phương</h4>
              <p className="text-4xs text-slate-500 leading-relaxed mt-0.5">Tuyển thợ massage/kỹ thuật viên, quảng bá tiệm địa phương.</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: BASIC CREDENTIALS */}
      {step === 2 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <label className="block text-xs font-semibold text-slate-355">Họ và Tên</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-355">Địa chỉ Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-355">Mật khẩu</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                minLength={6}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrevStep}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại</span>
            </button>
            
            <button
              onClick={handleNextStep}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition-all duration-200"
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
                <label className="block text-xs font-semibold text-slate-355">Kỹ năng / Lĩnh vực (Phân tách bằng dấu phẩy)</label>
                <div className="relative mt-1">
                  <Laptop className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="text"
                    required
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="Next.js, Python, Kế toán thuế, SEO..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-355">Tóm tắt ngắn kinh nghiệm (Bio)</label>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tôi có 3 năm kinh nghiệm trong thiết kế phần mềm / làm MMO kiếm tiền ngách..."
                  rows={3}
                  className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              {/* Business Owner profile onboarding */}
              <div>
                <label className="block text-xs font-semibold text-slate-355">Tên Cửa Hàng / Spa / Tiệm của bạn</label>
                <div className="relative mt-1">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="An Nhiên Spa, Điện Lạnh Bách Khoa..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-355">Ngành nghề kinh doanh</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
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
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại</span>
            </button>
            
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all duration-200"
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
      <div className="text-center text-xs text-slate-400 border-t border-slate-900 pt-4">
        Đã có tài khoản?{" "}
        <Link
          href="/auth/login"
          className="font-bold text-blue-400 hover:text-blue-350 hover:underline transition-colors"
        >
          Đăng nhập ngay
        </Link>
      </div>
    </div>
  );
}
