"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { ArrowLeft, MapPin, DollarSign, Phone, MessageCircle, Loader2, AlertCircle, Flame, Building } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;
    async function fetchJobDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Tin tuyển dụng không tồn tại hoặc đã bị gỡ bỏ.");
        setJob(await res.json());
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }
    fetchJobDetail();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-12 space-y-4">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error || "Tin tuyển dụng không khả dụng."}</span>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-pink-400 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Quay lại trang chủ
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" /> Quay lại danh sách tin
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              {job.isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400 border border-red-500/30">
                  <Flame className="h-3.5 w-3.5" /> Cần Gấp
                </span>
              )}
              <h1 className="text-2xl font-extrabold text-white leading-tight">{job.title}</h1>
              <div className="flex items-center gap-2 text-slate-300">
                <Building className="h-4.5 w-4.5 text-pink-400" />
                <span className="font-semibold">{job.salonName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300 border-y border-slate-850 py-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-500" /> {job.city}, {job.state} ({job.market})
            </span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
              <DollarSign className="h-4 w-4" /> {job.salaryAmount} <span className="text-slate-500 font-normal">({job.salaryType})</span>
            </span>
          </div>

          {job.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-200">Mô tả công việc</h3>
              <p className="text-sm leading-relaxed text-slate-350 whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {job.skills?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-200">Kỹ năng yêu cầu</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((s: string) => (
                  <span key={s} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-3 py-1 text-xs font-semibold text-pink-300">{s}</span>
                ))}
              </div>
            </div>
          )}

          {job.benefits?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-200">Quyền lợi</h3>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b: string) => (
                  <span key={b} className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-semibold text-emerald-300">🎁 {b}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-850">
            <a
              href={`tel:${job.phone}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Phone className="h-5 w-5" /> Gọi ngay {job.phone}
            </a>
            <button
              onClick={() => router.push(`/messages?to=${job.ownerId}`)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-3.5 text-base font-bold text-slate-100 transition-all"
            >
              <MessageCircle className="h-5 w-5" /> Nhắn tin qua App
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-600 mt-8">
        <p>© 2026 PawNail Jobs.</p>
      </footer>
    </div>
  );
}
