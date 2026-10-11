"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";

interface Pending { id: string; content: string; createdAt: string; state: string | null; role: string }

// Admin → Studio: duyệt "Tâm sự ẩn danh" (chặn bôi nhọ tên tiệm / tên người, thông tin riêng).
export default function AnonReview() {
  const [list, setList] = useState<Pending[] | null>(null);
  const load = useCallback(() => { fetch("/api/admin/anon").then((r) => (r.ok ? r.json() : null)).then((j) => setList(j?.pending ?? [])).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (postId: string, decision: "approve" | "reject") => {
    const r = await fetch("/api/admin/anon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, decision }) });
    if (!r.ok) { toast.error("Chưa xử lý được."); return; }
    toast.success(decision === "approve" ? "Đã đăng lên bảng tin" : "Đã từ chối");
    load();
  };
  if (!list || !list.length) return null;
  return (
    <section id="tam-su" className="glass-card scroll-mt-24 space-y-3 rounded-2xl p-4" data-testid="anon-review">
      <h2 className="text-sm font-black text-white">🤫 Tâm sự ẩn danh chờ duyệt ({list.length})</h2>
      <p className="text-xs text-slate-400">Từ chối nếu nêu tên tiệm / tên người / SĐT, bôi nhọ, hoặc lộ thông tin riêng. Người gửi được báo kết quả.</p>
      {list.map((p) => (
        <div key={p.id} className="space-y-2 rounded-xl bg-slate-950/60 p-3 ring-1 ring-white/10">
          <p className="text-[11px] text-slate-500">{p.role === "OWNER" ? "Chủ tiệm" : "Thợ"}{p.state ? ` · ${p.state}` : ""} · {new Date(p.createdAt).toLocaleString("vi-VN")}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-200">{p.content}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => decide(p.id, "approve")} className="flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white"><Check className="h-4 w-4" /> Đăng</button>
            <button type="button" onClick={() => decide(p.id, "reject")} className="flex min-h-[36px] items-center gap-1 rounded-lg bg-white/[0.06] px-3 text-xs font-bold text-slate-300"><X className="h-4 w-4" /> Từ chối</button>
          </div>
        </div>
      ))}
    </section>
  );
}
