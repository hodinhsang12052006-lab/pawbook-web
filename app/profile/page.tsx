"use client";

import React, { useEffect, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { Loader2, Save, Upload, X, Trash2, Flame, CheckCircle2, AlertTriangle, Wallet, ArrowRight, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";

const DELETE_CONFIRM_PHRASE = "XÓA TÀI KHOẢN";

const SKILL_OPTIONS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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

  const toggleSpecialty = (s: string) => setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    const toastId = toast.loading("Đang tải ảnh lên...");
    try {
      const file = await prepareFileForUpload(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setPortfolioImages((prev) => [...prev, data.url]);
        toast.success("Tải ảnh thành công! ☁️", { id: toastId });
      } else {
        toast.error(data.error || "Tải ảnh thất bại.", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof FileTooLargeError ? err.message : "Lỗi mạng khi tải ảnh.", { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => setPortfolioImages((prev) => prev.filter((u) => u !== url));

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Đang lưu hồ sơ...");
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
        toast.success("Đã lưu hồ sơ! 🎉", { id: toastId });
        window.dispatchEvent(new Event("profile-updated"));
      } else {
        toast.error(data.error || "Không thể lưu hồ sơ.", { id: toastId });
      }
    } catch {
      toast.error("Lỗi mạng khi lưu hồ sơ.", { id: toastId });
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
        toast.success("Đã xóa tài khoản. Hẹn gặp lại bạn! 👋");
        await signOut({ redirect: false });
        router.push("/");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Không thể xóa tài khoản.");
        setDeletingAccount(false);
      }
    } catch {
      toast.error("Lỗi mạng khi xóa tài khoản.");
      setDeletingAccount(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Xóa tin tuyển dụng này?")) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) {
      setProfile((prev: any) => ({ ...prev, jobs: prev.jobs.filter((j: any) => j.id !== jobId) }));
      toast.success("Đã xóa tin tuyển dụng.");
    } else {
      toast.error("Không thể xóa tin.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-8 space-y-6 pb-24">
        <div className="flex items-center gap-4">
          <img src={profile?.avatarUrl} alt={name} className="h-16 w-16 rounded-full object-cover border-2 border-pink-500/50" />
          <div>
            <h1 className="text-xl font-extrabold text-white">{name}</h1>
            <p className="text-xs text-slate-400">{profile?.role === "OWNER" ? "🏪 Chủ tiệm" : "💅 Thợ Nail"} · {profile?.email}</p>
          </div>
        </div>

        {/* Bảng tính thu nhập & Tip — công cụ hằng ngày, đặt ngay đầu trang
            profile để dễ thấy nhất (thay vì chôn dưới đáy sau form dài). */}
        {profile?.role === "TECHNICIAN" && (
          <Link
            href="/tools/income-tracker"
            className="flex items-center gap-3.5 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-slate-900/40 to-indigo-950/40 p-4 hover:border-purple-500/40 transition-all group"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30">
              <Wallet className="h-5 w-5 text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Bảng tính thu nhập & Tip</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Ghi turn + tip mỗi tối, đối chiếu phiếu lương cuối tuần</p>
            </div>
            <ArrowRight className="h-4.5 w-4.5 text-slate-500 group-hover:text-purple-400 transition-colors flex-shrink-0" />
          </Link>
        )}

        {/* Nail Radar — công cụ tham khảo mức bao lương/chia turn theo bang,
            hữu ích cho cả Thợ (cân nhắc trước khi bay) lẫn Chủ (biết mức
            cạnh tranh khi đăng tin). */}
        <Link
          href="/tools/radar"
          className="flex items-center gap-3.5 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-slate-900/40 to-orange-950/40 p-4 hover:border-amber-500/40 transition-all group"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
            <Radar className="h-5 w-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Nail Radar</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Chỉ số bao lương & chia turn tham khảo theo tiểu bang</p>
          </div>
          <ArrowRight className="h-4.5 w-4.5 text-slate-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
        </Link>

        {/* Basic info */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">Thông tin cơ bản</h2>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Họ và Tên</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Số điện thoại</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Bang</label>
              <input value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Thành phố</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100" />
            </div>
          </div>
        </div>

        {/* Technician portfolio */}
        {profile?.role === "TECHNICIAN" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Hồ sơ tay nghề</h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStatus("AVAILABLE")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border-2 transition-all ${status === "AVAILABLE" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-800 text-slate-400"}`}
              >
                <CheckCircle2 className="h-4 w-4" /> Đang rảnh tay
              </button>
              <button
                onClick={() => setStatus("URGENT")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border-2 transition-all ${status === "URGENT" ? "border-red-500 bg-red-500/10 text-red-300" : "border-slate-800 text-slate-400"}`}
              >
                <Flame className="h-4 w-4" /> Tìm việc gấp
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Số năm kinh nghiệm</label>
                <input type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Gắn bó TB (tháng/tiệm)</label>
                <input
                  type="number"
                  min={0}
                  value={avgTenureMonths}
                  onChange={(e) => setAvgTenureMonths(e.target.value)}
                  placeholder="VD: 8"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Kỹ năng sở trường</label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSpecialty(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border-2 transition-all ${specialties.includes(s) ? "border-pink-500 bg-pink-500/15 text-pink-300" : "border-slate-800 text-slate-400"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Giới thiệu ngắn</label>
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Kinh nghiệm, phong cách làm việc..." className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Ảnh / Video mẫu móng (portfolio)</label>
              <div className="grid grid-cols-3 gap-2">
                {portfolioImages.map((url) => (
                  <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 group">
                    <img src={url} alt="portfolio" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-pink-500 hover:text-pink-400 transition-colors"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[10px] font-bold">Tải ảnh</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUploadPhoto} />
            </div>
          </div>
        )}

        {/* Chính sách tiệm — hiển thị lại trên hồ sơ công khai ở thẻ "Sức
            Khỏe Tiệm & Văn Hóa Làm Việc". Tự khai báo vì hệ thống không có
            nguồn dữ liệu chấm công/booking thật để tự suy ra các mục này. */}
        {profile?.role === "OWNER" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Chính sách tiệm</h2>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Tỉ lệ chia turn</label>
              <input
                value={turnSplitPolicy}
                onChange={(e) => setTurnSplitPolicy(e.target.value)}
                placeholder="VD: 6/4 (thợ nhận 60%), hoặc Bao lương không chia turn"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Loại khách chủ yếu</label>
              <input
                value={clientTypePolicy}
                onChange={(e) => setClientTypePolicy(e.target.value)}
                placeholder="VD: Khách sang, tip cao / Khách vãng lai, khu đông dân"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600"
              />
            </div>
            <button
              onClick={() => setHousingSupport((v) => !v)}
              className={`w-full flex items-center justify-between rounded-xl border-2 px-3.5 py-2.5 transition-all ${
                housingSupport ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-800 text-slate-400"
              }`}
            >
              <span className="text-xs font-bold">Có chỗ ở/bao ăn ở cho thợ ở xa</span>
              <span className="text-xs font-black">{housingSupport ? "CÓ" : "KHÔNG"}</span>
            </button>
          </div>
        )}

        {/* Owner's posted jobs */}
        {profile?.role === "OWNER" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200">Tin tuyển dụng đã đăng</h2>
              <button onClick={() => router.push("/jobs/create")} className="text-xs font-bold text-pink-400 hover:underline">+ Đăng tin mới</button>
            </div>
            {(!profile.jobs || profile.jobs.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">Bạn chưa đăng tin tuyển dụng nào.</p>
            ) : (
              <div className="space-y-2">
                {profile.jobs.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-850 bg-slate-950/40 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-200 truncate">{job.title}</p>
                      <p className="text-xs text-slate-500">{job.city}, {job.state} · {job.salaryAmount}</p>
                    </div>
                    <button onClick={() => handleDeleteJob(job.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-600/25 disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> Lưu hồ sơ</>}
        </button>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
          <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Vùng nguy hiểm
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Xóa tài khoản sẽ xóa vĩnh viễn hồ sơ, tin tuyển dụng/portfolio, và tin nhắn bạn đã gửi. Hành động này không thể hoàn tác.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline"
          >
            Xóa tài khoản
          </button>
        </div>
      </main>

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
              <h3 className="text-lg font-extrabold text-white">Xóa tài khoản vĩnh viễn?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Toàn bộ hồ sơ, tin tuyển dụng/portfolio và tin nhắn của bạn sẽ bị xóa hoàn toàn, không thể khôi phục.
                Gõ <span className="font-mono font-bold text-red-300">{DELETE_CONFIRM_PHRASE}</span> để xác nhận.
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
                Hủy
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.trim() !== DELETE_CONFIRM_PHRASE || deletingAccount}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
