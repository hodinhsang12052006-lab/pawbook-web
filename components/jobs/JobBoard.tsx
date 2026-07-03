"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, MapPin, DollarSign, Clock, Building, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export interface JobType {
  id: string;
  title: string;
  companyName: string;
  description: string;
  salary: string;
  location: string;
  tags?: string[];
  isBoosted?: boolean;
  employerId?: string;
  createdAt: string;
}

interface JobBoardProps {
  jobs?: JobType[];
}

export default function JobBoard({ jobs: initialJobs }: JobBoardProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/jobs");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách tuyển dụng.");
      }
      const data = await res.json();
      
      // Resolve tags if stored dynamically or inject tags for display
      const resolved = data.map((j: any) => ({
        ...j,
        tags: j.tags || ["IT", "Dev", "MMO", "Fulltime"],
      }));
      setJobs(resolved);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu.");
      setJobs(initialJobs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Load active session
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSession();
  }, [initialJobs]);

  const handleApplyClick = (id: string) => {
    router.push(`/jobs/${id}`);
  };

  const handleBoostJob = async (id: string) => {
    try {
      const res = await fetch("/api/boost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "job", id }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        setJobs((prev) =>
          prev.map((job) => (job.id === id ? { ...job, isBoosted: true } : job))
        );
        if (sessionUser) {
          setSessionUser((prev: any) => ({ ...prev, pawCoin: prev.pawCoin - 500 }));
        }
      } else {
        toast.error(data.error || "Không thể đẩy top bài tuyển dụng.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 1) return "Hôm nay";
      if (diffDays === 1) return "Hôm qua";
      return `${diffDays} ngày trước`;
    } catch {
      return isoString;
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/10">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-xs text-slate-400">Đang tải bảng việc làm...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card with some stats */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 p-5 backdrop-blur-md relative overflow-hidden">
        <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-blue-500/10 blur-xl"></div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-2xs font-semibold text-blue-400 border border-blue-500/20">
              <Sparkles className="h-3 w-3 animate-pulse" />
              Nổi bật
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-100">Việc làm IT/MMO chất lượng cao</h2>
            <p className="mt-1 text-xs text-slate-400 max-w-md">
              Hệ thống tổng hợp các job Freelance, Fulltime, Parttime xịn sò nhất từ các startup công nghệ và MMO Master.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Lưu ý: Có lỗi xảy ra khi fetch dữ liệu, đang hiển thị các tin tuyển dụng lưu tạm.</span>
        </div>
      )}

      {/* Job list */}
      <div className="space-y-4">
        {jobs.map((job) => {
          const jobTags = job.tags || ["IT", "Dev", "Remote"];
          return (
            <div
              key={job.id}
              className={`rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 ${
                job.isBoosted
                  ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 hover:bg-amber-550/10 shadow-lg shadow-amber-500/5"
                  : "border-slate-800 bg-slate-900/30 hover:border-blue-500/30 hover:bg-slate-900/40"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-850 border border-slate-750 flex-shrink-0">
                      <Building className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {job.isBoosted && (
                          <span className="inline-flex items-center rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                            TÀI TRỢ
                          </span>
                        )}
                        <h3
                          onClick={() => handleApplyClick(job.id)}
                          className="text-sm font-bold text-slate-100 hover:text-blue-400 transition-colors cursor-pointer truncate"
                        >
                          {job.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{job.companyName}</p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-455">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">{job.salary}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      <span>{job.location || "Từ xa (Remote)"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>{formatTime(job.createdAt)}</span>
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs leading-relaxed text-slate-350 line-clamp-2">
                    {job.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {jobTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-lg bg-slate-850 px-2 py-0.5 text-2xs text-slate-400 border border-slate-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="sm:text-right flex items-center sm:flex-col sm:justify-center gap-2.5 self-stretch flex-shrink-0">
                  <button
                    onClick={() => handleApplyClick(job.id)}
                    className="w-full sm:w-auto rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/10 hover:bg-blue-500 transition-all duration-200"
                  >
                    Xem & Ứng tuyển
                  </button>

                  {sessionUser && sessionUser.id === job.employerId && (
                    <button
                      onClick={() => handleBoostJob(job.id)}
                      disabled={job.isBoosted}
                      className={`w-full sm:w-auto px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-all ${
                        job.isBoosted
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400 cursor-default"
                          : "bg-gradient-to-r from-amber-600 to-yellow-600 border-amber-500 hover:from-amber-550 hover:to-yellow-550 text-white shadow-md shadow-amber-500/10"
                      }`}
                    >
                      🚀 {job.isBoosted ? "Đã Đẩy Top" : "Đẩy Top (500 Coin)"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
