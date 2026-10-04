"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, ShieldAlert, Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { timeAgo } from "@/lib/feedFormat";
import Avatar from "@/components/ui/Avatar";

interface ReportRow {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { id: string; name: string; avatarUrl: string | null };
  reportedUser: { id: string; name: string; avatarUrl: string | null; role: string; totalReports: number };
}

// Trang kiểm duyệt báo cáo vi phạm — chỉ ADMIN (API tự chặn 401/403).
export default function AdminReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyRepeat, setOnlyRepeat] = useState(false);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể tải báo cáo.");
        setRows(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không thể tải báo cáo."));
  }, [router]);

  const visible = useMemo(
    () => (rows || []).filter((r) => !onlyRepeat || r.reportedUser.totalReports >= 2),
    [rows, onlyRepeat]
  );

  return (
    <div className="flex flex-col min-h-screen text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-24 space-y-4">
        <Link href="/admin/leads" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Lead Radar
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-white">
              <ShieldAlert className="h-6 w-6 text-amber-400" /> Báo cáo vi phạm
            </h1>
            <p className="text-sm text-slate-400">Xem xét trong 24 giờ. Gỡ bài vi phạm bằng menu ⋮ trên bài viết.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <input type="checkbox" checked={onlyRepeat} onChange={(e) => setOnlyRepeat(e.target.checked)} className="accent-pink-600" />
            Chỉ tài khoản bị báo cáo ≥ 2 lần
          </label>
        </div>

        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        {!rows && !error && (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-pink-500" /></div>
        )}
        {rows && visible.length === 0 && (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-slate-400">Không có báo cáo nào. 🎉</div>
        )}

        <ul className="space-y-2.5">
          {visible.map((r) => (
            <li key={r.id} className="glass-card rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Avatar src={r.reportedUser.avatarUrl} name={r.reportedUser.name} seed={r.reportedUser.id} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">
                    {r.reportedUser.name}{" "}
                    <span className="text-[11px] font-semibold text-slate-500">({r.reportedUser.role === "OWNER" ? "Chủ tiệm" : "Thợ"})</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Báo cáo bởi {r.reporter.name} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.reportedUser.totalReports >= 3 ? "bg-red-500/15 text-red-300 border border-red-500/30" : "bg-amber-500/10 text-amber-300 border border-amber-500/25"}`}>
                  <Flag className="mr-1 inline h-3 w-3" />{r.reportedUser.totalReports} báo cáo
                </span>
                <Link href={`/profile/${r.reportedUser.id}`} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-pink-500/50">
                  Xem hồ sơ <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="mt-3 rounded-xl bg-slate-950/50 px-3 py-2 text-sm text-slate-300 whitespace-pre-wrap break-words">{r.reason}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
