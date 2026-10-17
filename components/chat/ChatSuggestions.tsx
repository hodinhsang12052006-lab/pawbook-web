"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronRight, Megaphone, Sparkles } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Danh sách chat còn ít cuộc trò chuyện → không để khoảng trống: gợi ý bằng DỮ LIỆU THẬT
// (thợ: tiệm đang tuyển mới nhất · chủ tiệm: thợ đang tìm việc, chưa có thì mời đăng tin).
interface Job { id: string; salonName: string; city: string | null; state: string | null; salaryAmount: string | null; isUrgent?: boolean }
interface Tech { user?: { id: string; name: string; avatarUrl: string | null }; city?: string | null; state?: string | null; specialties?: string | string[] }

export default function ChatSuggestions({ role, market }: { role: string | null; market: string | null }) {
  useTr();
  const owner = role === "OWNER";
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [techs, setTechs] = useState<Tech[] | null>(null);
  const m = market === "AU" ? "AU" : "US";
  useEffect(() => {
    if (owner) fetch(`/api/technicians?market=${m}`).then((r) => (r.ok ? r.json() : [])).then((d) => setTechs((Array.isArray(d) ? d : []).slice(0, 3))).catch(() => setTechs([]));
    else fetch(`/api/jobs?market=${m}&page=1&pageSize=5`).then((r) => (r.ok ? r.json() : [])).then((d) => setJobs((Array.isArray(d) ? d : []).slice(0, 3))).catch(() => setJobs([]));
  }, [owner, m]);

  const head = (
    <p className="flex items-center gap-1.5 px-2 pb-2 pt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
      <Sparkles className="h-3.5 w-3.5 text-pink-300" />{tr("Gợi ý cho bạn", "Suggested for you")}
    </p>
  );
  const card = "flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.07]";

  if (owner) {
    if (techs === null) return null;
    return (
      <section aria-label={tr("Gợi ý cho bạn", "Suggested for you")}>
        {head}
        <div className="space-y-2">
          {techs.map((t) => t.user && (
            <Link key={t.user.id} href={`/profile/${t.user.id}`} className={card}>
              <Avatar src={t.user.avatarUrl} name={t.user.name} seed={t.user.id} className="h-10 w-10" alt="" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{t.user.name}</span>
                <span className="block truncate text-xs text-slate-400">{tr("Thợ đang tìm việc", "Tech looking for work")}{t.city || t.state ? ` · ${t.city || t.state}` : ""}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </Link>
          ))}
          <Link href="/jobs/create" className={`${card} bg-gradient-to-r from-pink-500/15 to-fuchsia-500/10 ring-pink-500/25`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600"><Megaphone className="h-5 w-5 text-white" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{tr("Đăng tin tuyển thợ", "Post a job")}</span>
              <span className="block truncate text-xs text-slate-300">{tr("Thợ bật báo việc gần bạn sẽ nhắn bạn ngay", "Nearby techs with alerts will message you")}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-pink-200" />
          </Link>
        </div>
      </section>
    );
  }

  if (!jobs || jobs.length === 0) return null;
  return (
    <section aria-label={tr("Gợi ý cho bạn", "Suggested for you")}>
      {head}
      <div className="space-y-2">
        {jobs.map((j) => (
          <Link key={j.id} href={`/jobs/${j.id}`} className={card}>
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/25 to-violet-500/25 ring-1 ring-white/10"><Briefcase className="h-5 w-5 text-pink-200" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                <span className="truncate">{j.salonName}</span>
                {j.isUrgent && <span className="flex-shrink-0 rounded-full bg-rose-500/20 px-1.5 text-[10px] font-black text-rose-200">{tr("Gấp", "Urgent")}</span>}
              </span>
              <span className="block truncate text-xs text-slate-400">{[j.city, j.state].filter(Boolean).join(", ")}{j.salaryAmount && j.salaryAmount !== "Thỏa thuận" ? ` · ${j.salaryAmount}` : ""}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </Link>
        ))}
        <Link href="/?tab=jobs" className="block px-2 pt-1 text-xs font-bold text-pink-300 hover:underline">{tr("Xem tất cả việc đang tuyển →", "See all open jobs →")}</Link>
      </div>
    </section>
  );
}
