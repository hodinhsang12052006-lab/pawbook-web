"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import { ArrowLeft, ArrowRight, Loader2, Save, Flame, ImagePlus, X, Play, MapPin, DollarSign, Images, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { stateName } from "@/lib/stateNames";
import { playSound } from "@/lib/sounds";
import Flag from "@/components/ui/Flag";
import { useTr } from "@/lib/i18n/useTr";
import { guessState } from "@/lib/cityState";
import { uploadMedia, MAX_VIDEO_MB } from "@/lib/mediaUpload";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];
// Giá trị lưu xuống DB giữ nguyên tiếng Việt (bộ lọc/tín hiệu dựa vào đó); chỉ nhãn hiển thị đổi theo ngôn ngữ.
const SKILL_OPTIONS: [string, string][] = [["Bột/Acrylic", "Acrylic"], ["Dip/SNS", "Dip/SNS"], ["Gel-X", "Gel-X"], ["Design", "Nail art"], ["Chân tay nước", "Mani-pedi"], ["Wax", "Wax"], ["Mi/Lông mày", "Lashes/Brows"]];
const BENEFIT_OPTIONS: [string, string][] = [["Có chỗ ở", "Housing provided"], ["Bao lương", "Guaranteed pay"], ["Hỗ trợ đổi bang", "Relocation help"], ["Hỗ trợ Visa 482/EB3", "Visa 482/EB3 support"], ["Tip cao", "High tips"], ["Xe đưa đón", "Transport provided"]];
const SALARY_TYPES_US: [string, string][] = [["Bao lương tuần", "Weekly guaranteed"], ["% Ăn chia", "Commission split"]];
const SALARY_TYPES_AU: [string, string][] = [["Theo giờ AUD", "Hourly AUD"], ["Theo tuần AUD", "Weekly AUD"]];
const MAX_MEDIA = 8;

interface MediaItem { key: string; url?: string; preview: string; isVideo: boolean; progress: number; error?: string }

