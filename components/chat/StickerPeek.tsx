"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Send, Star, StarOff } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { marketSpelling } from "@/lib/i18n/spelling";
import { animUrl, isFluent, stillUrl } from "@/lib/stickers/urls";

// Xem trước 1 sticker (nhấn giữ / chuột phải / Shift+Enter): hình 200px chính giữa màn hình — Noto chạy bản động,
// Fluent 3D "thở" nhẹ (1 → 1.04, tắt khi giảm chuyển động) — kèm 2 nút Gửi / Thêm vào Yêu thích.
// Nhấn giữ rồi trượt ngón tay tới 1 nút và thả = chọn nút đó. Thả ngón ở chỗ khác: bảng vẫn mở để bấm nút;
// chạm ra ngoài / Esc / X đóng. Gắn vào <body> (portal) — đánh dấu data-media-panel-child để bảng sticker không tự đóng.
export default function StickerPeek({
  id,
  name,
  favorite,
  market,
  onSend,
  onToggleFavorite,
  onClose,
}: {
  id: string;
  name: string;
  favorite: boolean;
  market?: string | null;
  onSend: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  useTr();
  const sendRef = useRef<HTMLButtonElement>(null);
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
  const src = animUrl(id) || stillUrl(id);
  const fluent = isFluent(id);
  return createPortal(
    <div
      data-media-panel-child=""
      data-sticker-peek=""
      className="pn-stk-peek fixed inset-0 z-[95] flex items-center justify-center p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={name} className="pn-stk-peek-card flex w-[264px] flex-col items-center gap-4 rounded-[28px] p-4">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} width={200} height={200} crossOrigin="anonymous" decoding="async" draggable={false} className={`h-[200px] w-[200px] select-none ${fluent ? "pn-stk-breathe" : ""}`} />
        )}
        <p className="max-w-full truncate text-[13px] text-[#c0b2bc]">{name}</p>
        <div className="grid w-full grid-cols-2 gap-2">
          <button ref={sendRef} type="button" data-peek-action="send" onClick={onSend} className="pn-stk-peek-btn pn-stk-peek-primary">
            <Send className="h-4 w-4" aria-hidden />
            {tr("Gửi", "Send")}
          </button>
          <button type="button" data-peek-action="fav" onClick={onToggleFavorite} aria-pressed={favorite} className="pn-stk-peek-btn">
            {favorite ? <StarOff className="h-4 w-4" aria-hidden /> : <Star className="h-4 w-4" aria-hidden />}
            <span className="truncate">{favorite ? tr("Bỏ khỏi Yêu thích", marketSpelling("Remove from Favorites", market)) : tr("Thêm vào Yêu thích", marketSpelling("Add to Favorites", market))}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
