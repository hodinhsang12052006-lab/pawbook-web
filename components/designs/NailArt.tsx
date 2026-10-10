"use client";

import React, { useId } from "react";
import { tr } from "@/lib/i18n/tr";

// Minh hoạ mẫu nail TỰ VẼ (SVG) từ bảng màu + dáng móng + hiệu ứng + HOẠ TIẾT —
// dùng khi chưa có ảnh (máy tạo mẫu PawNail, Gemini miễn phí chỉ viết chữ, bộ
// mẫu gợi ý). Nhẹ, sắc nét ở mọi cỡ, không tốn tiền AI.
//   palette[0] = màu nền · palette[1] = màu phụ · palette[2] = kim loại/điểm nhấn
// Hoạ tiết "điểm nhấn" (tim, hoa, mạng nhện…) chỉ vẽ trên ngón trỏ + áp út —
// đúng như các bước làm mà máy tạo mẫu viết ra.

const W = 26;
const NAIL: Record<string, string> = {
  square: `M0 64 L0 9 Q0 2 7 2 L19 2 Q26 2 26 9 L26 64 Q13 74 0 64 Z`,
  oval: `M0 64 L0 18 C0 4 26 4 26 18 L26 64 Q13 74 0 64 Z`,
  almond: `M0 64 L0 24 C0 11 9 1 13 1 C17 1 26 11 26 24 L26 64 Q13 74 0 64 Z`,
  stiletto: `M0 64 L0 28 C0 17 9 9 13 -4 C17 9 26 17 26 28 L26 64 Q13 74 0 64 Z`,
  coffin: `M0 64 L2.5 10 Q3.5 3 8 3 L18 3 Q22.5 3 23.5 10 L26 64 Q13 74 0 64 Z`,
};
// Ngón: [tâm x, đỉnh ngón y] — xoè nhẹ như bàn tay giơ lên.
const FINGERS: [number, number][] = [[38, 70], [84, 38], [130, 26], [176, 40], [220, 82]];
const ACCENT = new Set([1, 3]); // ngón trỏ + ngón áp út
const ALL_NAILS = new Set(["french", "ombre", "aura", "tortoise", "lines", "babyboomer", "chromefrench", "chromeline"]);

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
}

