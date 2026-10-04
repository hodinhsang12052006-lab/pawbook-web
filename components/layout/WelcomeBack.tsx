"use client";

import React, { useEffect, useState } from "react";
import { X, Flame, Heart, MessageCircle, Bookmark, Sparkles, type LucideIcon } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { stateName } from "@/lib/stateNames";
import { timeAgo } from "@/lib/feedFormat";

interface Digest {
  since: string;
  state: string | null;
  market: "US" | "AU" | null;
  newJobs: number;
  likes: number;
  comments: number;
  saves: number;
  newTechs: number;
}

// "Từ lần trước bạn ghé…" — người dùng quay lại sau ≥4 giờ thấy ngay những gì
// đã THẬT SỰ xảy ra trong lúc vắng mặt (đếm từ dữ liệu thật). Cảm giác "có
// chuyện mới đang chờ mình" là lý do mạnh nhất để mở app thường xuyên.
const KEY = "pn_last_visit";
const MIN_GAP_MS = 4 * 60 * 60 * 1000;

export default function WelcomeBack({ onGoTab }: { onGoTab: (tab: "feed" | "jobs" | "portfolio") => void }) {
  const { user } = useSessionUser();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = `${KEY}_${user.id}`;
    let last = 0;
    try {
      last = Number(localStorage.getItem(key) || 0);
    } catch {}
    const now = Date.now();
    if (!last) {
      try {
        localStorage.setItem(key, String(now));
      } catch {}
      return;
    }
    if (now - last < MIN_GAP_MS) return;
    try {
      localStorage.setItem(key, String(now));
    } catch {}
    fetch(`/api/home/digest?since=${encodeURIComponent(new Date(last).toISOString())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Digest | null) => d && setDigest(d))
      .catch(() => {});
  }, [user?.id]);

  if (!digest || closed) return null;
  const area = digest.state ? stateName(digest.market ?? "US", digest.state) || digest.state : digest.market === "AU" ? "Úc" : "Mỹ";
  const items: { icon: LucideIcon; text: string; tone: string; tab: "feed" | "jobs" | "portfolio" }[] = [];
  if (digest.newJobs) items.push({ icon: Flame, text: `${digest.newJobs} tin tuyển mới tại ${area}`, tone: "text-orange-300 bg-orange-500/10 ring-orange-500/25", tab: "jobs" });
  if (digest.newTechs) items.push({ icon: Sparkles, text: `${digest.newTechs} thợ đang sẵn sàng tại ${area}`, tone: "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/25", tab: "portfolio" });
  if (digest.likes) items.push({ icon: Heart, text: `${digest.likes} lượt thích bài của bạn`, tone: "text-pink-300 bg-pink-500/10 ring-pink-500/25", tab: "feed" });
  if (digest.comments) items.push({ icon: MessageCircle, text: `${digest.comments} bình luận mới`, tone: "text-sky-300 bg-sky-500/10 ring-sky-500/25", tab: "feed" });
  if (digest.saves) items.push({ icon: Bookmark, text: `${digest.saves} thợ đã lưu tin của bạn`, tone: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/25", tab: "jobs" });
  if (items.length === 0) return null;

  return (
    <section aria-label="Có gì mới từ lần trước" className="relative animate-fadeIn rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/50 p-4">
      <button onClick={() => setClosed(true)} aria-label="Đóng" className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">
        <X className="h-4 w-4" />
      </button>
      <p className="text-sm font-black text-white">Có gì mới từ lần trước bạn ghé 👋</p>
      <p className="text-[11px] text-slate-500">Lần trước: {timeAgo(digest.since)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => (
          <button
            key={it.text}
            onClick={() => {
              setClosed(true);
              onGoTab(it.tab);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition-transform active:scale-95 ${it.tone}`}
          >
            <it.icon className="h-3.5 w-3.5" /> {it.text}
          </button>
        ))}
      </div>
    </section>
  );
}
