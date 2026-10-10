"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bot, Check, Copy, Loader2, Pin, Send, CalendarClock } from "lucide-react";
import { PILLAR_LABEL, type BotDraft } from "@/lib/contentBot";

// Bot nội dung trong Phòng nội dung: đề xuất bài cho tài khoản chính thức mỗi
// ngày (thuế, tip, an toàn, sức khoẻ, tay nghề, quản lý tiệm, xu hướng). Admin
// đọc, sửa nếu cần, rồi bấm đăng — bot KHÔNG tự đăng.
const AUD: Record<BotDraft["audience"], string> = { tech: "Cho thợ", owner: "Cho chủ tiệm", all: "Thợ & chủ tiệm" };

export default function ContentBot() {
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [drafts, setDrafts] = useState<BotDraft[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [posted, setPosted] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setDrafts(null);
    fetch(`/api/admin/contentbot?market=${market}`)
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d) => setDrafts(d.drafts || []))
      .catch(() => setDrafts([]));
  }, [market]);
  useEffect(load, [load]);

  const publish = async (d: BotDraft) => {
    const content = (edits[d.id] ?? d.text).trim();
    if (!confirm("Đăng bài này lên bảng tin + hồ sơ PawNail Jobs?")) return;
    setBusy(d.id);
    const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, postType: "GENERAL", mediaUrls: [] }) });
    const r = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(r.error || "Không đăng được.");
    toast.success("Đã đăng lên hồ sơ chính thức.");
    setPosted((s) => new Set(s).add(d.id));
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Đã sao chép caption — dán lên Facebook / TikTok.");
    } catch {}
  };

  return (
    <section id="bot-noi-dung" aria-label="Bot nội dung" className="scroll-mt-24 space-y-4 rounded-2xl border border-sky-500/25 bg-sky-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-white"><Bot className="h-5 w-5 text-sky-300" /> Bot nội dung PawNail</h2>
          <p className="text-xs text-slate-400">Bài soạn sẵn cho tài khoản chính thức: thuế & tip, an toàn, sức khoẻ thợ, tay nghề, quản lý tiệm, xu hướng — ưu tiên chủ đề đúng thời điểm (hạn thuế, mùa lễ). Đọc kỹ, sửa nếu cần rồi mới đăng.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
          {(["US", "AU"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={market === m} onClick={() => setMarket(m)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${market === m ? "bg-sky-500/25 text-sky-100" : "text-slate-400"}`}>{m === "US" ? "🇺🇸 Mỹ" : "🇦🇺 Úc"}</button>
          ))}
        </div>
      </div>

      {drafts === null ? (
        <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Đang soạn bài…</div>
      ) : drafts.length === 0 ? (
        <p className="text-xs text-slate-500">Hôm nay đã đăng hết bài đề xuất — mai bot soạn tiếp.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {drafts.map((d) => {
            const done = posted.has(d.id);
            return (
              <article key={d.id} aria-label={`Bài bot: ${d.title}`} className="space-y-2.5 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-200">{PILLAR_LABEL[d.pillar]}</span>
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-400">{AUD[d.audience]}</span>
                  {d.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200"><Pin className="h-3 w-3" /> Bài ghim</span>}
                  {d.seasonal && <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2 py-0.5 text-pink-200"><CalendarClock className="h-3 w-3" /> Đúng thời điểm</span>}
                </div>
                <textarea
                  aria-label="Nội dung bài"
                  value={edits[d.id] ?? d.text}
                  onChange={(e) => setEdits((x) => ({ ...x, [d.id]: e.target.value }))}
                  rows={9}
                  disabled={done}
                  className="w-full resize-y rounded-lg bg-slate-900/80 p-2.5 text-xs leading-relaxed text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-sky-500/60 disabled:opacity-60"
                />
                {!!d.sources.length && (
                  <p className="text-[11px] text-slate-500">Kiểm chứng: {d.sources.map((s, i) => <React.Fragment key={s.url}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">{s.label}</a></React.Fragment>)}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={done || busy === d.id} onClick={() => publish(d)} className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-sky-600 text-xs font-black text-white disabled:opacity-50">
                    {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />} {done ? "Đã đăng" : "Đăng lên hồ sơ chính thức"}
                  </button>
                  <button type="button" onClick={() => copy(d.caption)} className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] text-xs font-bold text-slate-200 ring-1 ring-white/10">
                    <Copy className="h-4 w-4" /> Sao chép caption
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