/** Hoạ tiết trên 1 móng, toạ độ của móng (rộng 26, đầu móng ở trên ~y2, chân móng ~y64). */
function Motif({ pattern, c2, metal, i, rnd, uid }: { pattern: string; c2: string; metal: string; i: number; rnd: () => number; uid: string }) {
  switch (pattern) {
    case "french":
      return <path d="M-3 17 Q13 7 29 17 L29 -8 L-3 -8 Z" fill={c2} />;
    case "ombre":
      return <rect x={-2} y={-6} width={30} height={80} fill={`url(#om${uid})`} />;
    case "aura":
      return <ellipse cx={13} cy={34} rx={11} ry={17} fill={`url(#au${uid})`} />;
    case "tortoise":
      return (
        <g opacity={0.85}>
          {Array.from({ length: 7 }).map((_, k) => (
            <ellipse key={k} cx={2 + rnd() * 22} cy={6 + rnd() * 54} rx={2.5 + rnd() * 3.5} ry={2 + rnd() * 3} fill={k % 2 ? "#3b2416" : "#5b3a29"} />
          ))}
        </g>
      );
    case "lines":
      return <path d={i % 2 ? "M3 58 C 8 40, 20 34, 23 10" : "M22 60 C 16 44, 6 36, 4 12"} stroke={metal} strokeWidth={1.3} fill="none" strokeLinecap="round" />;
    case "marble":
      return (
        <g fill="none" strokeLinecap="round">
          <path d="M2 12 C 10 22, 6 34, 16 44 S 22 58, 24 62" stroke="#64748b" strokeOpacity={0.55} strokeWidth={1.6} />
          <path d="M6 8 C 12 18, 18 26, 14 40" stroke={metal} strokeWidth={0.9} />
        </g>
      );
    case "dots":
      return <g fill={c2}>{[[7, 16], [18, 22], [9, 32], [19, 40], [8, 48], [17, 56]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={2} />)}</g>;
    case "hearts":
      return <path d="M13 40 C 13 40, 5 34, 5 28.5 C 5 25, 9 24, 13 28 C 17 24, 21 25, 21 28.5 C 21 34, 13 40, 13 40 Z" fill={c2} />;
    case "floral":
    case "blossom": {
      const petal = pattern === "blossom" ? c2 : c2;
      return (
        <g>
          {pattern === "blossom" && <path d="M2 60 C 8 46, 14 40, 24 18" stroke="#7c4a2d" strokeWidth={1.2} fill="none" />}
          {[[13, 30], [19, 46]].map(([x, y], k) => (
            <g key={k}>
              {Array.from({ length: 5 }).map((_, p) => {
                const a = (p / 5) * Math.PI * 2;
                return <circle key={p} cx={x + Math.cos(a) * 3} cy={y + Math.sin(a) * 3} r={2.2} fill={petal} />;
              })}
              <circle cx={x} cy={y} r={1.3} fill="#facc15" />
            </g>
          ))}
        </g>
      );
    }
    case "web":
      return (
        <g stroke={metal} strokeWidth={0.8} fill="none">
          <path d="M0 4 L26 30 M0 4 L14 44 M0 4 L26 10" />
          <path d="M8 12 Q12 10 13 6 M11 22 Q17 18 19 12 M12 33 Q21 27 24 18" />
        </g>
      );
    case "snow":
      return (
        <g stroke="#ffffff" strokeWidth={1} strokeLinecap="round">
          {[0, 60, 120].map((r) => <path key={r} d="M13 26 L13 42" transform={`rotate(${r} 13 34)`} />)}
          <circle cx={13} cy={34} r={1.2} fill="#ffffff" />
        </g>
      );
    case "candy":
      return <g fill={c2}>{[-10, 2, 14, 26].map((o) => <path key={o} d={`M-4 ${o + 30} L30 ${o} L30 ${o + 5} L-4 ${o + 35} Z`} />)}</g>;
    case "stars":
      return <path d="M13 26 L15 32 L21 34 L15 36 L13 42 L11 36 L5 34 L11 32 Z" fill={metal} />;
    case "gems":
      return <g fill="#ffffff" stroke="#94a3b8" strokeWidth={0.4}>{[[5, 56], [9, 60], [13, 61.5], [17, 60], [21, 56]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={1.9} />)}</g>;
    case "pearls":
      return <g fill="#fffaf0" stroke="#e7dccb" strokeWidth={0.4}>{[[8, 58], [13, 60], [18, 58]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={2.4} />)}</g>;
    case "leaf":
      return i === 3 ? <path d="M13 24 C 21 30, 20 42, 13 48 C 6 42, 5 30, 13 24 Z M13 26 L13 50" fill={metal} stroke={metal} strokeWidth={0.6} /> : null;
    case "plaid":
      return (
        <g>
          <g fill={c2} opacity={0.75}><rect x={5} y={-6} width={4} height={80} /><rect x={17} y={-6} width={4} height={80} /><rect x={-2} y={20} width={30} height={4} /><rect x={-2} y={42} width={30} height={4} /></g>
          <g stroke="#ffffff" strokeWidth={0.5} opacity={0.8}><path d="M13 -6 L13 74 M-2 33 L28 33" /></g>
        </g>
      );
    case "babyboomer":
      return <rect x={-2} y={-6} width={30} height={80} fill={`url(#bb${uid})`} />;
    case "chromefrench":
      return <path d="M-3 16 Q13 6 29 16 L29 -8 L-3 -8 Z" fill={`url(#cr${uid})`} />;
    case "charm3d":
      // nơ kim loại: 2 cánh + nút giữa, có điểm sáng
      return (
        <g>
          <path d="M13 34 L5 28 L5 40 Z M13 34 L21 28 L21 40 Z" fill={`url(#cr${uid})`} stroke="rgba(0,0,0,0.25)" strokeWidth={0.4} />
          <circle cx={13} cy={34} r={2.2} fill={`url(#cr${uid})`} stroke="rgba(0,0,0,0.25)" strokeWidth={0.4} />
        </g>
      );
    case "gemcluster":
      return (
        <g stroke="#94a3b8" strokeWidth={0.4}>
          <circle cx={13} cy={36} r={4.2} fill="#f8fafc" />
          <circle cx={13} cy={36} r={1.6} fill="#ffffff" stroke="none" />
          {[[7, 30, 2], [19, 31, 2.2], [8, 43, 1.8], [18, 43, 2], [13, 27, 1.5], [13, 46, 1.4]].map(([x, y, r], k) => (
            <circle key={k} cx={x} cy={y} r={r} fill={k % 2 ? "#cbd5e1" : "#e2e8f0"} />
          ))}
        </g>
      );
    case "foil":
      return (
        <g fill={metal} opacity={0.9}>
          {Array.from({ length: 6 }).map((_, k) => {
            const x = 3 + rnd() * 18, y = 10 + rnd() * 44;
            return <path key={k} d={`M${x} ${y} l${2 + rnd() * 3} ${-1 - rnd() * 2} l${1 + rnd() * 2} ${2 + rnd() * 3} l${-3 - rnd() * 2} ${1 + rnd()} Z`} />;
          })}
        </g>
      );
    case "chromeline":
      return (
        <g fill="none" strokeLinecap="round">
          <path d={i % 2 ? "M4 60 C 10 44, 4 30, 14 20 S 22 8, 20 2" : "M22 62 C 14 50, 22 36, 12 24 S 6 10, 8 2"} stroke={`url(#cr${uid})`} strokeWidth={2.2} />
          <path d={i % 2 ? "M4 60 C 10 44, 4 30, 14 20" : "M22 62 C 14 50, 22 36, 12 24"} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={0.6} />
        </g>
      );
    case "waves":
      return <g stroke="#ffffff" strokeWidth={1.2} fill="none" strokeLinecap="round">{[10, 17].map((y) => <path key={y} d={`M-2 ${y} Q4 ${y - 4} 9 ${y} T20 ${y} T31 ${y}`} />)}</g>;
    default:
      return null;
  }
}

