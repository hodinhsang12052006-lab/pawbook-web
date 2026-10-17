"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, DollarSign, Flame, MapPin, MessageCircle, Phone, Sparkles } from "lucide-react";
import type { JobType } from "@/components/jobs/JobBoard";
import { trackJobContact, trackJobView } from "@/lib/viewTracker";
import { placeLabel } from "@/lib/stateNames";
import { timeAgo } from "@/lib/feedFormat";
import { dt } from "@/lib/i18n/dataEn";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { valueLabel } from "@/lib/i18n/valueLabel";

const PRESS = "active:scale-95 transition-transform duration-100";
const NEW_MS = 24 * 3600_000;

// Tin tuyển thợ THẬT chen giữa bảng tin (thợ lướt bảng tin là thấy việc, khỏi phải
// chuyển tab). Cùng nút gọi / chi tiết / nhắn tin như thẻ ở tab Việc gấp.
export default function JobFeedCard({ job }: { job: JobType }) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => trackJobView(ref.current, job.id), [job.id]);
  const isNew = Date.now() - new Date(job.createdAt).getTime() < NEW_MS;
  const place = placeLabel(job.city, job.market, job.state);
  const desc = (job.description || "").replace(/\s+/g, " ").trim();

  return (
    <article ref={ref} className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-slate-900/40 to-slate-900/30">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Briefcase className="h-5 w-5 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{job.salonName}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
            {place && <><MapPin className="h-3 w-3 flex-shrink-0" />{place} · </>}
            {timeAgo(job.createdAt)}
          </p>
        </div>
        {job.isUrgent ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-black text-red-300">
            <Flame className="h-3 w-3" />{tr("Gấp", "Urgent")}
          </span>
        ) : isNew ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-black text-sky-300">
            <Sparkles className="h-3 w-3" />{tr("Mới", "New")}
          </span>
        ) : (
          <span className="flex-shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-300">{tr("Tuyển thợ", "Hiring")}</span>
        )}
      </div>

      <Link href={`/jobs/${job.id}`} className="block space-y-2.5 px-4 py-3">
        <h3 className="text-[17px] font-black leading-snug text-white">{dt(job.title)}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {/\d/.test(job.salaryAmount || "") ? (
            <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-1 pl-2 pr-2.5 shadow-lg shadow-emerald-500/20">
              <DollarSign className="h-4 w-4 text-emerald-950" />
              <span className="text-base font-black leading-none text-emerald-950">{dt(job.salaryAmount)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200">{tr("Lương thỏa thuận", "Pay negotiable")}</span>
          )}
          {job.skills.slice(0, 3).map((s) => (
            <span key={s} className="rounded-lg border border-pink-500/25 bg-pink-500/10 px-2 py-0.5 text-[11px] font-bold text-pink-200">{valueLabel(s)}</span>
          ))}
        </div>
        {desc && <p className="line-clamp-2 text-sm leading-relaxed text-slate-300">{desc}</p>}
        {job.source === "ingest" && <p className="text-[11px] text-slate-500">{tr("PawNail đăng hộ tiệm — gọi thẳng cho tiệm", "Posted by PawNail for the salon — call the salon directly")}</p>}
      </Link>

      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
        <a
          href={`tel:${job.phone}`}
          onClick={() => trackJobContact(job.id)}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-600 ${PRESS}`}
        >
          <Phone className="h-4 w-4" />{tr("Gọi ngay", "Call now")}
        </a>
        {job.source === "ingest" ? (
          <Link href={`/jobs/${job.id}`} className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-100 hover:bg-slate-700 ${PRESS}`}>
            <MapPin className="h-4 w-4" />{tr("Chi tiết", "Details")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => { trackJobContact(job.id); router.push(`/messages?to=${job.ownerId}`); }}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-100 hover:bg-slate-700 ${PRESS}`}
          >
            <MessageCircle className="h-4 w-4" />{tr("Nhắn tin", "Message")}
          </button>
        )}
      </div>
    </article>
  );
}
