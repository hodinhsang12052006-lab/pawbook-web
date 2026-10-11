"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { tr } from "@/lib/i18n/tr";

export interface PollData { question: string; options: { label: string; votes: number }[]; total: number; myVote: number | null }

// Thăm dò 1 chạm: chưa bình chọn → các nút lựa chọn; đã bình chọn → thanh % chạy mượt + dấu ✓ lựa chọn của mình.
export default function PollCard({ postId, poll }: { postId: string; poll: PollData }) {
  const router = useRouter();
  const { user } = useSessionUser();
  const [p, setP] = useState(poll);
  const [busy, setBusy] = useState<number | null>(null);
  const voted = p.myVote !== null;
  const vote = async (i: number) => {
    if (!user) { router.push("/auth/register"); return; }
    if (busy !== null) return;
    setBusy(i);
    // Hiện kết quả ngay (lạc quan), đồng bộ lại theo máy chủ
    const prev = p;
    const opts = p.options.map((o, k) => ({ ...o, votes: o.votes + (k === i ? 1 : 0) - (k === p.myVote ? 1 : 0) }));
    setP({ ...p, options: opts, total: p.total + (voted ? 0 : 1), myVote: i });
    const r = await fetch(`/api/posts/${postId}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option: i }) }).catch(() => null);
    if (r?.ok) setP({ question: p.question, ...(await r.json()) });
    else setP(prev);
    setBusy(null);
  };
  return (
    <div className="mx-4 mb-3 space-y-2 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10" data-testid="poll">
      <p className="text-sm font-bold text-white">📊 {p.question}</p>
      {p.options.map((o, i) => {
        const pct = p.total ? Math.round((o.votes / p.total) * 100) : 0;
        const mine = p.myVote === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => vote(i)}
            aria-pressed={mine}
            className={`relative flex min-h-[44px] w-full items-center overflow-hidden rounded-xl px-3 text-left text-sm font-semibold ring-1 transition-colors ${mine ? "text-white ring-pink-400/60" : "text-slate-200 ring-white/10 hover:ring-white/25"}`}
          >
            {voted && <span aria-hidden className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${mine ? "bg-pink-500/30" : "bg-white/[0.07]"}`} style={{ width: `${pct}%` }} />}
            <span className="relative flex min-w-0 flex-1 items-center gap-2">
              {busy === i ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : mine ? <Check className="h-4 w-4 shrink-0 text-pink-300" /> : null}
              <span className="truncate">{o.label}</span>
            </span>
            {voted && <span className="relative ml-2 shrink-0 text-xs font-black tabular-nums">{pct}%</span>}
          </button>
        );
      })}
      <p className="text-[11px] text-slate-500">
        {p.total ? tr(`${p.total} người đã bình chọn`, `${p.total} votes`) : tr("Hãy là người bình chọn đầu tiên", "Be the first to vote")}
        {voted ? tr(" · bấm lựa chọn khác để đổi", " · tap another option to change") : ""}
      </p>
    </div>
  );
}
