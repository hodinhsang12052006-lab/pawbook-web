"use client";

import React, { useEffect, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { Loader2, Save, Upload, X, Trash2, Flame, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

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
          if (data.technicianProfile) {
            setBio(data.technicianProfile.bio || "");
            setYears(data.technicianProfile.yearsOfExperience || 0);
            setSpecialties(data.technicianProfile.specialties ? data.technicianProfile.specialties.split(",").filter(Boolean) : []);
            setStatus(data.technicianProfile.status || "AVAILABLE");
            setPortfolioImages(data.technicianProfile.portfolioImages || []);
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
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading("Đang tải ảnh lên...");
    try {
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
    } catch {
      toast.error("Lỗi mạng khi tải ảnh.", { id: toastId });
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
        payload.technician = { bio, yearsOfExperience: years, specialties: specialties.join(","), status, portfolioImages };
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
      <Toaster position="top-center" />

      <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-8 space-y-6 pb-24">
        <div className="flex items-center gap-4">
          <img src={profile?.avatarUrl} alt={name} className="h-16 w-16 rounded-full object-cover border-2 border-pink-500/50" />
          <div>
            <h1 className="text-xl font-extrabold text-white">{name}</h1>
            <p className="text-xs text-slate-400">{profile?.role === "OWNER" ? "🏪 Chủ tiệm" : "💅 Thợ Nail"} · {profile?.email}</p>
          </div>
        </div>

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

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Số năm kinh nghiệm</label>
              <input type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100" />
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
      </main>
    </div>
  );
}
