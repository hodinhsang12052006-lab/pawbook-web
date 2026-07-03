"use client";

import React, { useState, useEffect } from "react";
import { Brain, DollarSign, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AiSuggest() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [userSkills, setUserSkills] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSuggestions() {
      try {
        setLoading(true);
        const res = await fetch("/api/ai-suggest");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
          setUserSkills(data.userSkills || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/10">
        <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
        <p className="text-2xs text-slate-400">Bot AI đang so khớp hồ sơ kỹ năng của bạn...</p>
      </div>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Suggestion header bar */}
      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Brain className="h-4.5 w-4.5 text-emerald-400" />
          <span>AI Đề Xuất: Việc làm phù hợp nhất</span>
        </h3>
        <span className="text-3xs text-slate-500 max-w-[200px] text-right hidden sm:block truncate">
          Kỹ năng phân tích: <span className="text-slate-350 font-semibold">{userSkills}</span>
        </span>
      </div>

      {/* Matching result cards layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => router.push(`/jobs/${job.id}`)}
            className="group cursor-pointer rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/40 via-[#0a0f1d]/40 to-[#0e1a35]/40 p-5 hover:border-emerald-500/30 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
          >
            {/* Glowing match score badge */}
            <div className="absolute right-4 top-4 z-10">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-3xs font-extrabold text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/10 animate-pulse">
                🌟 {job.matchScore}% Match
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <h4 className="text-4xs font-bold text-slate-500 uppercase tracking-wider truncate pr-16">{job.companyName}</h4>
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-emerald-450 transition-colors line-clamp-1 pr-16">
                  {job.title}
                </h3>
              </div>

              <p className="text-3xs leading-relaxed text-slate-400 line-clamp-2">
                {job.description}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-850/60 pt-3 mt-4">
              <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                <DollarSign className="h-3.5 w-3.5" />
                {job.salary}
              </span>
              <span className="flex items-center gap-1 text-3xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
                Xem chi tiết
                <ArrowRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
