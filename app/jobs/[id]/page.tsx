"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import {
  ArrowLeft, MapPin, DollarSign, Phone, MessageCircle, AlertCircle, Flame, Building, Clock,
  Bookmark, BookmarkCheck, Share2, ShieldCheck, Globe2, Wallet, ChevronRight, Eye, Zap, Timer, Sparkles,
} from "lucide-react";
import { trackJobContact, trackJobView } from "@/lib/viewTracker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { stateName } from "@/lib/stateNames";
import { timeAgo } from "@/lib/feedFormat";
import { useSessionUser } from "@/lib/SessionUserContext";
import Avatar from "@/components/ui/Avatar";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface JobDetail {
  id: string;
  title: string;
  salonName: string;
  description: string;
  market: "US" | "AU";
  state: string;
  city: string;
  salaryType: string;
  salaryAmount: string;
  skills: string[];
  benefits: string[];
  phone: string;
  isUrgent: boolean;
  createdAt: string;
  ownerId: string;
  owner?: { id: string; name: string; avatarUrl: string | null };
  saveCount?: number;
  heat?: { viewsToday: number; contacts7d: number; hot: boolean; firstViewers: number | null };
  ownerResponse?: { label: string; fast: boolean; samples: number } | null;
}

export default function JobDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useSessionUser();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [similar, setSimilar] = useState<JobDetail[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    async function fetchJobDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Tin tuyển dụng không tồn tại hoặc đã bị gỡ bỏ.");
        const data: JobDetail = await res.json();
        if (cancelled) return;
        setJob(data);
        // Tin tương tự cùng bang — giữ người dùng tiếp tục khám phá thay vì
        // "đọc xong 1 tin là hết đường".
        const listRes = await fetch(`/api/jobs?market=${data.market}&state=${encodeURIComponent(data.state)}`);
        if (listRes.ok && !cancelled) {
          const list: JobDetail[] = await listRes.json();
          setSimilar(list.filter((j) => j.id !== data.id).slice(0, 3));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobDetail();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !user?.id) return;
    fetch("/api/jobs/saved")
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => setSaved(Array.isArray(ids) && ids.includes(jobId)))
      .catch(() => {});
  }, [jobId, user?.id]);

  // Ghi lượt xem thật khi nội dung tin đã hiện đủ lâu (đếm 1 lần/ngày/thiết bị).
  useEffect(() => {
    if (!job?.id) return;
    return trackJobView(articleRef.current, job.id);
  }, [job?.id]);

  const toggleSave = async () => {
    if (!user?.id) {
      router.push("/auth/login");
      return;
    }
    const next = !saved;
    setSaved(next);
    const res = await fetch(`/api/jobs/${jobId}/save`, { method: next ? "POST" : "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setSaved(!next);
      toast.error("Không lưu được tin, vui lòng thử lại.");
    } else {
      toast.success(next ? "Đã lưu tin — xem lại trong mục \"Đã lưu\"." : "Đã bỏ lưu tin.");
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: job?.title, text: `${job?.title} — ${job?.salonName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Đã sao chép link tin tuyển dụng.");
      }
    } catch {
      /* người dùng huỷ chia sẻ */
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-6 sm:px-6 space-y-4" aria-busy="true">
          <div className="skeleton h-4 w-40" />
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-8 w-3/4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}
            </div>
            <div className="skeleton h-20" />
            <div className="skeleton h-12" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col min-h-screen text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-12 space-y-4">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error || "Tin tuyển dụng không khả dụng."}</span>
          </div>
          <Link href="/?tab=jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-pink-400 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Xem các tin tuyển dụng khác
          </Link>
        </main>
      </div>
    );
  }

  const facts = [
    { icon: MapPin, label: "Khu vực", value: `${job.city}, ${stateName(job.market, job.state)}` },
    { icon: DollarSign, label: "Mức lương", value: job.salaryAmount, accent: true },
    { icon: Wallet, label: "Hình thức", value: job.salaryType },
    { icon: Globe2, label: "Thị trường", value: job.market === "US" ? "🇺🇸 Mỹ" : "🇦🇺 Úc" },
  ];
  const isOwnJob = user?.id && user.id === job.ownerId;

  return (
    <div className="flex flex-col min-h-screen text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-6 pb-28 md:pb-10 sm:px-6 space-y-4">
        <Link href="/?tab=jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách tin
        </Link>

        <article ref={articleRef} className={`glass-card rounded-2xl p-5 sm:p-6 space-y-5 ${job.heat?.hot ? "!border-orange-500/40" : ""}`}>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {job.heat?.hot && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2.5 py-1 text-xs font-black text-white shadow-lg shadow-orange-500/30">
                  <Zap className="h-3.5 w-3.5 fill-white" /> Đang hot
                </span>
              )}
              {job.isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400 border border-red-500/30">
                  <Flame className="h-3.5 w-3.5" /> Cần gấp
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" /> Đăng {timeAgo(job.createdAt)}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={toggleSave}
                  aria-label={saved ? "Bỏ lưu tin" : "Lưu tin"}
                  aria-pressed={saved}
                  className={`rounded-xl border p-2 transition-colors ${saved ? "border-pink-500/40 bg-pink-500/10 text-pink-300" : "border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"}`}
                >
                  {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </button>
                <button onClick={share} aria-label="Chia sẻ tin" className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:border-slate-700 transition-colors">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">{job.title}</h1>
            <p className="flex items-center gap-2 text-slate-300">
              <Building className="h-4 w-4 text-pink-400" />
              <span className="font-semibold">{job.salonName}</span>
            </p>
          </header>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {facts.map(({ icon: Icon, label, value, accent }) => (
              <div key={label} className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </dt>
                <dd className={`mt-1 text-sm font-bold leading-snug break-words ${accent ? "text-emerald-400" : "text-slate-100"}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {(() => {
            const h = job.heat;
            const items: { icon: typeof Eye; text: string; tone: string }[] = [];
            if (h && h.viewsToday >= 3) items.push({ icon: Eye, text: `${h.viewsToday} người xem hôm nay`, tone: "text-amber-200" });
            if (h && h.contacts7d >= 2) items.push({ icon: MessageCircle, text: `${h.contacts7d} người đã liên hệ tuần này`, tone: "text-amber-200" });
            if ((job.saveCount ?? 0) >= 2) items.push({ icon: Bookmark, text: `${job.saveCount} người đã lưu tin`, tone: "text-amber-200" });
            if (job.ownerResponse) items.push({ icon: Timer, text: `Chủ tiệm thường trả lời ${job.ownerResponse.label}`, tone: job.ownerResponse.fast ? "text-emerald-300" : "text-slate-300" });
            if (items.length === 0 && !h?.firstViewers) return null;
            return (
              <div className="space-y-2">
                {h?.firstViewers && !isOwnJob && (
                  <p className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500/15 to-indigo-500/10 px-3.5 py-2.5 text-xs font-semibold text-sky-100 ring-1 ring-sky-400/25">
                    <Sparkles className="h-4 w-4 flex-shrink-0 text-sky-300" />
                    Tin mới — bạn là một trong {h.firstViewers} người đầu tiên xem. Liên hệ sớm để được ưu tiên.
                  </p>
                )}
                {items.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl bg-white/[0.03] px-3.5 py-2.5 ring-1 ring-white/5">
                    {items.map((it) => (
                      <span key={it.text} className={`inline-flex items-center gap-1.5 text-xs font-semibold ${it.tone}`}>
                        <it.icon className="h-3.5 w-3.5" /> {it.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {job.description && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-slate-200">Mô tả công việc</h2>
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{job.description}</p>
            </section>
          )}

          {job.skills?.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-slate-200">Kỹ năng yêu cầu</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <span key={s} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-3 py-1 text-xs font-semibold text-pink-300">{s}</span>
                ))}
              </div>
            </section>
          )}

          {job.benefits?.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-slate-200">Quyền lợi</h2>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b) => (
                  <span key={b} className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-semibold text-emerald-300">🎁 {b}</span>
                ))}
              </div>
            </section>
          )}

          {!isOwnJob && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800/80">
              <a
                href={`tel:${job.phone}`}
                onClick={() => trackJobContact(job.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
              >
                <Phone className="h-5 w-5" /> Gọi ngay {job.phone}
              </a>
              <button
                onClick={() => {
                  if (user?.id) trackJobContact(job.id);
                  router.push(user?.id ? `/messages?to=${job.ownerId}` : "/auth/login");
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 py-3.5 text-base font-bold text-slate-100 transition-all"
              >
                <MessageCircle className="h-5 w-5" /> Nhắn tin qua App
              </button>
            </div>
          )}
        </article>

        {job.owner && (
          <Link
            href={`/profile/${job.owner.id}`}
            className="glass-card group flex items-center gap-3 rounded-2xl p-4 hover:border-pink-500/30 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Avatar src={job.owner.avatarUrl} name={job.owner.name} seed={job.owner.id} className="h-12 w-12 ring-2 ring-pink-500/30" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đăng bởi chủ tiệm</p>
              <p className="truncate text-sm font-bold text-white">{job.owner.name}</p>
              <p className="text-xs text-slate-400">Xem hồ sơ tiệm, chính sách chia turn & đánh giá từ thợ</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-pink-400 transition-colors" />
          </Link>
        )}

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Trước khi nhận việc
          </h2>
          <ul className="mt-2 grid gap-1.5 text-xs leading-relaxed text-slate-300 sm:grid-cols-2">
            <li>• Hỏi rõ cách chia turn, tip tiền mặt hay qua thẻ.</li>
            <li>• Xác nhận chỗ ở / xe đưa đón (nếu có) bằng tin nhắn.</li>
            <li>• Không chuyển tiền đặt cọc dưới bất kỳ hình thức nào.</li>
            <li>• So mức lương với <Link href="/tools/radar" className="text-emerald-300 underline">Nail Radar</Link> của bang.</li>
          </ul>
        </section>

        {similar.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="px-1 text-sm font-bold text-slate-200">Tin tương tự tại {stateName(job.market, job.state)}</h2>
            {similar.map((s) => (
              <Link
                key={s.id}
                href={`/jobs/${s.id}`}
                className="glass-card group flex items-center gap-3 rounded-2xl p-3.5 hover:border-pink-500/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{s.title}</p>
                  <p className="truncate text-xs text-slate-400">{s.salonName} · {s.city}</p>
                </div>
                <span className="flex-shrink-0 text-xs font-bold text-emerald-400">{s.salaryAmount}</span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-pink-400" />
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
