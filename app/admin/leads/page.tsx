"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast, { Toaster } from "react-hot-toast";
import {
  Loader2, ArrowLeft, Phone, Copy, Star, X, ChevronRight, Clock,
  Flame, Home, CheckCircle2, XCircle, Sparkles, ShieldAlert,
} from "lucide-react";
import { SURVEY, PAIN_TAG_META, getSalesScript } from "@/lib/ownerSurvey";

// ============================================================
// Types
// ============================================================

interface JobLite {
  id: string;
  title: string;
  salonName: string;
  skills: string[];
  salaryType: string;
  salaryAmount: string;
  benefits: string[];
  phone: string;
  isUrgent: boolean;
  createdAt: string;
}

interface SurveyAnswerRecord {
  key: string;
  title: string;
  answer: "A" | "B";
  tag: string | null;
  answeredAt: string;
}

interface OwnerLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  market: "US" | "AU";
  state: string | null;
  city: string | null;
  pains: string[];
  leadScore: number;
  surveyAnswers: SurveyAnswerRecord[];
  createdAt: string;
  jobs: JobLite[];
}

interface TechnicianProfileLite {
  bio: string | null;
  yearsOfExperience: number;
  specialties: string[];
  status: string;
  desiredSalaryType: string | null;
  desiredSalaryAmount: string | null;
  desiredBenefits: string[];
  portfolioImages: string[];
}

interface TechnicianLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  market: "US" | "AU";
  state: string | null;
  city: string | null;
  createdAt: string;
  technicianProfile: TechnicianProfileLite | null;
}

const PRESS = "active:scale-95 transition-transform duration-100";

// ============================================================
// Small shared UI bits
// ============================================================

function copyToClipboard(text: string, label = "Đã copy") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label, { icon: "📋" }),
    () => toast.error("Không thể copy. Vui lòng thử lại.")
  );
}

function LeadStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`Điểm khát phần mềm: ${score}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < score ? "fill-amber-400 text-amber-400" : "text-slate-700"}`} />
      ))}
    </div>
  );
}

