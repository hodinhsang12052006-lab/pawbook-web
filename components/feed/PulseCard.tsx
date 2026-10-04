"use client";

import React, { useEffect, useState } from "react";
import { Activity, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { playSound } from "@/lib/sounds";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface PulseOptionResult { id: string; label: string; votes: number; pct: number }
interface PulseResults { total: number; published: boolean; options: PulseOptionResult[]; scope: string | null }
interface PulseData {
  week?: string;
  question: { id: string; text: string; options: { id: string; label: string }[] } | null;
  myVote?: string | null;
  results?: PulseResults | null;
  localResults?: PulseResults | null;
}

// "Nhịp đau tuần" — 1 câu hỏi/tuần, bấm 1 lần. Trả lời xong mới thấy kết quả
// (để không bị số đông "lái"). Kết quả gộp lại thành nội dung PawNail Studio.
export default function PulseCard() {
  useTr(); // render lại khi đổi VI/EN
  const [data, setData] = useState<PulseData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pulse").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);

  if (!data?.question) return null;
  const q = data.question;

  const vote = async (option: string) => {
    if (busy || data.myVote) return;
    setBusy(option);
    try {
      const res = await fetch("/api/pulse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option }) });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || tr("Không ghi nhận được.", "Couldn't record your answer."));
      setData(next);
      playSound("success");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không ghi nhận được.", "Couldn't record your answer."));
    } finally {
      setBusy(null);
    }
  };

  const shown = data.localResults ?? data.results;
  return (
    <section aria-label="Nhịp đau tuần" className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.08] via-slate-900/60 to-slate-900/40 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-300">
        <Activity className="h-3.5 w-3.5" />{tr(" Nhịp đau tuần · 1 chạm, ẩn danh", " Weekly pulse · one tap, anonymous")}
      </p>
      <h3 className="mt-1.5 text-[15px] font-black leading-snug text-white">{q.text}</h3>

      {!data.myVote ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {q.options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={!!busy}
              onClick={() => vote(o.id)}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-950/60 px-2.5 py-2 text-center text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition-all hover:ring-sky-400/50 active:scale-95 disabled:opacity-60"
            >
              {busy === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {shown && shown.published ? (
            shown.options.map((o) => {
              const mine = o.id === data.myVote;
              return (
                <div key={o.id} className="relative overflow-hidden rounded-xl bg-slate-950/60 ring-1 ring-white/5">
                  <span aria-hidden className={`absolute inset-y-0 left-0 ${mine ? "bg-sky-500/30" : "bg-white/[0.06]"}`} style={{ width: `${o.pct}%` }} />
                  <div className="relative flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className={`flex items-center gap-1.5 ${mine ? "font-bold text-white" : "text-slate-300"}`}>
                      {mine && <CheckCircle2 className="h-3.5 w-3.5 text-sky-300" />} {o.label}
                    </span>
                    <span className="font-bold tabular-nums text-slate-200">{o.pct}%</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-slate-950/50 px-3 py-2.5 text-xs text-slate-300 ring-1 ring-white/5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-sky-300" />
              {tr("Đã ghi nhận! Kết quả hiện khi đủ người trả lời — bạn là một trong những người đầu tiên.", "Recorded! Results appear once enough people answer — you're one of the first.")}
            </p>
          )}
          {shown?.published && (
            <p className="text-[11px] text-slate-500">
              {shown.total}{tr(" người trả lời", " responses")}{shown.scope ? tr(` tại bang của bạn`, ` in your state`) : ""}{tr(" · kết quả tổng hợp lên bảng Xu hướng mỗi tuần", " · results go to the weekly Trends page")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
