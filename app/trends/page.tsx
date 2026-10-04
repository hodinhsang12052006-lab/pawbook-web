"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Avatar from "@/components/ui/Avatar";
import { useSessionUser } from "@/lib/SessionUserContext";
import type { TrendsData } from "@/lib/trends";
import { useStudio, ChallengeBoard } from "@/components/feed/StudioCards";
import {
  TrendingUp, Flame, Heart, MessageCircle, Eye, Hash, DollarSign, Star, Users, Crown, Sparkles, ArrowRight, Activity,
} from "lucide-react";

const money = (n: number, market: "US" | "AU") => `${market === "AU" ? "A$" : "$"}${n.toLocaleString("en-US")}`;

function Section({ icon: Icon, title, hint, tone, children }: { icon: typeof Star; title: string; hint?: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-white">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
            {title}
          </h2>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-[4/5] rounded-2xl" />)}</div>
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  );
}

export default function TrendsPage() {
  const { user } = useSessionUser();
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [data, setData] = useState<TrendsData | null>(null);
  const [error, setError] = useState(false);
  const studio = useStudio(market, user?.role);

  useEffect(() => {
    if (user?.market === "AU") setMarket("AU");
  }, [user?.market]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    fetch(`/api/trends?market=${market}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [market]);

  const empty = data && !studio?.challenge && !data.pulse.length && !data.hotPosts.length && !data.hashtags.length && !data.salaries.length && !data.risingTechs.length;

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-7 px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        {/* ===== HERO ===== */}
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-950/70 via-slate-950 to-orange-950/40 p-5 sm:p-7">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-pink-600/25 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-pink-200 ring-1 ring-white/10">
                <Activity className="h-3.5 w-3.5" /> Dữ liệu thật từ cộng đồng PawNail
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Xu hướng tuần này</h1>
              <p className="mt-1 max-w-md text-sm text-slate-400">Mẫu móng được thả tim nhiều nhất, thợ nổi bật, lương theo bang và nơi đang tuyển nhiều nhất.</p>
            </div>
            <div className="flex rounded-xl bg-slate-950/60 p-1 ring-1 ring-white/10" role="tablist" aria-label="Thị trường">
              {(["US", "AU"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={market === m}
                  onClick={() => setMarket(m)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${market === m ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
                >
                  {m === "US" ? "🇺🇸 Mỹ" : "🇦🇺 Úc"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {studio?.challenge && <ChallengeBoard studio={studio} />}

        {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Không tải được xu hướng. Vui lòng thử lại sau.</p>}
        {!data && !error && <Skeleton />}

        {empty && (
          <div className="rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-pink-300" />
            <p className="mt-3 text-base font-bold text-white">Tuần này chưa đủ dữ liệu để xếp hạng</p>
            <p className="mt-1 text-sm text-slate-500">Hãy là người mở màn — đăng mẫu móng đẹp nhất của bạn lên bảng tin.</p>
            <Link href="/?tab=feed" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white">
              Đăng bài ngay <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {data && data.pulse.length > 0 && (
          <Section icon={Flame} title="Nơi đang tuyển nhiều nhất" hint="Tin tuyển mới trong 7 ngày qua" tone="bg-orange-500/15 text-orange-300">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.pulse.map((p, i) => (
                <Link
                  key={p.state}
                  href="/?tab=jobs"
                  className={`glass-card group relative overflow-hidden rounded-2xl p-4 transition-colors hover:border-orange-500/40 ${i === 0 ? "ring-1 ring-orange-500/30" : ""}`}
                >
                  {i === 0 && <span className="absolute right-3 top-3 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black text-orange-300">#1</span>}
                  <p className="text-sm font-bold text-slate-200">{p.label}</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-white">{p.newJobs}</p>
                  <p className="text-[11px] font-semibold text-slate-500">tin mới</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {p.urgentJobs > 0 && <span className="font-bold text-orange-300">🔥 {p.urgentJobs} gấp</span>}
                    {p.availableTechs > 0 && <span className="text-slate-400">{p.availableTechs} thợ sẵn sàng</span>}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {data && data.hotPosts.length > 0 && (
          <Section icon={Heart} title="Mẫu móng hot" hint="Xếp theo lượt thích, bình luận và lượt xem thật · 14 ngày" tone="bg-pink-500/15 text-pink-300">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {data.hotPosts.map((p, i) => (
                <Link key={p.id} href={`/profile/${p.author.id}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
                  <Image src={p.image} alt="" fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  {i < 3 && (
                    <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-black text-amber-300 backdrop-blur">
                      <Crown className="h-3 w-3" /> Top {i + 1}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Avatar src={p.author.avatarUrl} name={p.author.name} seed={p.author.id} className="h-6 w-6 ring-1 ring-white/30" />
                      <span className="truncate text-xs font-bold text-white">{p.author.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] font-semibold text-white/85">
                      <span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3 fill-pink-400 text-pink-400" /> {p.likes}</span>
                      {p.comments > 0 && <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {p.comments}</span>}
                      {p.views >= 5 && <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" /> {p.views}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {data && data.hashtags.length > 0 && (
          <Section icon={Hash} title="Hashtag đang lên" hint="Số bài đăng có hashtag trong 14 ngày" tone="bg-sky-500/15 text-sky-300">
            <div className="flex flex-wrap gap-2">
              {data.hashtags.map((t, i) => (
                <span
                  key={t.tag}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ring-1 ${i < 3 ? "bg-sky-500/15 text-sky-100 ring-sky-400/30" : "bg-white/[0.04] text-slate-300 ring-white/10"}`}
                >
                  #{t.tag} <span className="text-[11px] font-semibold text-slate-400">{t.count} bài</span>
                </span>
              ))}
            </div>
          </Section>
        )}

        {data && data.risingTechs.length > 0 && (
          <Section icon={Star} title="Thợ nổi bật" hint="Theo lượt thích 30 ngày và đánh giá thật từ chủ tiệm" tone="bg-amber-500/15 text-amber-300">
            <div className="glass-card divide-y divide-white/5 overflow-hidden rounded-2xl">
              {data.risingTechs.map((t, i) => (
                <Link key={t.id} href={`/profile/${t.id}`} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-white/[0.03]">
                  <span className={`w-6 text-center text-sm font-black ${i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-300" : "text-slate-600"}`}>{i + 1}</span>
                  <Avatar src={t.avatarUrl} name={t.name} seed={t.id} className="h-11 w-11 ring-1 ring-white/10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{t.name}</p>
                    <p className="truncate text-xs text-slate-500">{[t.specialty, `${t.city}, ${t.state}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-[11px] font-semibold">
                    {t.rating !== null && <span className="inline-flex items-center gap-0.5 text-amber-300"><Star className="h-3 w-3 fill-amber-300" /> {t.rating.toFixed(1)} ({t.reviews})</span>}
                    {t.likes > 0 && <span className="inline-flex items-center gap-0.5 text-pink-300"><Heart className="h-3 w-3 fill-pink-300" /> {t.likes}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {data && data.salaries.length > 0 && (
          <Section icon={DollarSign} title="Lương tuần theo bang" hint="Từ tin tuyển thật có ghi lương tuần (cần ≥3 tin/bang)" tone="bg-emerald-500/15 text-emerald-300">
            <div className="glass-card overflow-hidden rounded-2xl">
              {data.salaries.map((s) => {
                const max = data.salaries[0].high || 1;
                return (
                  <div key={s.state} className="grid grid-cols-[minmax(90px,1fr)_2fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-100">{s.label}</p>
                      <p className="text-[10px] text-slate-500">{s.jobs} tin</p>
                    </div>
                    <div className="relative h-2 rounded-full bg-white/[0.05]">
                      <span
                        className="absolute h-2 rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-300"
                        style={{ left: `${(s.low / max) * 100}%`, width: `${Math.max(3, ((s.high - s.low) / max) * 100)}%` }}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-300">{money(s.median, data.market)}</p>
                      <p className="text-[10px] text-slate-500">{money(s.low, data.market)}–{money(s.high, data.market)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {data && !empty && (
          <Link
            href="/?tab=feed"
            className="flex items-center gap-4 rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-600/15 via-fuchsia-600/10 to-transparent p-4 transition-colors hover:border-pink-500/50"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-pink-600/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-black text-white">Muốn lên bảng tuần sau?</span>
              <span className="block text-xs text-slate-400">Đăng mẫu móng đẹp nhất kèm hashtag — bảng xếp hạng cập nhật mỗi 5 phút.</span>
            </span>
            <ArrowRight className="h-5 w-5 text-pink-300" />
          </Link>
        )}

        {data && (
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-600">
            <Users className="h-3 w-3" /> Chỉ tính hoạt động thật của thành viên — không có số liệu ảo.
          </p>
        )}
      </main>
    </div>
  );
}
