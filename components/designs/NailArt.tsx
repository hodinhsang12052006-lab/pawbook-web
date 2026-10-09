"use client";

import React, { useId } from "react";
import { tr } from "@/lib/i18n/tr";

// Minh hoạ mẫu nail TỰ VẼ (SVG) từ bảng màu + dáng móng + hiệu ứng — dùng khi
// chưa có ảnh AI (Gemini miễn phí chỉ viết chữ) hoặc cho bộ mẫu gợi ý. Nhẹ,
// sắc nét ở mọi cỡ, không tốn tiền AI.

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

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
}

export default function NailArt({ palette, shape = "almond", finish = "glossy", seed = "x", className = "" }: { palette: string[]; shape?: string; finish?: string; seed?: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const colors = palette.length ? palette : ["#ec4899", "#a855f7"];
  const path = NAIL[shape] ?? NAIL.almond;
  const rnd = hash(seed + shape + finish);
  const light = colors[colors.length - 1];

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
        const nailColor = `url(#n${uid}${(i === 3 && colors.length > 1 ? 1 : i) % colors.length})`;
        return (
          <g key={i} transform={i === 4 ? `rotate(22 ${cx} ${top + 40})` : i === 0 ? "rotate(-8 38 150)" : undefined}>
            <rect x={cx - fw / 2} y={top} width={fw} height={260} rx={fw / 2} fill={`url(#skin${uid})`} />
            <g transform={`translate(${cx - W / 2} ${top + 8})`}>
              <path d={path} fill={nailColor} stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
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
