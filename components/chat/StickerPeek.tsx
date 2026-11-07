"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Send, Star, StarOff } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { marketSpelling } from "@/lib/i18n/spelling";
import { isFluent, lottieUrl, stillUrl } from "@/lib/stickers/urls";
import { canAnimate } from "@/lib/stickers/lottie";
import type { StickerMeta } from "@/lib/stickers/manifest";
import LottieLayer from "./LottieLayer";

// Xem trước 1 sticker (nhấn giữ / chuột phải / Shift+Enter): hình 200px chính giữa màn hình — Noto chạy hình động lặp
// (lottie), Fluent 3D "thở" nhẹ (1 → 1.04, tắt khi giảm chuyển động) — kèm nút Gửi / Thêm vào Yêu thích (+ Bỏ khỏi
// Gần đây nếu có). Nhấn giữ rồi trượt ngón tay tới 1 nút và thả = chọn nút đó. Thả ngón ở chỗ khác: bảng vẫn mở để bấm;
// chạm ra ngoài / Esc đóng. Gắn vào <body> (portal) — đánh dấu data-media-panel-child để bảng sticker không tự đóng.
export default function StickerPeek({
  id,
  name,
  meta,
  favorite,
  recent,
  market,
  onSend,
  onToggleFavorite,
  onRemoveRecent,
  onClose,
}: {
  id: string;
  name: string;
  meta?: StickerMeta | null;
  favorite: boolean;
  recent?: boolean;
  market?: string | null;
  onSend: () => void;
  onToggleFavorite: () => void;
  onRemoveRecent?: () => void;
  onClose: () => void;
}) {
  useTr();
  const sendRef = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const [animOn] = useState(() => canAnimate());
  useEffect(() => {
    sendRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const src = stillUrl(id, meta);
  const lottie = animOn ? lottieUrl(id, meta) : null;
  const fluent = isFluent(id);
  const label = name || tr("Nhãn dán", "Sticker");
  return createPortal(
    <div
      data-media-panel-child=""
      data-sticker-peek=""
      className="pn-stk-peek fixed inset-0 z-[95] flex items-center justify-center p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={label} className="pn-stk-peek-card flex w-[272px] flex-col items-center gap-3 rounded-[28px] p-4">
        {src && (
          <span className="pn-stk-box h-[200px] w-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              width={200}
              height={200}
              crossOrigin="anonymous"
              decoding="async"
              draggable={false}
              className={`h-[200px] w-[200px] select-none ${fluent ? "pn-stk-breathe" : ""}`}
              style={ready ? { opacity: 0 } : undefined}
            />
            {lottie && <LottieLayer url={lottie} play loops="infinite" onReadyChange={setReady} />}
          </span>
        )}
        {name && <p className="max-w-full truncate text-[13px] text-[#c0b2bc]">{name}</p>}
        <div className="grid w-full grid-cols-1 gap-2">
          <button ref={sendRef} type="button" data-peek-action="send" onClick={onSend} className="pn-stk-peek-btn pn-stk-peek-primary">
            <Send className="h-4 w-4" aria-hidden />
            {tr("Gửi", "Send")}
          </button>
          <button type="button" data-peek-action="fav" onClick={onToggleFavorite} aria-pressed={favorite} className="pn-stk-peek-btn">
            {favorite ? <StarOff className="h-4 w-4" aria-hidden /> : <Star className="h-4 w-4" aria-hidden />}
            <span className="truncate">{favorite ? tr("Bỏ khỏi Yêu thích", marketSpelling("Remove from Favorites", market)) : tr("Thêm vào Yêu thích", marketSpelling("Add to Favorites", market))}</span>
          </button>
          {recent && onRemoveRecent && (
            <button type="button" data-peek-action="unrecent" onClick={onRemoveRecent} className="pn-stk-peek-btn">
              <Clock className="h-4 w-4" aria-hidden />
              <span className="truncate">{tr("Bỏ khỏi Gần đây", "Remove from Recent")}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