export default function CreateJobPage() {
  const router = useRouter();
  const { tr } = useTr();
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("");
  const [salonName, setSalonName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [salaryType, setSalaryType] = useState(SALARY_TYPES_US[0][0]);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(true);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const session = res.ok ? await res.json() : null;
        if (!session?.user) {
          toast.error(tr("Vui lòng đăng nhập bằng tài khoản Chủ tiệm.", "Please sign in with a salon owner account."));
          router.push("/auth/login");
          return;
        }
        if (session.user.role !== "OWNER") {
          toast.error(tr("Chỉ tài khoản Chủ tiệm mới đăng được tin tuyển thợ.", "Only salon owner accounts can post jobs."));
          router.push("/");
          return;
        }
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const states = market === "US" ? US_STATES : AU_STATES;
  const salaryTypes = market === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU;
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const uploading = media.some((m) => !m.url && !m.error);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_MEDIA - media.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) toast(tr(`Tối đa ${MAX_MEDIA} ảnh/video.`, `Up to ${MAX_MEDIA} photos/videos.`));
    const items: MediaItem[] = picked.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, preview: URL.createObjectURL(f), isVideo: f.type.startsWith("video/"), progress: 0 }));
    setMedia((prev) => [...prev, ...items]);
    await Promise.all(
      picked.map(async (file, i) => {
        const key = items[i].key;
        try {
          const url = await uploadMedia(file, (p) => setMedia((prev) => prev.map((m) => (m.key === key ? { ...m, progress: p } : m))));
          setMedia((prev) => prev.map((m) => (m.key === key ? { ...m, url, progress: 100 } : m)));
        } catch (err) {
          setMedia((prev) => prev.map((m) => (m.key === key ? { ...m, error: err instanceof Error ? err.message : tr("Tải thất bại", "Upload failed") } : m)));
        }
      })
    );
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeMedia = (key: string) => setMedia((prev) => prev.filter((m) => m.key !== key));

  const handleSubmit = async () => {
    if (submitting || uploading) return;
    setSubmitting(true);
    const toastId = toast.loading(tr("Đang đăng tin tuyển thợ...", "Posting your job..."));
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, salonName, description, market, state, city, salaryType, salaryAmount, skills, benefits, phone, isUrgent,
          mediaUrls: media.filter((m) => m.url).map((m) => m.url),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(tr("Đăng tin tuyển thợ thành công! 💅", "Job posted! 💅"), { id: toastId });
        playSound("success");
        router.push(`/jobs/${data.id}`);
      } else {
        toast.error(data.error || tr("Không thể đăng tin.", "Couldn't post the job."), { id: toastId });
      }
    } catch {
      toast.error(tr("Lỗi mạng khi đăng bài.", "Network error while posting."), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-12"><Loader2 className="h-8 w-8 animate-spin text-pink-500" /></main>
      </div>
    );
  }

  const STEPS = [
    { n: 1, icon: MapPin, label: tr("Khu vực", "Location") },
    { n: 2, icon: DollarSign, label: tr("Chi tiết", "Details") },
    { n: 3, icon: Images, label: tr("Ảnh & video", "Photos") },
    { n: 4, icon: Sparkles, label: tr("Kỹ năng", "Skills") },
  ];
  const chip = (on: boolean, tone: "pink" | "emerald" = "pink") =>
    `rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition-all active:scale-95 ${on ? (tone === "pink" ? "bg-pink-500/15 text-pink-200 ring-pink-500/60" : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/60") : "text-slate-400 ring-white/10 hover:ring-white/25"}`;
  const next = "flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 py-3 font-bold text-white shadow-lg shadow-pink-600/20 transition-all hover:brightness-110 disabled:opacity-40";
  const back = "rounded-xl px-4 py-3 font-bold text-slate-300 ring-1 ring-white/10 hover:bg-white/5";

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 pb-28 md:pb-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> {tr("Quay lại Trang chủ", "Back to home")}
        </Link>

        <div className="glass-card space-y-6 rounded-2xl p-5 sm:p-6">
          <div>
            <h1 className="text-lg font-black text-white">📢 {tr("Đăng tin tuyển thợ", "Post a job")}</h1>
            <p className="mt-1 text-xs text-slate-400">{tr("Chỉ mất chưa đến 2 phút. Tin có ảnh tiệm được thợ bấm xem nhiều hơn.", "Takes under 2 minutes. Jobs with salon photos get more views.")}</p>
          </div>

          {/* Thanh bước */}
          <ol className="grid grid-cols-4 gap-1.5" aria-label={tr("Các bước", "Steps")}>
            {STEPS.map((s) => (
              <li key={s.n} aria-current={step === s.n ? "step" : undefined} className="space-y-1.5">
                <span className={`block h-1.5 rounded-full ${step >= s.n ? "bg-gradient-to-r from-pink-500 to-fuchsia-500" : "bg-white/10"}`} />
                <span className={`flex items-center gap-1 text-[11px] font-bold ${step === s.n ? "text-white" : "text-slate-500"}`}><s.icon className="h-3.5 w-3.5" /> <span className="truncate">{s.label}</span></span>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {(["US", "AU"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMarket(m); setState((m === "US" ? US_STATES : AU_STATES)[0]); setSalaryType((m === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU)[0][0]); }}
                    aria-pressed={market === m}
                    className={`rounded-xl py-3 font-bold ring-2 transition-all ${market === m ? "bg-pink-500/10 text-white ring-pink-500" : "text-slate-400 ring-white/10"}`}
                  >
                    <span className="inline-flex items-center gap-1.5"><Flag code={m} /> {m === "US" ? tr("Mỹ (US)", "United States") : tr("Úc (AU)", "Australia")}</span>
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="job-state" className="field-label">{tr("Bang / Tiểu bang *", "State *")}</label>
                <select id="job-state" value={state} onChange={(e) => setState(e.target.value)} className="input-field">
                  {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="job-city" className="field-label">{tr("Thành phố *", "City *")}</label>
                <input id="job-city" value={city} onChange={(e) => { setCity(e.target.value); const g = guessState(market, e.target.value); if (g && (states as readonly string[]).includes(g)) setState(g); }} placeholder={tr("VD: Los Angeles", "e.g. Los Angeles")} className="input-field" />
              </div>
              <div>
                <label htmlFor="job-salon" className="field-label">{tr("Tên tiệm *", "Salon name *")}</label>
                <input id="job-salon" value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder={tr("VD: Happy Nails & Spa", "e.g. Happy Nails & Spa")} className="input-field" />
              </div>
              <button type="button" disabled={!city.trim() || !salonName.trim()} onClick={() => setStep(2)} className={next}>
                {tr("Tiếp tục", "Continue")} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 text-sm">
              <div>
                <label htmlFor="job-title" className="field-label">{tr("Tiêu đề tin tuyển dụng *", "Job title *")}</label>
                <input id="job-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("VD: Cần thợ Bột/Dip gấp", "e.g. Urgently hiring acrylic/dip tech")} className="input-field" />
              </div>
              <div>
                <span className="field-label">{tr("Hình thức trả lương *", "Pay type *")}</span>
                <div className="grid grid-cols-2 gap-2">
                  {salaryTypes.map(([v, en]) => (
                    <button key={v} type="button" onClick={() => setSalaryType(v)} aria-pressed={salaryType === v} className={`rounded-xl py-2.5 text-xs font-bold ring-2 transition-all ${salaryType === v ? "bg-pink-500/10 text-white ring-pink-500" : "text-slate-400 ring-white/10"}`}>
                      {tr(v, en)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="job-pay" className="field-label">{tr("Mức lương *", "Pay *")}</label>
                  <input id="job-pay" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder={market === "US" ? tr("VD: $1,200-1,500/tuần", "e.g. $1,200-1,500/week") : tr("VD: $28-32/giờ", "e.g. $28-32/hour")} className="input-field" />
                </div>
                <div>
                  <label htmlFor="job-phone" className="field-label">{tr("Số điện thoại liên hệ *", "Contact phone *")}</label>
                  <input id="job-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="input-field" />
                </div>
              </div>
              <div>
                <label htmlFor="job-desc" className="field-label">{tr("Mô tả thêm (không bắt buộc)", "Description (optional)")}</label>
                <textarea id="job-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr("Yêu cầu kinh nghiệm, môi trường làm việc, loại khách…", "Experience needed, work environment, clientele…")} className="input-field resize-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} aria-label={tr("Quay lại", "Back")} className={back}><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" disabled={!title.trim() || !salaryAmount.trim() || !phone.trim()} onClick={() => setStep(3)} className={next}>{tr("Tiếp tục", "Continue")} <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-bold text-slate-200">{tr("Ảnh & video tiệm (không bắt buộc)", "Salon photos & videos (optional)")}</p>
                <p className="mt-0.5 text-xs text-slate-500">{tr(`Không gian tiệm, ghế làm, mẫu móng của tiệm… Tối đa ${MAX_MEDIA} file, video ≤ ${MAX_VIDEO_MB}MB.`, `Salon space, stations, your nail work… Up to ${MAX_MEDIA} files, videos ≤ ${MAX_VIDEO_MB}MB.`)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((m) => (
                  <div key={m.key} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/10">
                    {m.isVideo ? (
                      <>
                        <video src={m.preview} muted playsInline className="h-full w-full object-cover" />
                        <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60"><Play className="h-3 w-3 fill-white text-white" /></span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.preview} alt="" className="h-full w-full object-cover" />
                    )}
                    {!m.url && !m.error && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs font-bold text-white">
                        <Loader2 className="h-5 w-5 animate-spin" /> {m.progress}%
                      </div>
                    )}
                    {m.error && <div className="absolute inset-0 flex items-center justify-center bg-red-950/80 p-2 text-center text-[10px] font-semibold text-red-200">{m.error}</div>}
                    <button type="button" onClick={() => removeMedia(m.key)} aria-label={tr("Xoá file này", "Remove file")} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {media.length < MAX_MEDIA && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-slate-400 transition-colors hover:border-pink-500/60 hover:bg-pink-500/[0.04] hover:text-pink-300">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[11px] font-bold">{tr("Thêm ảnh/video", "Add photo/video")}</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} aria-label={tr("Quay lại", "Back")} className={back}><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" disabled={uploading} onClick={() => setStep(4)} className={next}>
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> {tr("Đang tải lên…", "Uploading…")}</> : <>{media.length ? tr("Tiếp tục", "Continue") : tr("Bỏ qua", "Skip")} <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 text-sm">
              <div>
                <span className="field-label">{tr("Kỹ năng cần tuyển", "Skills needed")}</span>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map(([v, en]) => <button key={v} type="button" aria-pressed={skills.includes(v)} onClick={() => toggle(skills, setSkills, v)} className={chip(skills.includes(v))}>{tr(v, en)}</button>)}
                </div>
              </div>
              <div>
                <span className="field-label">{tr("Quyền lợi", "Benefits")}</span>
                <div className="flex flex-wrap gap-2">
                  {BENEFIT_OPTIONS.map(([v, en]) => <button key={v} type="button" aria-pressed={benefits.includes(v)} onClick={() => toggle(benefits, setBenefits, v)} className={chip(benefits.includes(v), "emerald")}>{tr(v, en)}</button>)}
                </div>
              </div>
              <button type="button" role="switch" aria-checked={isUrgent} onClick={() => setIsUrgent(!isUrgent)} className={`flex w-full items-center gap-3 rounded-xl p-4 ring-2 transition-all ${isUrgent ? "bg-red-500/10 ring-red-500" : "bg-slate-950 ring-white/10"}`}>
                <Flame className={`h-5 w-5 ${isUrgent ? "text-red-400" : "text-slate-500"}`} />
                <span className={`text-left font-bold ${isUrgent ? "text-red-200" : "text-slate-400"}`}>{tr('Đánh dấu "Cần gấp" — ưu tiên hiển thị & báo ngay cho thợ cùng bang', 'Mark as "Urgent" — shown first & techs in your state are notified')}</span>
              </button>
              {media.filter((m) => m.url).length > 0 && (
                <p className="flex items-center gap-2 text-xs text-slate-400"><Images className="h-4 w-4 text-pink-300" /> {tr(`Kèm ${media.filter((m) => m.url).length} ảnh/video tiệm`, `${media.filter((m) => m.url).length} salon photo(s)/video(s) attached`)}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setStep(3)} aria-label={tr("Quay lại", "Back")} className={back}><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" disabled={submitting || uploading} onClick={handleSubmit} className={next}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> {tr("Đăng tin ngay", "Publish job")}</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


