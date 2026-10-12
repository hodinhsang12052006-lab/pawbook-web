"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { tr } from "@/lib/i18n/tr";

// Bong bóng tin nhắn thoại: nút phát/dừng · sóng âm (tô màu theo tiến độ, chạm để tua) · thời lượng.
// Thời lượng lấy từ "#d=<giây>" lúc gửi — file webm ghi từ trình duyệt thường báo duration = Infinity.
// Chỉ 1 tin thoại phát 1 lúc trong cả trang.
const BARS = 30;
let playing: HTMLAudioElement | null = null;

function bars(seed: string): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const wave = 0.45 + 0.35 * Math.sin((i / BARS) * Math.PI); // giữa cao, 2 đầu thấp như giọng nói
    return Math.max(0.15, Math.min(1, wave + ((h % 1000) / 1000 - 0.5) * 0.6));
  });
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function VoiceMessage({ src, self }: { src: string; self: boolean }) {
  const [url, total] = useMemo(() => {
    const m = src.match(/#d=(\d+)$/);
    return [src.replace(/#d=\d+$/, ""), m ? Number(m[1]) : 0];
  }, [src]);
  const shape = useMemo(() => bars(url), [url]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(total);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const ensure = () => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(url);
    a.preload = "auto";
    a.ontimeupdate = () => setPos(a.currentTime);
    a.onloadedmetadata = () => { if (Number.isFinite(a.duration) && a.duration > 0) setDur(a.duration); };
    a.onended = () => { setIsPlaying(false); setPos(0); };
    a.onpause = () => setIsPlaying(false);
    a.onplay = () => setIsPlaying(true);
    audioRef.current = a;
    return a;
  };
  const toggle = () => {
    const a = ensure();
    if (!a.paused) return a.pause();
    if (playing && playing !== a) playing.pause();
    playing = a;
    a.play().catch(() => {});
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const a = ensure();
    if (dur) { a.currentTime = frac * dur; setPos(a.currentTime); }
  };
  const progress = dur ? pos / dur : 0;

  return (
    <div className={`flex w-[220px] max-w-full items-center gap-2.5 rounded-[20px] px-2.5 py-2 ${self ? "bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white" : "bg-slate-800/90 text-slate-50"}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? tr("Dừng", "Pause") : tr("Phát tin nhắn thoại", "Play voice message")}
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 ${self ? "bg-white text-pink-600" : "bg-pink-500 text-white"}`}
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div onClick={seek} className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-[2px]" role="slider" aria-label={tr("Tua tin nhắn thoại", "Seek")} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(pos)}>
        {shape.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] flex-1 rounded-full transition-colors ${i / BARS < progress ? (self ? "bg-white" : "bg-pink-400") : self ? "bg-white/45" : "bg-slate-500"}`}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>
      <span className={`w-9 flex-shrink-0 text-right text-xs font-semibold tabular-nums ${self ? "text-white/90" : "text-slate-300"}`}>{fmt(isPlaying || pos ? pos : dur)}</span>
    </div>
  );
}
