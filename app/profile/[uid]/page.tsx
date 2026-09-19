"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { Loader2, AlertCircle, MessageCircle, Flame, CheckCircle2, MapPin, Briefcase, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ uid: string }>;
}

export default function PublicProfilePage({ params }: PageProps) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setUid(p.uid));
  }, [params]);

  useEffect(() => {
    if (!uid) return;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/profile?id=${uid}`);
        if (!res.ok) throw new Error("Không tìm thấy hồ sơ này.");
        setProfile(await res.json());
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-pink-500 animate-spin" /></main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto max-w-2xl w-full px-4 py-12">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </main>
      </div>
    );
  }

  const tech = profile.technicianProfile;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <img src={profile.avatarUrl} alt={profile.name} className="h-20 w-20 rounded-full object-cover border-2 border-pink-500/50" />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-white truncate">{profile.name}</h1>
            <p className="text-xs text-slate-400">{profile.role === "OWNER" ? "🏪 Chủ tiệm" : "💅 Thợ Nail"}</p>
            {(profile.city || profile.state) && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {[profile.city, profile.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => router.push(`/messages?to=${profile.id}`)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-600/25 transition-all"
        >
          <MessageCircle className="h-5 w-5" /> Nhắn tin {profile.role === "TECHNICIAN" ? "tuyển dụng" : "liên hệ"}
        </button>

        {/* Technician portfolio */}
        {profile.role === "TECHNICIAN" && tech && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {tech.status === "URGENT" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/30">
                  <Flame className="h-3.5 w-3.5" /> Đang tìm việc gấp
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đang rảnh tay
                </span>
              )}
              <span className="text-xs text-slate-400">{tech.yearsOfExperience} năm kinh nghiệm</span>
            </div>

            {tech.bio && <p className="text-sm text-slate-300 leading-relaxed">{tech.bio}</p>}

            {tech.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(tech.specialties) ? tech.specialties : tech.specialties.split(",")).filter(Boolean).map((s: string) => (
                  <span key={s} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-3 py-1 text-xs font-semibold text-pink-300">{s}</span>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-2">Portfolio ({tech.portfolioImages?.length || 0})</h3>
              {tech.portfolioImages?.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {tech.portfolioImages.map((url: string, idx: number) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800">
                      {/\.(mp4|webm|mov)$/i.test(url) ? (
                        <>
                          <video src={url} className="h-full w-full object-cover" muted playsInline />
                          <Play className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
                        </>
                      ) : (
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Thợ chưa đăng ảnh portfolio nào.</p>
              )}
            </div>
          </div>
        )}

        {/* Owner's jobs */}
        {profile.role === "OWNER" && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-pink-400" /> Tin tuyển dụng đang đăng
            </h3>
            {(!profile.jobs || profile.jobs.length === 0) ? (
              <p className="text-xs text-slate-500">Chưa có tin tuyển dụng nào.</p>
            ) : (
              <div className="space-y-2">
                {profile.jobs.map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="block rounded-xl border border-slate-850 bg-slate-950/40 px-3.5 py-2.5 hover:border-pink-500/40 transition-colors"
                  >
                    <p className="text-sm font-bold text-slate-200">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.city}, {job.state} · {job.salaryAmount}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