export default function NailArt({
  palette, shape = "almond", finish = "glossy", pattern = "solid", uniform = false, seed = "x", className = "",
}: { palette: string[]; shape?: string; finish?: string; pattern?: string; uniform?: boolean; seed?: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const colors = palette.length ? palette : ["#ec4899", "#a855f7"];
  const path = NAIL[shape] ?? NAIL.almond;
  const rnd = hash(seed + shape + finish + pattern);
  const light = colors[colors.length - 1];
  const c2 = colors[1] ?? colors[0];
  const metal = colors[2] ?? colors[1] ?? "#d4af37";
  // Có hoạ tiết (hoặc mẫu PawNail) → mọi móng cùng màu nền; mẫu cũ thì đổi màu xen kẽ.
  const sameBase = pattern !== "mixmatch" && (uniform || pattern !== "solid");
  // Mix màu: ngón giữa + áp út đổi màu phụ (đúng bước làm của máy tạo mẫu).
  const mixIdx = (i: number) => (i === 2 || i === 3 ? 1 : 0);

  return (
    <svg viewBox="0 0 260 260" className={className} role="img" aria-label={tr("Minh hoạ mẫu nail", "Nail design preview")} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="20%" r="85%">
          <stop offset="0%" stopColor={light} stopOpacity="0.35" />
          <stop offset="100%" stopColor="#120d1a" />
        </radialGradient>
        <linearGradient id={`skin${uid}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#d9a383" />
          <stop offset="50%" stopColor="#f0c4a6" />
          <stop offset="100%" stopColor="#d49c7c" />
        </linearGradient>
        <linearGradient id={`om${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c2} />
          <stop offset="55%" stopColor={c2} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`au${uid}`}>
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c2} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`bb${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="35%" stopColor="#f8fafc" stopOpacity="0.85" />
          <stop offset="80%" stopColor="#f8fafc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`cr${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor={metal} />
          <stop offset="60%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={metal} />
        </linearGradient>
        <clipPath id={`clip${uid}`}>
          <path d={path} />
        </clipPath>
        {colors.map((c, i) => (
          <linearGradient key={i} id={`n${uid}${i}`} x1="0" y1="0" x2={finish === "cateye" ? "1" : "0"} y2="1">
            {finish === "chrome" ? (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor={c} />
                <stop offset="55%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor={c} />
              </>
            ) : finish === "cateye" ? (
              <>
                <stop offset="0%" stopColor={c} />
                <stop offset="45%" stopColor={c} />
                <stop offset="55%" stopColor="#fff7ed" stopOpacity="0.95" />
                <stop offset="68%" stopColor={c} />
                <stop offset="100%" stopColor={c} />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={c} />
                <stop offset="100%" stopColor={c} stopOpacity={finish === "matte" ? 0.92 : 0.82} />
              </>
            )}
          </linearGradient>
        ))}
      </defs>
      <rect width="260" height="260" fill={`url(#bg${uid})`} />
      {FINGERS.map(([cx, top], i) => {
        const fw = i === 4 ? 40 : 36;
        const nailColor = `url(#n${uid}${pattern === "mixmatch" ? Math.min(mixIdx(i), colors.length - 1) : sameBase ? 0 : (i === 3 && colors.length > 1 ? 1 : i) % colors.length})`;
        const drawMotif = pattern !== "solid" && (ALL_NAILS.has(pattern) || ACCENT.has(i));
        return (
          <g key={i} transform={i === 4 ? `rotate(22 ${cx} ${top + 40})` : i === 0 ? "rotate(-8 38 150)" : undefined}>
            <rect x={cx - fw / 2} y={top} width={fw} height={260} rx={fw / 2} fill={`url(#skin${uid})`} />
            <g transform={`translate(${cx - W / 2} ${top + 8})`}>
              <path d={path} fill={pattern === "tortoise" ? "#b45309" : pattern === "babyboomer" ? "#f2c4c4" : nailColor} fillOpacity={pattern === "jelly" ? 0.55 : 1} stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
              {drawMotif && (
                <g clipPath={`url(#clip${uid})`}>
                  <Motif pattern={pattern} c2={c2} metal={metal} i={i} rnd={rnd} uid={uid} />
                </g>
              )}
              {finish === "glitter" &&
                Array.from({ length: 14 }).map((_, k) => (
                  <circle key={k} cx={3 + rnd() * 20} cy={6 + rnd() * 54} r={0.6 + rnd() * 1.2} fill={k % 3 ? "#fef3c7" : "#ffffff"} opacity={0.75} />
                ))}
              {finish !== "matte" && <path d="M5 22 Q6 12 11 9" stroke="#ffffff" strokeOpacity={finish === "chrome" ? 0.9 : 0.55} strokeWidth="2.6" strokeLinecap="round" fill="none" />}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
