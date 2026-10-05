"use client";

import React, { useEffect, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { Loader2, Save, Upload, X, Trash2, Flame, CheckCircle2, AlertTriangle, Wallet, ArrowRight, Radar, Camera, Eye, Store, Sparkles, UserRound, Briefcase, Plus, ShieldAlert, LogOut, Home as HomeIcon, Volume2, BellRing } from "lucide-react";
import SoundSettings from "@/components/settings/SoundSettings";
import Avatar from "@/components/ui/Avatar";
import { avatarGradient, isPlaceholderAvatar } from "@/lib/avatar";
import { getProfileCompleteness } from "@/lib/profileCompleteness";
import ProfileCompletenessCard from "@/components/profile/ProfileCompletenessCard";
import ProfileViewsCard from "@/components/profile/ProfileViewsCard";
import ShareCardButton from "@/components/profile/ShareCard";
import { JobAlertsManager } from "@/components/jobs/JobAlerts";
import PhoneVerify from "@/components/profile/PhoneVerify";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { useTr } from "@/lib/i18n/useTr";

const DELETE_CONFIRM_PHRASE = "XÓA TÀI KHOẢN";

// Khung 1 nhóm trường trong form — tiêu đề có icon + mô tả ngắn, thống nhất mọi mục.
function FormSection({ icon: Icon, title, hint, action, children }: { icon: typeof Store; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
            <Icon className="h-4 w-4 text-pink-300" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const SKILL_OPTIONS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];

export default function ProfilePage() {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState(""); // số đang lưu trên máy chủ (để biết người dùng vừa sửa mà chưa lưu)
  const [phoneCheckKey, setPhoneCheckKey] = useState(0);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [bio, setBio] = useState("");
  const [years, setYears] = useState(0);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [status, setStatus] = useState("AVAILABLE");
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [avgTenureMonths, setAvgTenureMonths] = useState("");

  // "Chính sách tiệm" — chỉ hiển thị cho OWNER, tự khai báo để hiển thị lại
  // ở thẻ "Sức Khỏe Tiệm & Văn Hóa Làm Việc" trên hồ sơ công khai.
  const [turnSplitPolicy, setTurnSplitPolicy] = useState("");
  const [clientTypePolicy, setClientTypePolicy] = useState("");
  const [housingSupport, setHousingSupport] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const session = sessionRes.ok ? await sessionRes.json() : null;
        if (!session?.user) {
          router.push("/auth/login");
          return;
        }
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setName(data.name || "");
          setPhone(data.phone || "");
          setSavedPhone(data.phone || "");
          setState(data.state || "");
          setCity(data.city || "");
          setTurnSplitPolicy(data.turnSplitPolicy || "");
          setClientTypePolicy(data.clientTypePolicy || "");
          setHousingSupport(Boolean(data.housingSupport));
          if (data.technicianProfile) {
            setBio(data.technicianProfile.bio || "");
            setYears(data.technicianProfile.yearsOfExperience || 0);
            setSpecialties(data.technicianProfile.specialties ? data.technicianProfile.specialties.split(",").filter(Boolean) : []);
            setStatus(data.technicianProfile.status || "AVAILABLE");
            setPortfolioImages(data.technicianProfile.portfolioImages || []);
            setAvgTenureMonths(data.technicianProfile.avgTenureMonths ? String(data.technicianProfile.avgTenureMonths) : "");
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Đổi ảnh đại diện — API /api/user/update-avatar có sẵn từ trước nhưng
  // chưa từng có UI gọi tới, nên mọi người dùng kẹt mãi với avatar ngẫu nhiên.
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setAvatarUploading(true);
    const toastId = toast.loading(tr("Đang cập nhật ảnh đại diện...", "Updating profile photo..."));
    try {
      const file = await prepareFileForUpload(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: formData });
      const upData = await up.json();
      if (!up.ok || !upData.url) throw new Error(upData.error || tr("Tải ảnh thất bại.", "Upload failed."));
      const res = await fetch("/api/user/update-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: upData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("Không cập nhật được ảnh đại diện.", "Couldn't update profile photo."));
      setProfile((prev: any) => ({ ...prev, avatarUrl: data.avatarUrl }));
      window.dispatchEvent(new Event("profile-updated"));
      toast.success(tr("Đã đổi ảnh đại diện!", "Profile photo updated!"), { id: toastId });
    } catch (err) {
      toast.error(err instanceof FileTooLargeError || err instanceof Error ? err.message : tr("Lỗi mạng khi tải ảnh.", "Network error while uploading."), { id: toastId });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Tính % hoàn thiện theo giá trị ĐANG NHẬP trong form (không chờ lưu) để
  // người dùng thấy tiến độ tăng ngay khi điền.
  const liveCompleteness = profile
    ? getProfileCompleteness({
        ...profile,
        phone,
        state,
        city,
        turnSplitPolicy,
        clientTypePolicy,
        technicianProfile: profile.technicianProfile
          ? { ...profile.technicianProfile, bio, yearsOfExperience: years, specialties: specialties.join(","), portfolioImages }
          : null,
      })
    : null;

  const toggleSpecialty = (s: string) => setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    const toastId = toast.loading(tr("Đang tải ảnh lên...", "Uploading..."));
    try {
      const file = await prepareFileForUpload(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setPortfolioImages((prev) => [...prev, data.url]);
        toast.success(tr("Tải ảnh thành công! ☁️", "Uploaded! ☁️"), { id: toastId });
      } else {
        toast.error(data.error || tr("Tải ảnh thất bại.", "Upload failed."), { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof FileTooLargeError ? err.message : tr("Lỗi mạng khi tải ảnh.", "Network error while uploading."), { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => setPortfolioImages((prev) => prev.filter((u) => u !== url));

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading(tr("Đang lưu hồ sơ...", "Saving profile..."));
    try {
      const payload: any = { name, phone, state, city };
      if (profile?.role === "TECHNICIAN") {
        payload.technician = {
          bio, yearsOfExperience: years, specialties: specialties.join(","), status, portfolioImages,
          avgTenureMonths: avgTenureMonths.trim() === "" ? null : Number(avgTenureMonths),
        };
      }
      if (profile?.role === "OWNER") {
        payload.turnSplitPolicy = turnSplitPolicy;
        payload.clientTypePolicy = clientTypePolicy;
        payload.housingSupport = housingSupport;
      }
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(tr("Đã lưu hồ sơ! 🎉", "Profile saved! 🎉"), { id: toastId });
        setSavedPhone(phone);
        setPhoneCheckKey((k) => k + 1);
        window.dispatchEvent(new Event("profile-updated"));
      } else {
        toast.error(data.error || tr("Không thể lưu hồ sơ.", "Couldn't save profile."), { id: toastId });
      }
    } catch {
      toast.error(tr("Lỗi mạng khi lưu hồ sơ.", "Network error while saving."), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // Bắt buộc theo chính sách App Store (Guideline 5.1.1(v)) và Google Play —
  // app cho tạo tài khoản thì phải có đường xóa tài khoản ngay trong app.
  // Gõ đúng cụm xác nhận (thay vì chỉ 1 nút bấm) để tránh xóa nhầm — đây là
  // hành động không thể hoàn tác.
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== DELETE_CONFIRM_PHRASE) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (res.ok) {
        toast.success(tr("Đã xóa tài khoản. Hẹn gặp lại bạn! 👋", "Account deleted. See you again! 👋"));
        await signOut({ redirect: false });
        router.push("/");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || tr("Không thể xóa tài khoản.", "Couldn't delete the account."));
        setDeletingAccount(false);
      }
    } catch {
      toast.error(tr("Lỗi mạng khi xóa tài khoản.", "Network error while deleting the account."));
      setDeletingAccount(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm(tr("Xóa tin tuyển dụng này?", "Delete this job post?"))) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) {
      setProfile((prev: any) => ({ ...prev, jobs: prev.jobs.filter((j: any) => j.id !== jobId) }));
      toast.success(tr("Đã xóa tin tuyển dụng.", "Job post deleted."));
    } else {
      toast.error(tr("Không thể xóa tin.", "Couldn't delete the job."));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
        </main>
      </div>
    );
  }

  const [g1, g2] = avatarGradient(profile?.id);
  const isOwner = profile?.role === "OWNER";
  const isTechnician = profile?.role === "TECHNICIAN";

  return (
    <div className="flex flex-col min-h-screen text-slate-100">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 pb-40 pt-5 md:px-6 md:pb-16 md:pt-6">
        {/* ===== HEADER: bìa + ảnh đại diện (bấm để đổi) ===== */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/40">
          <div className="relative h-24 sm:h-32" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
            <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/80" />
          </div>
          <div className="px-4 pb-5 sm:px-6">
            <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label={tr("Đổi ảnh đại diện", "Change profile photo")}
                className="group relative flex-shrink-0 rounded-full"
              >
                <Avatar src={profile?.avatarUrl} name={name} seed={profile?.id} loading="eager" className="h-20 w-20 shadow-xl shadow-black/50 ring-4 ring-slate-950 sm:h-24 sm:w-24" />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </span>
                <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-lg">
                  {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              {profile?.id && (
                <Link
                  href={`/profile/${profile.id}`}
                  className="mb-1 flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 py-2 text-xs font-bold text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                >
                  <Eye className="h-4 w-4" />{tr(" Xem hồ sơ công khai", " View public profile")}
                </Link>
              )}
            </div>
            <h1 className="mt-3 truncate text-2xl font-black tracking-tight text-white">{name || tr("Hồ sơ của bạn", "Your profile")}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-slate-400">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${isOwner ? "bg-amber-500/10 text-amber-200 ring-amber-500/25" : "bg-pink-500/10 text-pink-200 ring-pink-500/25"}`}>
                {isOwner ? <Store className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {isOwner ? tr("Chủ tiệm", "Salon owner") : tr("Thợ Nail", "Nail tech")}
              </span>
              <span className="truncate">{profile?.email}</span>
            </div>
            {isPlaceholderAvatar(profile?.avatarUrl) && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="mt-3 flex items-center gap-2 rounded-xl bg-pink-500/[0.08] px-3 py-2 text-left text-xs text-pink-200 ring-1 ring-pink-500/20 hover:bg-pink-500/[0.12]"
              >
                <Camera className="h-4 w-4 flex-shrink-0" />
                {isOwner ? tr("Thêm ảnh đại diện thật — hồ sơ có ảnh được thợ tin tưởng và nhắn tin nhiều hơn.", "Add a real profile photo — techs trust and message profiles with photos more.") : tr("Thêm ảnh đại diện thật — hồ sơ có ảnh được chủ tiệm tin tưởng và nhắn tin nhiều hơn.", "Add a real profile photo — salon owners trust and message profiles with photos more.")}
              </button>
            )}
          </div>
        </section>

        {liveCompleteness && <ProfileCompletenessCard completeness={liveCompleteness} role={profile?.role} />}

        {/* Công cụ hằng ngày — gọn 2 cột thay vì 2 banner to chiếm chỗ. */}
        <div className={`grid gap-3 ${isTechnician ? "sm:grid-cols-2" : ""}`}>
          {isTechnician && (
            <Link href="/tools/income-tracker" className="glass-card group flex items-center gap-3 rounded-2xl p-3.5 transition-colors hover:border-purple-500/40">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/15 ring-1 ring-purple-500/30">
                <Wallet className="h-5 w-5 text-purple-300" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{tr("Thu nhập & Tip", "Earnings & tips")}</span>
                <span className="block truncate text-[11px] text-slate-500">{tr("Ghi turn + tip, đối chiếu phiếu lương", "Log turns + tips, check your paycheck")}</span>
              </span>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-600 transition-colors group-hover:text-purple-300" />
            </Link>
          )}
          <Link href="/tools/radar" className="glass-card group flex items-center gap-3 rounded-2xl p-3.5 transition-colors hover:border-amber-500/40">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30">
              <Radar className="h-5 w-5 text-amber-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">Nail Radar</span>
              <span className="block truncate text-[11px] text-slate-500">{tr("Bao lương & chia turn theo tiểu bang", "Guaranteed pay & splits by state")}</span>
            </span>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-600 transition-colors group-hover:text-amber-300" />
          </Link>
        </div>

        {/* ===== AI ĐÃ XEM HỒ SƠ + THẺ CHIA SẺ ===== */}
        {profile && profile.role !== "ADMIN" && (
          <div className="space-y-3">
            <ProfileViewsCard role={profile.role} />
            <div className="flex flex-col gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-xs leading-relaxed text-slate-300">
                <span className="block text-sm font-bold text-white">{tr("Thẻ portfolio để đăng mạng xã hội", "Portfolio card for social media")}</span>
                {isOwner
                  ? tr("Ảnh đẹp có tên tiệm + mã QR — đăng Facebook/Instagram là thợ quét vào nhắn tiệm ngay.", "A polished image with your salon name + QR code — post it and techs can scan to message you.")
                  : tr("Ảnh đẹp có mẫu móng, kỹ năng + mã QR — đăng Facebook/TikTok là tiệm quét vào nhắn bạn ngay.", "A polished image with your work, skills + QR code — post it and salons can scan to message you.")}
              </p>
              <ShareCardButton
                data={{
                  id: profile.id,
                  name: name || profile.name,
                  avatarUrl: profile.avatarUrl,
                  role: profile.role,
                  market: profile.market,
                  city: city || profile.city,
                  state: state || profile.state,
                  years,
                  skills: specialties,
                  photos: portfolioImages,
                  openJobs: profile.jobs?.length ?? 0,
                  urgent: status === "URGENT",
                }}
              />
            </div>
          </div>
        )}

        {/* ===== THÔNG TIN CƠ BẢN ===== */}
        <FormSection icon={UserRound} title={tr("Thông tin cơ bản", "Basic info")} hint={tr("Hiển thị trên hồ sơ công khai (trừ số điện thoại).", "Shown on your public profile (except phone number).")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="pf-name">{tr("Họ và tên", "Full name")}</label>
              <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-phone">{tr("Số điện thoại", "Phone number")}</label>
              <input id="pf-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="VD: (713) 555-0123" className="input-field" />
              <PhoneVerify dirty={phone.trim() !== savedPhone.trim()} refreshKey={phoneCheckKey} />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-state">Bang</label>
              <input id="pf-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="VD: TX" className="input-field" />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-city">{tr("Thành phố", "City")}</label>
              <input id="pf-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="VD: Houston" className="input-field" />
            </div>
          </div>
        </FormSection>

        {/* ===== HỒ SƠ TAY NGHỀ (Thợ) ===== */}
        {isTechnician && (
          <FormSection icon={Sparkles} title={tr("Hồ sơ tay nghề", "Skill profile")} hint={tr("Chủ tiệm xem phần này đầu tiên khi tìm thợ.", "Salon owners look at this first when hiring.")}>
            <div>
              <span className="field-label">{tr("Trạng thái", "Status")}</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("AVAILABLE")}
                  aria-pressed={status === "AVAILABLE"}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ring-1 transition-all ${status === "AVAILABLE" ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/60" : "text-slate-400 ring-white/10 hover:ring-white/20"}`}
                >
                  <CheckCircle2 className="h-4 w-4" />{tr(" Sẵn sàng nhận việc", " Open to work")}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("URGENT")}
                  aria-pressed={status === "URGENT"}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ring-1 transition-all ${status === "URGENT" ? "bg-red-500/10 text-red-200 ring-red-500/60" : "text-slate-400 ring-white/10 hover:ring-white/20"}`}
                >
                  <Flame className="h-4 w-4" />{tr(" Tìm việc gấp", " Need work now")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="pf-years">{tr("Số năm kinh nghiệm", "Years of experience")}</label>
                <input id="pf-years" type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} className="input-field" />
              </div>
              <div>
                <label className="field-label" htmlFor="pf-tenure">{tr("Gắn bó TB (tháng/tiệm)", "Avg. tenure (months/salon)")}</label>
                <input id="pf-tenure" type="number" min={0} value={avgTenureMonths} onChange={(e) => setAvgTenureMonths(e.target.value)} placeholder="VD: 8" className="input-field" />
              </div>
            </div>

            <div>
              <span className="field-label">{tr("Kỹ năng sở trường", "Top skills")}</span>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((s) => {
                  const on = specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      aria-pressed={on}
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${on ? "bg-pink-500/15 text-pink-100 ring-pink-500/60" : "text-slate-400 ring-white/10 hover:ring-white/25 hover:text-slate-200"}`}
                    >
                      {on && <CheckCircle2 className="h-3.5 w-3.5" />} {valueLabel(s)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="pf-bio">{tr("Giới thiệu ngắn", "Short bio")}</label>
              <textarea id="pf-bio" rows={3} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tr("Kinh nghiệm, phong cách làm việc, loại móng làm đẹp nhất...", "Experience, work style, the nails you do best...")} className="input-field resize-none" />
              <p className="mt-1 text-right text-[10px] text-slate-600">{bio.length}/500</p>
            </div>

            <div>
              <span className="field-label">{tr("Ảnh / video mẫu móng (portfolio)", "Work photos / videos (portfolio)")}</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {portfolioImages.map((url) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="portfolio" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      aria-label={tr("Xoá ảnh này", "Remove this photo")}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-slate-500 transition-colors hover:border-pink-500/60 hover:bg-pink-500/[0.04] hover:text-pink-300"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[11px] font-bold">{tr("Thêm mẫu", "Add work")}</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUploadPhoto} />
            </div>
          </FormSection>
        )}

        {/* ===== CHÍNH SÁCH TIỆM (Chủ) — hiện lại ở "Sức khỏe tiệm" trên hồ sơ công khai ===== */}
        {isOwner && (
          <FormSection icon={Store} title={tr("Chính sách tiệm", "Salon policy")} hint={tr("Thợ rất quan tâm mục này trước khi nhắn tin.", "Techs check this before messaging.")}>
            <div>
              <label className="field-label" htmlFor="pf-turn">{tr("Tỉ lệ chia turn", "Commission split")}</label>
              <input id="pf-turn" value={turnSplitPolicy} onChange={(e) => setTurnSplitPolicy(e.target.value)} placeholder={tr("VD: 6/4 (thợ nhận 60%), hoặc bao lương không chia turn", "e.g. 6/4 (tech gets 60%), or guaranteed pay")} className="input-field" />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-client">{tr("Loại khách chủ yếu", "Main clientele")}</label>
              <input id="pf-client" value={clientTypePolicy} onChange={(e) => setClientTypePolicy(e.target.value)} placeholder={tr("VD: Khách sang, tip cao / Khách vãng lai, khu đông dân", "e.g. Upscale, high tips / Walk-ins, busy area")} className="input-field" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={housingSupport}
              onClick={() => setHousingSupport((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 text-left ring-1 ring-white/10 transition-colors hover:ring-white/20"
            >
              <span className="flex items-center gap-2.5">
                <HomeIcon className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">{tr("Có chỗ ở / bao ăn ở cho thợ ở xa", "Housing / meals for out-of-town techs")}</span>
              </span>
              <span className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${housingSupport ? "bg-emerald-500" : "bg-slate-700"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${housingSupport ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
          </FormSection>
        )}

        {/* ===== TIN TUYỂN DỤNG (Chủ) ===== */}
        {isOwner && (
          <FormSection
            icon={Briefcase}
            title={tr("Tin tuyển dụng đã đăng", "Your job posts")}
            action={
              <button type="button" onClick={() => router.push("/jobs/create")} className="flex items-center gap-1 rounded-lg bg-pink-500/10 px-2.5 py-1.5 text-xs font-bold text-pink-200 ring-1 ring-pink-500/25 hover:bg-pink-500/20">
                <Plus className="h-3.5 w-3.5" />{tr(" Đăng tin mới", " New post")}
              </button>
            }
          >
            {(!profile.jobs || profile.jobs.length === 0) ? (
              <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-500">{tr("Bạn chưa đăng tin tuyển dụng nào.", "You haven't posted any jobs yet.")}</p>
            ) : (
              <div className="space-y-2">
                {profile.jobs.map((job: any) => (
                  <div key={job.id} className="flex items-center gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 ring-1 ring-white/5">
                    <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-100 hover:text-white">{job.title}</p>
                      <p className="truncate text-xs text-slate-500">{job.city}, {stateName(job.market, job.state)} · {job.salaryAmount}</p>
                    </Link>
                    <button type="button" onClick={() => handleDeleteJob(job.id)} aria-label={tr("Xoá tin này", "Delete this job")} className="flex-shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        )}

        {/* ===== TÀI KHOẢN ===== */}
        {/* ===== THÔNG BÁO VIỆC THEO TIÊU CHÍ (thợ) ===== */}
        {profile?.role === "TECHNICIAN" && (
          <FormSection icon={BellRing} title={tr("Thông báo việc mới", "Job alerts")} hint={tr("Có tin khớp tiêu chí là bạn nhận thông báo ngay (tối đa 3).", "Get notified the moment a matching job is posted (up to 3).")}>
            <JobAlertsManager />
          </FormSection>
        )}

        {/* ===== ÂM THANH & RUNG (lưu trên thiết bị, áp dụng ngay — không cần bấm Lưu) ===== */}
        <FormSection icon={Volume2} title={tr("Âm thanh & rung", "Sound & haptics")} hint={tr("Áp dụng ngay trên thiết bị này.", "Applies right away on this device.")}>
          <SoundSettings />
        </FormSection>

        <FormSection icon={ShieldAlert} title={tr("Tài khoản", "Account")}>
          <button
            type="button"
            onClick={async () => { await signOut({ redirect: false }); router.push("/auth/login"); }}
            className="flex w-full items-center gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 text-left text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition-colors hover:ring-white/20"
          >
            <LogOut className="h-4 w-4 text-slate-400" />{tr(" Đăng xuất", " Sign out")}
          </button>
          <div className="rounded-xl bg-red-500/[0.05] p-3.5 ring-1 ring-red-500/20">
            <p className="flex items-center gap-2 text-sm font-bold text-red-300">
              <AlertTriangle className="h-4 w-4" />{tr(" Xóa tài khoản", " Delete account")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {tr("Xóa vĩnh viễn hồ sơ, tin tuyển dụng/portfolio và tin nhắn bạn đã gửi. Không thể hoàn tác.", "Permanently delete your profile, job posts/portfolio and sent messages. This can't be undone.")}
            </p>
            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="mt-2 text-xs font-bold text-red-400 hover:text-red-300 hover:underline">
              {tr("Tôi muốn xóa tài khoản", "I want to delete my account")}
            </button>
          </div>
        </FormSection>
      </main>

      {/* Thanh lưu dính đáy — luôn trong tầm tay, không phải cuộn xuống cuối form. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(10px,env(safe-area-inset-bottom))+82px)] z-40 px-4 md:bottom-6">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/90 p-2.5 pl-4 shadow-2xl shadow-black/60 backdrop-blur-xl md:px-3">
          <p className="hidden flex-1 text-xs text-slate-400 sm:block">{tr("Nhớ bấm lưu sau khi chỉnh sửa.", "Remember to save after editing.")}</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition-all hover:brightness-110 disabled:opacity-50 sm:flex-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr(" Lưu hồ sơ", " Save profile")}
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-0 sm:px-4"
          onClick={() => !deletingAccount && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-red-500/30 bg-slate-950 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-white">{tr("Xóa tài khoản vĩnh viễn?", "Delete account permanently?")}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {tr("Toàn bộ hồ sơ, tin tuyển dụng/portfolio và tin nhắn của bạn sẽ bị xóa hoàn toàn, không thể khôi phục.", "Your entire profile, job posts/portfolio and messages will be permanently deleted and can't be recovered.")}
                {tr(" Gõ ", " Type ")}<span className="font-mono font-bold text-red-300">{DELETE_CONFIRM_PHRASE}</span>{tr(" để xác nhận.", " to confirm.")}
              </p>
            </div>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={DELETE_CONFIRM_PHRASE}
              disabled={deletingAccount}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                disabled={deletingAccount}
                className="flex-1 min-h-[48px] rounded-xl border border-slate-800 text-sm font-bold text-slate-300 disabled:opacity-50"
              >
                {tr("Hủy", "Cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.trim() !== DELETE_CONFIRM_PHRASE || deletingAccount}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Xóa vĩnh viễn", "Delete forever")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
