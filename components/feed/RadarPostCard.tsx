"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/feedFormat";

export interface RadarPost { id: string; kind: string; title: string; body: string; href: string | null; createdAt: string }

const KIND_TONE: Record<string, string> = {
  pulse: "from-sky-500/15 ring-sky-500/25 text-sky-300",
  gap: "from-orange-500/15 ring-orange-500/25 text-orange-300",
  salary: "from-emerald-500/15 ring-emerald-500/25 text-emerald-300",
  hashtag: "from-fuchsia-500/15 ring-fuchsia-500/25 text-fuchsia-300",
  pain: "from-amber-500/15 ring-amber-500/25 text-amber-300",
  news: "from-slate-400/15 ring-slate-400/25 text-slate-300",
  custom: "from-pink-500/15 ring-pink-500/25 text-pink-300",
};

/** Bài PawNail Studio đã được admin duyệt (radar xu hướng & nỗi đau ngành). */
export default function RadarPostCard({ post }: { post: RadarPost }) {
  const tone = KIND_TONE[post.kind] ?? KIND_TONE.custom;
  const external = !!post.href && /^https:\/\//.test(post.href);
  const body = (
    <>
      <p className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${tone.split(" ").pop()}`}>
        <Sparkles className="h-3.5 w-3.5" /> PawNail Studio · {timeAgo(post.createdAt)}
      </p>
      <h3 className="mt-1.5 text-[15px] font-black leading-snug text-white">{post.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{post.body}</p>
      {post.href && (
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-pink-300">
          {external ? <>Đọc bài gốc <ExternalLink className="h-3 w-3" /></> : <>Xem thêm <ArrowRight className="h-3 w-3" /></>}
        </span>
      )}
    </>
  );
  const cls = `block rounded-2xl bg-gradient-to-br ${tone.split(" ")[0]} via-slate-900/60 to-slate-900/40 p-4 ring-1 ${tone.split(" ")[1]} transition-colors`;
  if (!post.href) return <article className={cls}>{body}</article>;
  return external ? (
    <a href={post.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
  ) : (
    <Link href={post.href} className={cls}>{body}</Link>
  );
}
