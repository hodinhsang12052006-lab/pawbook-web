"use client";

import React, { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import { Loader2, Briefcase, MessageSquare, FileText, GripVertical } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface ApplicationCard {
  id: string;
  status: string;
  cvUrl: string;
  createdAt: string;
  applicant: { id: string; name: string; avatarUrl: string | null; bio: string | null; skills: string | null };
  job: { id: string; title: string; companyName: string };
}

// Canonical Kanban stages. Legacy statuses from the old (non-Kanban)
// hr-management table — PENDING (self-apply default) and APPROVED (its
// "accept" action) — are folded into the nearest equivalent column here so
// both flows (formal applications AND swipe-matches) show up on one board,
// without touching that page's own logic/strings.
const COLUMNS: { key: string; label: string; statuses: string[]; accent: string }[] = [
  { key: "MATCHED", label: "Mới Match", statuses: ["MATCHED", "PENDING"], accent: "border-blue-500/40 bg-blue-500/5" },
  { key: "INTERVIEW", label: "Phỏng Vấn", statuses: ["INTERVIEW"], accent: "border-amber-500/40 bg-amber-500/5" },
  { key: "HIRED", label: "Đã Tuyển", statuses: ["HIRED", "APPROVED"], accent: "border-emerald-500/40 bg-emerald-500/5" },
  { key: "REJECTED", label: "Từ Chối", statuses: ["REJECTED"], accent: "border-rose-500/40 bg-rose-500/5" },
];

export default function HrDashboardPage() {
  const [applications, setApplications] = useState<ApplicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/applications");
      if (res.status === 401) {
        toast.error("Vui lòng đăng nhập với tài khoản nhà tuyển dụng.");
        return;
      }
      if (res.ok) {
        setApplications(await res.json());
      }
    } catch (err) {
      console.error("Failed to load applications for HR dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const moveApplication = async (id: string, targetColumnKey: string) => {
    const prev = applications;
    setApplications((cur) => cur.map((a) => (a.id === id ? { ...a, status: targetColumnKey } : a)));

    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetColumnKey }),
    });

    if (!res.ok) {
      setApplications(prev); // Roll back the optimistic move on failure
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Không thể cập nhật trạng thái.");
    }
  };

  const handleDrop = (columnKey: string) => {
    setDragOverColumn(null);
    if (!draggingId) return;
    const app = applications.find((a) => a.id === draggingId);
    setDraggingId(null);
    if (!app) return;
    const column = COLUMNS.find((c) => c.key === columnKey);
    if (column && column.statuses.includes(app.status)) return; // already in this column
    moveApplication(draggingId, columnKey);
  };

  const columnCards = (column: typeof COLUMNS[number]) =>
    applications.filter((a) => column.statuses.includes(a.status));

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Navbar />
      <Toaster position="top-center" />

      <main className="flex-1 w-full overflow-hidden flex flex-col p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 flex-none">
          <div>
            <h1 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <Briefcase className="h-4.5 w-4.5 text-blue-500" />
              HR Dashboard — Applicant Tracking
            </h1>
            <p className="text-4xs text-slate-500 mt-0.5">Kéo thả thẻ ứng viên giữa các cột để cập nhật trạng thái tuyển dụng.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-3xs font-bold">Đang tải danh sách ứng viên...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-4 h-full min-w-[900px]">
              {COLUMNS.map((column) => {
                const cards = columnCards(column);
                return (
                  <div
                    key={column.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn(column.key);
                    }}
                    onDragLeave={() => setDragOverColumn((cur) => (cur === column.key ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(column.key);
                    }}
                    className={`flex-1 min-w-[220px] flex flex-col rounded-2xl border ${column.accent} transition-colors ${dragOverColumn === column.key ? "ring-2 ring-blue-500/60" : ""}`}
                  >
                    <div className="p-3 border-b border-slate-800/60 flex items-center justify-between flex-none">
                      <h2 className="text-3xs font-black uppercase tracking-wider text-slate-200">{column.label}</h2>
                      <span className="text-4xs font-bold text-slate-500 bg-slate-900/80 border border-slate-800 rounded-full px-2 py-0.5">{cards.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      {cards.length === 0 ? (
                        <p className="text-4xs text-slate-600 text-center py-6 italic">Chưa có ứng viên nào</p>
                      ) : (
                        cards.map((app) => (
                          <div
                            key={app.id}
                            draggable
                            onDragStart={() => setDraggingId(app.id)}
                            onDragEnd={() => setDraggingId(null)}
                            className={`bg-slate-900 border border-slate-800 rounded-xl p-3 cursor-grab active:cursor-grabbing shadow-md hover:border-slate-700 transition-all ${draggingId === app.id ? "opacity-40" : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-3.5 w-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
                              <img
                                src={app.applicant.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.applicant.name)}&background=2563eb&color=ffffff&bold=true`}
                                alt={app.applicant.name}
                                className="h-8 w-8 rounded-full object-cover border border-slate-800 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-3xs font-bold text-slate-200 truncate">{app.applicant.name}</p>
                                <p className="text-4xs text-slate-500 truncate">{app.job.title}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-850/60">
                              <span className="text-[9px] text-slate-600">
                                {new Date(app.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                              </span>
                              <div className="flex items-center gap-2">
                                {app.cvUrl && app.cvUrl !== "Chưa cập nhật CV" && (
                                  <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" title="Xem CV" className="text-slate-500 hover:text-blue-400">
                                    <FileText className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                <a href={`/messages?to=${app.applicant.id}`} title="Nhắn tin" className="text-slate-500 hover:text-emerald-400">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