function PainBadge({ tag }: { tag: string }) {
  const meta = PAIN_TAG_META[tag];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.classes}`}>
      {meta.shortLabel}
    </span>
  );
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ============================================================
// Lead (Owner) detail slide-over
// ============================================================

function LeadDetailPanel({ lead, onClose }: { lead: OwnerLead; onClose: () => void }) {
  const latestJob = lead.jobs[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full sm:w-[480px] bg-slate-950 border-l border-slate-800 overflow-y-auto animate-fadeIn">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 backdrop-blur-md px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-white">{lead.name}</h2>
            <p className="text-xs text-slate-400">{latestJob?.salonName || "Chưa có tin đăng"}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full text-slate-400 hover:bg-slate-900 hover:text-white ${PRESS}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Contact */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Số điện thoại</p>
                <p className="text-lg font-extrabold text-white">{lead.phone || "—"}</p>
              </div>
              <LeadStars score={lead.leadScore} />
            </div>
            {lead.phone && (
              <div className="flex gap-2">
                <a href={`tel:${lead.phone}`} className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-bold text-white ${PRESS}`}>
                  <Phone className="h-4 w-4" /> Gọi ngay
                </a>
                <button onClick={() => copyToClipboard(lead.phone!, "Đã copy số điện thoại")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-bold text-slate-100 ${PRESS}`}>
                  <Copy className="h-4 w-4" /> Copy SĐT
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500">{lead.email}</p>
            <p className="text-xs text-slate-500">📍 {[lead.city, lead.state].filter(Boolean).join(", ")} · {lead.market}</p>
            <p className="text-[10px] text-slate-600">Đăng ký lúc {formatDateTime(lead.createdAt)}</p>
          </div>

          {/* Job posting */}
          {latestJob && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Nhu cầu tuyển thợ</h3>
              <p className="text-sm font-bold text-white">{latestJob.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {latestJob.skills.map((s) => (
                  <span key={s} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-2 py-0.5 text-[10px] font-semibold text-pink-300">{s}</span>
                ))}
              </div>
              <p className="text-sm text-emerald-400 font-bold">{latestJob.salaryAmount} <span className="text-slate-500 font-normal text-xs">({latestJob.salaryType})</span></p>
              {latestJob.benefits.length > 0 && (
                <p className="text-xs text-slate-400 flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {latestJob.benefits.join(" · ")}</p>
              )}
            </div>
          )}

          {/* Sales script generator */}
          {lead.pains.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-pink-400" /> Gợi ý kịch bản chốt sale
              </h3>
              {lead.pains.map((tag) => {
                const meta = PAIN_TAG_META[tag];
                const script = getSalesScript(tag, {
                  name: lead.name,
                  salonName: latestJob?.salonName || "",
                  city: lead.city || "",
                  urgentRole: latestJob?.skills,
                });
                return (
                  <div key={tag} className={`rounded-2xl border p-4 space-y-2 ${meta?.classes || "border-slate-800 bg-slate-900/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <PainBadge tag={tag} />
                      <button
                        onClick={() => copyToClipboard(script, "Đã copy kịch bản")}
                        className={`inline-flex items-center gap-1 rounded-lg border border-current/30 px-2 py-1 text-[10px] font-bold ${PRESS}`}
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-200">{script}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Survey answer log */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Lịch sử trả lời khảo sát
            </h3>
            {SURVEY.map((q) => {
              const record = lead.surveyAnswers.find((a) => a.key === q.key);
              if (!record) {
                return (
                  <div key={q.key} className="rounded-xl border border-slate-850 bg-slate-950/40 p-3 text-xs text-slate-600 italic">
                    {q.title} — chưa có dữ liệu (đăng ký trước khi tính năng này ra mắt)
                  </div>
                );
              }
              const isPain = record.answer === "A";
              const chosenText = isPain ? q.optionA : q.optionB;
              return (
                <div key={q.key} className="rounded-xl border border-slate-850 bg-slate-950/40 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-400">{q.title}</p>
                    <span className="text-[10px] text-slate-600">{formatDateTime(record.answeredAt)}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    {isPain ? (
                      <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Chọn <span className="font-bold">{isPain ? "A" : "B"}</span>: {chosenText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Owner lead card
// ============================================================

function LeadCard({ lead, onOpen }: { lead: OwnerLead; onOpen: () => void }) {
  const latestJob = lead.jobs[0];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={`w-full text-left rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3 hover:border-pink-500/40 transition-colors cursor-pointer ${PRESS}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-white truncate">{latestJob?.salonName || "Chưa đăng tin"}</p>
          <p className="text-xs text-slate-400 truncate">{lead.name} · {lead.city}, {lead.state} {lead.market === "US" ? "🇺🇸" : "🇦🇺"}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center justify-between">
        <LeadStars score={lead.leadScore} />
        {latestJob?.isUrgent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
            <Flame className="h-3 w-3" /> Gấp
          </span>
        )}
      </div>

      {latestJob && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
          {latestJob.skills.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-slate-800 px-2 py-0.5">{s}</span>
          ))}
          <span className="font-bold text-emerald-400">{latestJob.salaryAmount}</span>
        </div>
      )}

      {lead.pains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-850">
          {lead.pains.map((tag) => <PainBadge key={tag} tag={tag} />)}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {lead.phone && (
          <>
            <a
              href={`tel:${lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 py-2 text-xs font-bold text-white ${PRESS}`}
            >
              <Phone className="h-3.5 w-3.5" /> Gọi
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone!, "Đã copy số điện thoại"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 text-xs font-bold text-slate-100 ${PRESS}`}
            >
              <Copy className="h-3.5 w-3.5" /> Copy SĐT
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Technician card + portfolio lightbox
// ============================================================

function TechnicianCard({ tech, onOpenImage }: { tech: TechnicianLead; onOpenImage: (url: string) => void }) {
  const p = tech.technicianProfile;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-white truncate">{tech.name}</p>
          <p className="text-xs text-slate-400 truncate">{tech.city}, {tech.state} {tech.market === "US" ? "🇺🇸" : "🇦🇺"} · {p?.yearsOfExperience ?? 0} năm KN</p>
        </div>
        {p?.status === "URGENT" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30 flex-shrink-0">
            <Flame className="h-3 w-3" /> Gấp
          </span>
        )}
        {p?.status === "BETTER" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/30 flex-shrink-0">
            Tìm chỗ tốt hơn
          </span>
        )}
      </div>

      {p && p.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.specialties.map((s) => (
            <span key={s} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-2 py-0.5 text-[10px] font-semibold text-pink-300">{s}</span>
          ))}
        </div>
      )}

      {p?.desiredSalaryAmount && (
        <p className="text-xs font-bold text-emerald-400">{p.desiredSalaryAmount} <span className="text-slate-500 font-normal">({p.desiredSalaryType})</span></p>
      )}

      {tech.phone && (
        <div className="flex gap-2">
          <a href={`tel:${tech.phone}`} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 py-2 text-xs font-bold text-white ${PRESS}`}>
            <Phone className="h-3.5 w-3.5" /> {tech.phone}
          </a>
          <button onClick={() => copyToClipboard(tech.phone!, "Đã copy số điện thoại")} className={`rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 ${PRESS}`}>
            <Copy className="h-3.5 w-3.5 text-slate-300" />
          </button>
        </div>
      )}

      {p && p.portfolioImages.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {p.portfolioImages.slice(0, 4).map((url, idx) => (
            <button
              key={idx}
              onClick={() => onOpenImage(url)}
              className={`relative aspect-square rounded-lg overflow-hidden border border-slate-800 ${PRESS}`}
            >
              {/\.(mp4|webm|mov)$/i.test(url) ? (
                <video src={url} className="h-full w-full object-cover" muted />
              ) : (
                <Image src={url} alt="portfolio" fill sizes="80px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button onClick={onClose} className={`absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 text-white ${PRESS}`}>
        <X className="h-6 w-6" />
      </button>
      {/\.(mp4|webm|mov)$/i.test(url) ? (
        <video src={url} controls autoPlay className="max-h-[85vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={url} alt="portfolio full" className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
      )}
    </div>
  );
}

// ============================================================
// Main page
// ============================================================

export default function AdminLeadsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [owners, setOwners] = useState<OwnerLead[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianLead[]>([]);

  const [tab, setTab] = useState<"leads" | "technicians">("leads");
  const [marketFilter, setMarketFilter] = useState<"ALL" | "US" | "AU">("ALL");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [painFilter, setPainFilter] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<OwnerLead | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/leads");
        if (res.status === 401 || res.status === 403) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Bạn không có quyền truy cập trang này.");
          router.push("/");
          return;
        }
        if (!res.ok) throw new Error("Không thể tải dữ liệu lead.");
        const data = await res.json();
        setOwners(data.owners || []);
        setTechnicians(data.technicians || []);
        setAuthorized(true);
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setAuthChecked(true);
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const availableStates = useMemo(() => {
    const source = tab === "leads" ? owners : technicians;
    const filtered = marketFilter === "ALL" ? source : source.filter((x) => x.market === marketFilter);
    return Array.from(new Set(filtered.map((x) => x.state).filter(Boolean))) as string[];
  }, [owners, technicians, tab, marketFilter]);

  const filteredOwners = useMemo(() => {
    return owners
      .filter((o) => marketFilter === "ALL" || o.market === marketFilter)
      .filter((o) => stateFilter === "ALL" || o.state === stateFilter)
      .filter((o) => !painFilter || o.pains.includes(painFilter))
      .sort((a, b) => b.leadScore - a.leadScore);
  }, [owners, marketFilter, stateFilter, painFilter]);

  const filteredTechnicians = useMemo(() => {
    return technicians
      .filter((t) => marketFilter === "ALL" || t.market === marketFilter)
      .filter((t) => stateFilter === "ALL" || t.state === stateFilter);
  }, [technicians, marketFilter, stateFilter]);

  if (!authChecked || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-center px-4">
        <ShieldAlert className="h-10 w-10 text-red-400" />
        <p className="text-sm text-slate-400">{error || "Đang chuyển hướng..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-center" />

      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className={`p-2 rounded-full text-slate-400 hover:bg-slate-900 ${PRESS}`}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-pink-400" /> Admin — Lead Radar
              </h1>
              <p className="text-[11px] text-slate-500">{owners.length} chủ tiệm · {technicians.length} thợ đã đăng ký</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-5">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/40 border border-slate-850 max-w-md">
          <button
            onClick={() => { setTab("leads"); setStateFilter("ALL"); }}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${PRESS} ${tab === "leads" ? "bg-pink-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
          >
            🏪 Chủ tiệm (Leads)
          </button>
          <button
            onClick={() => { setTab("technicians"); setStateFilter("ALL"); }}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${PRESS} ${tab === "technicians" ? "bg-pink-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
          >
            💅 Thợ (Technician Radar)
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "US", "AU"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMarketFilter(m); setStateFilter("ALL"); }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border ${PRESS} ${marketFilter === m ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"}`}
              >
                {m === "ALL" ? "Tất cả vùng" : m === "US" ? "🇺🇸 US" : "🇦🇺 AU"}
              </button>
            ))}
            <span className="w-px h-5 bg-slate-800 mx-1" />
            <button
              onClick={() => setStateFilter("ALL")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border ${PRESS} ${stateFilter === "ALL" ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"}`}
            >
              Tất cả bang
            </button>
            {availableStates.map((s) => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border ${PRESS} ${stateFilter === s ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"}`}
              >
                {s}
              </button>
            ))}
          </div>

          {tab === "leads" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-850">
              <span className="text-[11px] text-slate-500 font-bold">Lọc theo nỗi đau:</span>
              <button
                onClick={() => setPainFilter(null)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${PRESS} ${!painFilter ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"}`}
              >
                Tất cả
              </button>
              {Object.values(PAIN_TAG_META).map((meta) => (
                <button
                  key={meta.tag}
                  onClick={() => setPainFilter(painFilter === meta.tag ? null : meta.tag)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${PRESS} ${painFilter === meta.tag ? meta.classes.replace("/10", "/25") : `border ${meta.classes}`}`}
                >
                  {meta.shortLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {tab === "leads" ? (
          filteredOwners.length === 0 ? (
            <p className="text-center py-16 text-sm text-slate-500">Không có lead nào khớp bộ lọc.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOwners.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedLead(lead)} />
              ))}
            </div>
          )
        ) : filteredTechnicians.length === 0 ? (
          <p className="text-center py-16 text-sm text-slate-500">Không có thợ nào khớp bộ lọc.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTechnicians.map((tech) => (
              <TechnicianCard key={tech.id} tech={tech} onOpenImage={setLightboxUrl} />
            ))}
          </div>
        )}
      </main>

      {selectedLead && <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}
