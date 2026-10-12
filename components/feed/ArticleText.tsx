"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { renderContentWithHashtags } from "@/lib/feedFormat";

// Bài của tài khoản chính thức (thuế, an toàn, mẹo nghề, tin ngành) viết theo
// khuôn: "emoji + tiêu đề" / các ý "• …" / lời kêu gọi / Nguồn / hashtag.
// Hiển thị như 1 bài báo nhỏ: dải màu + tiêu đề to, 3 ý chính, "Đọc tiếp" —
// thay cho bức tường chữ bị cắt giữa câu.

const LEAD = /^(\p{Extended_Pictographic}️?|[\u{1F1E6}-\u{1F1FF}]{2})\s*/u;

type Theme = { band: string; ring: string; dot: string; label: string; tag: [string, string] };
const THEMES: Record<string, Theme> = {
  money: { band: "from-emerald-500/25 via-emerald-500/10 to-transparent", ring: "ring-emerald-500/20", dot: "bg-emerald-400", label: "text-emerald-300", tag: ["Thuế & tiền", "Tax & money"] },
  safety: { band: "from-sky-500/25 via-sky-500/10 to-transparent", ring: "ring-sky-500/20", dot: "bg-sky-400", label: "text-sky-300", tag: ["An toàn", "Stay safe"] },
  season: { band: "from-orange-500/25 via-orange-500/10 to-transparent", ring: "ring-orange-500/20", dot: "bg-orange-400", label: "text-orange-300", tag: ["Theo mùa", "Seasonal"] },
  news: { band: "from-violet-500/25 via-violet-500/10 to-transparent", ring: "ring-violet-500/20", dot: "bg-violet-400", label: "text-violet-300", tag: ["Tin ngành nail", "Industry news"] },
  talk: { band: "from-fuchsia-500/25 via-fuchsia-500/10 to-transparent", ring: "ring-fuchsia-500/20", dot: "bg-fuchsia-400", label: "text-fuchsia-300", tag: ["Thảo luận", "Discussion"] },
  jobs: { band: "from-emerald-500/25 via-teal-500/10 to-transparent", ring: "ring-emerald-500/20", dot: "bg-emerald-400", label: "text-emerald-300", tag: ["Việc làm tuần này", "Jobs this week"] },
  health: { band: "from-teal-500/25 via-cyan-500/10 to-transparent", ring: "ring-teal-500/20", dot: "bg-teal-400", label: "text-teal-300", tag: ["Sức khoẻ thợ", "Tech health"] },
  english: { band: "from-indigo-500/25 via-blue-500/10 to-transparent", ring: "ring-indigo-500/20", dot: "bg-indigo-400", label: "text-indigo-300", tag: ["Tiếng Anh tiệm nail", "Salon English"] },
  owner: { band: "from-amber-500/25 via-amber-500/10 to-transparent", ring: "ring-amber-500/20", dot: "bg-amber-400", label: "text-amber-300", tag: ["Chủ tiệm", "Salon owners"] },
  tip: { band: "from-pink-500/25 via-pink-500/10 to-transparent", ring: "ring-pink-500/20", dot: "bg-pink-400", label: "text-pink-300", tag: ["Mẹo nghề", "Pro tip"] },
};
const EMOJI_THEME: Record<string, keyof typeof THEMES> = {
  "💵": "money", "💰": "money", "🧾": "money", "📄": "money", "💸": "money", "🏦": "money",
  "📌": "safety", "🛡️": "safety", "🛡": "safety", "⚠️": "safety", "🚨": "safety",
  "🎃": "season", "🎄": "season", "🍂": "season", "🌸": "season", "🎆": "season", "💝": "season", "🧧": "season", "☀️": "season",
  "📰": "news", "🗞️": "news", "🇺🇸": "news", "🇦🇺": "news", "📈": "news",
  "💬": "talk", "🗳️": "talk", "❓": "talk",
  "📍": "jobs",
  "🧘": "health", "👀": "health", "🧤": "health", "😷": "health", "🩺": "health",
  "🗣️": "english", "🗣": "english",
  "🏪": "owner", "💲": "owner", "🗂️": "owner", "📣": "owner", "🌧️": "owner", "📉": "owner",
  "🧼": "safety", "🛁": "safety", "🔐": "safety", "🚗": "safety",
};

