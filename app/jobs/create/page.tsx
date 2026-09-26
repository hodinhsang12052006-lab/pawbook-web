"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { ArrowLeft, ArrowRight, Loader2, Save, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { stateName } from "@/lib/stateNames";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];
const SKILL_OPTIONS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];
const BENEFIT_OPTIONS = ["Có chỗ ở", "Bao lương", "Hỗ trợ đổi bang", "Hỗ trợ Visa 482/EB3", "Tip cao", "Xe đưa đón"];
const SALARY_TYPES_US = ["Bao lương tuần", "% Ăn chia"];
const SALARY_TYPES_AU = ["Theo giờ AUD", "Theo tuần AUD"];

export default function CreateJobPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("");

  const [salonName, setSalonName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [salaryType, setSalaryType] = useState(SALARY_TYPES_US[0]);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [description, setDescription] = useState("");

  const [skills, setSkills] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const session = res.ok ? await res.json() : null;
        if (!session?.user) {
          toast.error("Vui lòng đăng nhập trước khi đăng tin.");
          router.push("/auth/login");
          return;
        }
        if ((session.user as any).role !== "OWNER") {
          toast.error("Chỉ tài khoản Chủ tiệm mới đăng được tin tuyển thợ.");
          router.push("/");
          return;
        }
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [router]);

  const states = market === "US" ? US_STATES : AU_STATES;
  const salaryTypes = market === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU;

  const toggleSkill = (s: string) => setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const toggleBenefit = (b: string) => setBenefits((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const toastId = toast.loading("Đang đăng tin tuyển thợ...");

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, salonName, description, market, state, city,
          salaryType, salaryAmount, skills, benefits, phone, isUrgent,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Đăng tin tuyển thợ thành công! 💅", { id: toastId });
        router.push("/?tab=jobs");
      } else {
        toast.error(data.error || "Không thể đăng tin.", { id: toastId });
      }
    } catch {
      toast.error("Lỗi mạng khi đăng bài.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-8 pb-24 md:pb-8">
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" /> Quay lại Trang chủ
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-6">
          <div>
            <h1 className="text-lg font-bold text-white">📢 Đăng Tin Tuyển Thợ — Bước {step}/3</h1>
            <p className="text-xs text-slate-400 mt-1">Chỉ mất chưa đến 2 phút để tin của bạn lên top.</p>
          </div>

          {/* STEP 1: Location */}
          {step === 1 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setMarket("US"); setState(US_STATES[0]); setSalaryType(SALARY_TYPES_US[0]); }}
                  className={`rounded-xl py-3 font-bold border-2 transition-all ${market === "US" ? "border-pink-500 bg-pink-500/10 text-white" : "border-slate-800 text-slate-400"}`}
                >
                  🇺🇸 Mỹ (US)
                </button>
                <button
                  type="button"
                  onClick={() => { setMarket("AU"); setState(AU_STATES[0]); setSalaryType(SALARY_TYPES_AU[0]); }}
                  className={`rounded-xl py-3 font-bold border-2 transition-all ${market === "AU" ? "border-pink-500 bg-pink-500/10 text-white" : "border-slate-800 text-slate-400"}`}
                >
                  🇦🇺 Úc (AU)
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Bang / Tiểu bang *</label>
                <select value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200">
                  {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Thành phố *</label>
                <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="VD: Los Angeles" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-600" />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Tên tiệm *</label>
                <input required value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder="VD: Happy Nails & Spa" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-600" />
              </div>

              <button
                type="button"
                disabled={!city.trim() || !salonName.trim()}
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 py-3 font-bold text-white disabled:opacity-40 transition-all"
              >
                Tiếp tục <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Salary */}
          {step === 2 && (
            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Tiêu đề tin tuyển dụng *</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Cần thợ Bột/Dip gấp" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-600" />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Hình thức trả lương *</label>
                <div className="grid grid-cols-2 gap-2">
                  {salaryTypes.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSalaryType(st)}
                      className={`rounded-xl py-2.5 text-xs font-bold border-2 transition-all ${salaryType === st ? "border-pink-500 bg-pink-500/10 text-white" : "border-slate-800 text-slate-400"}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Mức lương *</label>
                <input required value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder={market === "US" ? "VD: $1,200-1,500/tuần" : "VD: $28-32/giờ"} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-600" />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Số điện thoại liên hệ *</label>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-600" />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Mô tả thêm (không bắt buộc)</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Yêu cầu kinh nghiệm, môi trường làm việc..." className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-600" />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-800 px-4 py-3 font-bold text-slate-300">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!title.trim() || !salaryAmount.trim() || !phone.trim()}
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 py-3 font-bold text-white disabled:opacity-40 transition-all"
                >
                  Tiếp tục <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Skills / benefits */}
          {step === 3 && (
            <div className="space-y-5 text-sm">
              <div>
                <label className="block font-bold text-slate-300 mb-2">Kỹ năng cần tuyển (tick chọn)</label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className={`rounded-full px-3.5 py-2 text-xs font-bold border-2 transition-all ${skills.includes(s) ? "border-pink-500 bg-pink-500/15 text-pink-300" : "border-slate-800 text-slate-400"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-2">Quyền lợi (tick chọn)</label>
                <div className="flex flex-wrap gap-2">
                  {BENEFIT_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBenefit(b)}
                      className={`rounded-full px-3.5 py-2 text-xs font-bold border-2 transition-all ${benefits.includes(b) ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-slate-800 text-slate-400"}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${isUrgent ? "border-red-500 bg-red-500/10" : "border-slate-800 bg-slate-950"}`}
              >
                <Flame className={`h-5 w-5 ${isUrgent ? "text-red-400" : "text-slate-500"}`} />
                <span className={`font-bold ${isUrgent ? "text-red-300" : "text-slate-400"}`}>Đánh dấu tin "Cần Gấp" (ưu tiên hiển thị đầu)</span>
              </button>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-800 px-4 py-3 font-bold text-slate-300">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 py-3 font-bold text-white disabled:opacity-50 transition-all"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Đăng tin ngay</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
