"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lightbulb, TrendingUp, X, Trophy, Heart, Sparkles, ArrowRight } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { StudioData } from "@/lib/contentEngine";

export type Studio = StudioData & { tip: string };

// Dùng chung 1 lần tải cho cả bảng tin (thẻ chủ đề, mẹo, tổng kết) và ô soạn
// bài (gợi ý hashtag) — tránh gọi API nhiều lần trên cùng 1 trang.
const cache = new Map<string, Promise<Studio | null>>();
export function useStudio(market: "US" | "AU", role: string | undefined) {
  const key = `${market}:${role === "OWNER" ? "OWNER" : "TECHNICIAN"}`;
  const [data, setData] = useState<Studio | null>(null);
  useEffect(() => {
    let alive = true;
    if (!cache.has(key)) {
      const [m, r] = key.split(":");
      cache.set(key, fetch(`/api/studio?market=${m}&role=${r}`).then((res) => (res.ok ? res.json() : null)).catch(() => null));
    }
    cache.get(key)!.then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [key]);
  return data;
}

const STUDIO_LABEL = (
  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/90 ring-1 ring-white/15">
    <Sparkles className="h-3 w-3" /> PawNail Studio
  </span>
);

const HIDE_KEY = "pn_studio_hide";
const today = () => new Date().toISOString().slice(0, 10);

/** Thẻ "Chủ đề tuần + thử thách hashtag" đầu bảng tin. */
export function ThemeCard({ studio, isOwner, onJoin }: { studio: Studio; isOwner: boolean; onJoin: (hashtag: string) => void }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === today());
    } catch {
      setHidden(false);
    }
  }, []);
  const t = studio.theme;
  if (!t || hidden) return null;
  const c = studio.challenge;

  return (
    <section
      aria-label={`Chủ đề tuần: ${t.title}`}
      className="relative overflow-hidden rounded-2xl border border-white/10 p-4 shadow-xl shadow-black/30 sm:p-5"
      style={{ background: `linear-gradient(135deg, ${t.colors[0]}38, ${t.colors[1]}2e), #0b1020` }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 text-[120px] leading-none opacity-[0.12]">{t.emoji}</div>
      <button
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(HIDE_KEY, today());
          } catch {}
        }}
        aria-label="Ẩn chủ đề hôm nay"
        className="absolute right-2 top-2 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {STUDIO_LABEL}
          <span className="text-[11px] font-semibold text-white/60">Chủ đề tuần này</span>
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight text-white sm:text-xl">{t.emoji} {t.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-white/75">{isOwner ? t.ownerTip : t.blurb}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {t.ideas.map((idea) => (
            <span key={idea} className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white/85 ring-1 ring-white/10">{idea}</span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <button
            onClick={() => onJoin(t.hashtag)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-slate-900 shadow-lg transition-transform active:scale-95"
          >
            <Trophy className="h-3.5 w-3.5" /> Tham gia #{t.hashtag}
          </button>
          {c && c.posts > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {c.entries.map((e) => (
                  <span key={e.id} className="rounded-full ring-2 ring-[#0b1020]">
                    <Avatar src={e.author.avatarUrl} name={e.author.name} seed={e.author.id} className="h-6 w-6" />
                  </span>
                ))}
              </div>
              <span className="text-[11px] font-semibold text-white/70">{c.posts} bài đã tham gia</span>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-white/60">Chưa ai tham gia — bài đầu tiên dễ lên Top nhất!</span>
          )}
        </div>
      </div>
    </section>
  );
}

/** "Mẹo hôm nay" — chen giữa bảng tin, đổi mỗi ngày. */
export function TipCard({ tip }: { tip: string }) {
  return (
    <aside className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] to-transparent p-4">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30">
        <Lightbulb className="h-4 w-4 text-amber-300" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Mẹo hôm nay · PawNail Studio</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-200">{tip}</p>
      </div>
    </aside>
  );
}

/** Tổng kết thị trường tuần từ số liệu thật. */
export function RecapCard({ recap, market }: { recap: NonNullable<Studio["recap"]>; market: "US" | "AU" }) {
  const cur = market === "AU" ? "A$" : "$";
  return (
    <Link href="/trends" className="group block rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-slate-900/40 to-slate-900/30 p-4 transition-colors hover:border-emerald-500/40">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
        <TrendingUp className="h-3.5 w-3.5" /> Tổng kết tuần · {market === "US" ? "Mỹ" : "Úc"}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <p className="text-xl font-black text-white">{recap.newJobs}</p>
          <p className="text-[10px] text-slate-500">tin tuyển mới</p>
        </div>
        <div>
          <p className="truncate text-sm font-black text-white">{recap.topState ?? "—"}</p>
          <p className="text-[10px] text-slate-500">tuyển nhiều nhất{recap.topStateJobs ? ` (${recap.topStateJobs})` : ""}</p>
        </div>
        <div>
          <p className="text-sm font-black text-emerald-300">{recap.medianPay ? `${cur}${recap.medianPay.toLocaleString("en-US")}` : "—"}</p>
          <p className="truncate text-[10px] text-slate-500">lương tuần TB{recap.payState ? ` · ${recap.payState}` : ""}</p>
        </div>
      </div>
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
        Xem bảng xu hướng <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

/** Top bài thử thách (dùng trên trang Xu hướng). */
export function ChallengeBoard({ studio }: { studio: Studio }) {
  const t = studio.theme;
  const c = studio.challenge;
  if (!t || !c) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/15 text-pink-300"><Trophy className="h-4 w-4" /></span>
            Thử thách #{c.hashtag}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t.emoji} {t.title} · {c.posts} bài tham gia · xếp theo lượt thích thật</p>
        </div>
        <Link href="/?tab=feed" className="flex-shrink-0 text-xs font-bold text-pink-300 hover:text-pink-200">Tham gia →</Link>
      </div>
      {c.entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-400">
          Chưa có bài nào — đăng mẫu móng kèm <b className="text-pink-300">#{c.hashtag}</b> để giành Top 1 tuần này.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {c.entries.map((e, i) => (
            <Link key={e.id} href={`/profile/${e.author.id}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
              {e.image ? (
                <Image src={e.image} alt="" fill sizes="(max-width: 640px) 33vw, 260px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-4xl">{t.emoji}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-amber-300">#{i + 1}</span>
              <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="truncate text-[11px] font-bold text-white">{e.author.name}</p>
                <p className="inline-flex items-center gap-0.5 text-[10px] text-white/80"><Heart className="h-3 w-3 fill-pink-400 text-pink-400" /> {e.likes}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