export interface Article {
  emoji: string;
  title: string;
  bullets: string[];
  extra: string[];
  source: string | null;
  tags: string;
  theme: Theme;
}

/** Tách bài chính thức theo khuôn; không đúng khuôn → null (hiển thị kiểu thường). */
export function parseArticle(content: string): Article | null {
  const lines = content.split("\n").map((l) => l.trim());
  const first = lines[0] || "";
  const m = first.match(LEAD);
  if (!m || first.length - m[0].length < 8) return null;
  const rest = lines.slice(1).filter(Boolean);
  if (!rest.length) return null;
  const bullets: string[] = [];
  const extra: string[] = [];
  let source: string | null = null;
  let tags = "";
  for (const l of rest) {
    if (/^[•\-–]\s+/.test(l)) bullets.push(l.replace(/^[•\-–]\s+/, ""));
    else if (/^(Nguồn|Source)\s*:/i.test(l)) source = l.replace(/^(Nguồn|Source)\s*:\s*/i, "");
    else if (/^(#[\p{L}\p{N}_]+\s*)+$/u.test(l)) tags = l;
    else extra.push(l);
  }
  const emoji = m[1];
  return { emoji, title: first.slice(m[0].length), bullets, extra, source, tags, theme: THEMES[EMOJI_THEME[emoji] ?? "tip"] };
}

const SHOWN = 3;

export default function ArticleText({ article }: { article: Article }) {
  const { emoji, title, bullets, extra, source, tags, theme } = article;
  // Không có ý "•" (bài thảo luận): đoạn văn đầu đóng vai phần tóm tắt.
  const body = bullets.length ? bullets : extra.slice(0, 1);
  const after = bullets.length ? extra : extra.slice(1);
  const hidden = Math.max(0, body.length - SHOWN) + after.length;
  const [open, setOpen] = useState(false);
  const list = open ? body : body.slice(0, SHOWN);

  return (
    <div className="px-4 pb-3">
      <div className={`overflow-hidden rounded-2xl bg-slate-950/40 ring-1 ${theme.ring}`}>
        <div className={`flex items-start gap-3 bg-gradient-to-br ${theme.band} p-4`}>
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-inner" aria-hidden>{emoji}</span>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-wider ${theme.label}`}>{tr(theme.tag[0], theme.tag[1])}</p>
            <h3 className="mt-0.5 text-[16px] font-black leading-snug text-white">{title}</h3>
          </div>
        </div>
        <div className="space-y-2.5 px-4 py-3.5">
          {bullets.length ? (
            <ul className="space-y-2">
              {list.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-200">
                  <span className={`mt-[9px] h-1.5 w-1.5 flex-shrink-0 rounded-full ${theme.dot}`} />
                  <span className="min-w-0 break-words">{renderContentWithHashtags(b)}</span>
                </li>
              ))}
            </ul>
          ) : (
            list.map((t, i) => <p key={i} className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{renderContentWithHashtags(t)}</p>)
          )}
          {open && after.map((t, i) => (
            <p key={`x${i}`} className="break-words text-sm leading-relaxed text-slate-300">{renderContentWithHashtags(t)}</p>
          ))}
          {hidden > 0 && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`inline-flex min-h-[32px] items-center gap-1 text-sm font-bold ${theme.label} hover:text-white`}>
              {open ? tr("Thu gọn", "Show less") : tr("Đọc tiếp", "Read more")}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
          {(source || tags) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2.5 text-xs text-slate-500">
              {source && <SourceLabel source={source} />}
              {tags && <span className="min-w-0 break-words">{renderContentWithHashtags(tags)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// "WhatNow — https://news.google.com/…(rất dài)" → "Nguồn: WhatNow ↗" (bấm mở bài gốc), không in nguyên đường link.
function SourceLabel({ source }: { source: string }) {
  const m = source.match(/^(.*?)\s*[—-]\s*(https:\/\/\S+)$/);
  if (!m) return <span className="min-w-0 break-words">{tr("Nguồn: ", "Source: ")}{renderContentWithHashtags(source)}</span>;
  return (
    <span className="min-w-0">
      {tr("Nguồn: ", "Source: ")}
      <a href={m[2]} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-slate-300 underline-offset-2 hover:text-white hover:underline">{m[1] || tr("bài gốc", "original")} ↗</a>
    </span>
  );
}
