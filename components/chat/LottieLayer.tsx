"use client";

import React, { useEffect, useRef } from "react";
import { playLottie } from "@/lib/stickers/lottie";

// Lớp hình động (SVG của lottie-web) phủ đúng lên ảnh tĩnh của sticker. Chỉ tồn tại 1 bản phát khi `play` = true;
// tắt play / phát xong / lỗi → huỷ bản phát (giải phóng bộ nhớ) và ảnh tĩnh hiện lại. Cha quyết định khi nào phát
// (giới hạn số hình động cùng lúc, chỉ khi trong khung nhìn, canAnimate()).
export default function LottieLayer({
  url,
  play,
  loops,
  onReadyChange,
  onDone,
  className = "",
}: {
  url: string | null;
  play: boolean;
  loops: number | "infinite";
  /** true khi khung đầu đã vẽ (ẩn ảnh tĩnh), false khi bản phát kết thúc */
  onReadyChange?: (ready: boolean) => void;
  onDone?: () => void;
  className?: string;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const cb = useRef({ onReadyChange, onDone });
  useEffect(() => {
    cb.current = { onReadyChange, onDone };
  });
  useEffect(() => {
    const el = box.current;
    if (!play || !url || !el) return;
    const end = () => {
      cb.current.onReadyChange?.(false);
      cb.current.onDone?.();
    };
    const stop = playLottie(el, url, { loops, onReady: () => cb.current.onReadyChange?.(true), onDone: end, onError: end });
    return () => {
      stop();
      cb.current.onReadyChange?.(false);
    };
  }, [play, url, loops]);
  return <span ref={box} aria-hidden className={`pn-lottie ${className}`} />;
}
