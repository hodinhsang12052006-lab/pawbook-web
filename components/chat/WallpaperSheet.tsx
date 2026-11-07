"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { bubbleTime } from "@/lib/chat/chatTime";
import { stillUrl } from "@/lib/stickers/urls";
import {
  CHAT_WALLPAPERS,
  DIM_DEFAULT,
  DIM_MAX,
  DIM_MIN,
  WALLPAPER_GROUPS,
  chatKeyOf,
  hasOwnChoice,
  photoIdOf,
  photoRender,
  presetRender,
  prunePhotos,
  removePhoto,
  resolveChoice,
  validChoice,
  writeWpState,
  type PhotoMeta,
  type WpRender,
  type WpState,
} from "@/lib/chatWallpapers";
import { deleteLocalImage, gcLocalImages, isAcceptableImage, processWallpaperImage, putLocalImage } from "@/lib/localImageStore";
import { cachePhotoUrl, cachedPhotoUrl, usePhotoUrl } from "./useChatWallpaper";

// Bảng chọn hình nền đoạn chat. Thẻ xem trước THẬT (bong bóng thật của Messenger trên nền đang chọn) + khung chat phía
// sau đổi ngay khi chạm 1 ô, nhưng chỉ LƯU khi bấm "Áp dụng" (Huỷ / đóng = trả lại như cũ). "Ảnh của bạn": ảnh trong máy,
// xử lý trên máy (xoay đúng, ≤ 1600px, bỏ EXIF), lưu IndexedDB — không tải lên. Không phủ mờ / làm tối vùng chat phía trên.
// Bố cục: khối trên (tiêu đề, thẻ xem trước, Độ tối / Làm mờ, Đoạn chat này | Mọi đoạn chat) đứng yên, chỉ các ô nền cuộn
// → thẻ xem trước luôn thấy khi chọn. Ô "Thêm ảnh" + ảnh đã lưu (có nút × xoá) nằm đầu lưới 4 cột, cùng cỡ ô nền.
type Mode = "this" | "all";

export default function WallpaperSheet({
  userId,
  chat,
  sampleSender,
  state,
  market,
  onPreview,
  onClose,
}: {
  userId: string;
  chat: { id: string; isGroup: boolean; conversationId?: string | null; name: string };
  /** Tên người gửi thật hiện trong bong bóng mẫu (1-1: người kia; nhóm: 1 thành viên) */
  sampleSender: string;
  state: WpState;
  market?: string | null;
  onPreview: (r: WpRender | null) => void;
  onClose: () => void;
}) {
  useTr();
  const chatKey = chatKeyOf(chat);
  const [mode, setMode] = useState<Mode>("this");
  const initialFor = (m: Mode) => (m === "this" ? resolveChoice(state, chatKey, chat.conversationId) : validChoice(state, state.all) ? state.all! : "default");
  const [selected, setSelected] = useState<string>(() => initialFor("this"));
  const [draft, setDraft] = useState<Record<string, PhotoMeta>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  // Ảnh gốc vừa chọn (chỉ trong lúc bảng mở) — để bật / tắt "Làm mờ" xử lý lại từ ảnh gốc
  const [originals, setOriginals] = useState<Record<string, File>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);
  const [, bump] = useState(0);

  const photos = useMemo(() => ({ ...(state.photos ?? {}), ...draft }), [state.photos, draft]);
  const pid = photoIdOf(selected);
  const meta: PhotoMeta | null = pid ? photos[pid] ?? null : null;
  const render: WpRender = pid ? photoRender(cachedPhotoUrl(userId, pid), meta?.dim ?? DIM_DEFAULT) : presetRender(selected);

  useEffect(() => {
    onPreview(render);
  }, [render.id, render.tone, JSON.stringify(render.style)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPreview(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      localStorage.setItem(`pn_wp_seen:${userId}`, "1");
    } catch {}
    applyRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [userId, onClose]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected(initialFor(m));
  };

  const pickFile = async (f: File | undefined) => {
    if (!isAcceptableImage(f)) {
      toast.error(tr("Ảnh không hợp lệ hoặc quá lớn", "That photo is too large or not an image"));
      return;
    }
    setBusy(true);
    try {
      const out = await processWallpaperImage(f, false);
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      if (!out || !(await putLocalImage(userId, id, out.blob))) {
        toast.error(tr("Không lưu được ảnh trên máy này.", "Couldn't save the photo on this device."));
        return;
      }
      cachePhotoUrl(userId, id, out.blob);
      setOriginals((o) => ({ ...o, [id]: f }));
      setDraft((d) => ({ ...d, [id]: { dim: DIM_DEFAULT, blur: false, w: out.w, h: out.h, at: Date.now() } }));
      setSelected(`photo:${id}`);
    } finally {
      setBusy(false);
    }
  };

  const setMeta = (patch: Partial<PhotoMeta>) => {
    if (!pid || !meta) return;
    setDraft((d) => ({ ...d, [pid]: { ...meta, ...patch } }));
  };
  const toggleBlur = async () => {
    if (!pid || !meta) return;
    const f = originals[pid];
    if (!f) return;
    setBusy(true);
    try {
      const out = await processWallpaperImage(f, !meta.blur);
      if (out && (await putLocalImage(userId, pid, out.blob))) {
        cachePhotoUrl(userId, pid, out.blob);
        setMeta({ blur: !meta.blur, w: out.w, h: out.h });
        bump((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const commit = (replaceAll: boolean) => {
    let s: WpState = { ...state, byChat: { ...(state.byChat ?? {}) }, photos: { ...(state.photos ?? {}) } };
    if (pid && meta) s.photos![pid] = { ...meta, at: Date.now() };
    if (mode === "this") {
      s.byChat![chatKey] = selected;
      if (chat.conversationId && chat.conversationId !== chatKey) delete s.byChat![chat.conversationId];
    } else {
      s.all = selected;
      if (replaceAll) s.byChat = {};
    }
    s = prunePhotos(s);
    writeWpState(userId, s);
    gcLocalImages(userId, new Set(Object.keys(s.photos ?? {})));
    onPreview(null);
    onClose();
  };
  const apply = () => {
    const n = Object.keys(state.byChat ?? {}).length;
    if (mode === "all" && n > 0) setConfirm(n);
    else commit(false);
  };
  const reset = () => {
    const s: WpState = { ...state, byChat: { ...(state.byChat ?? {}) } };
    if (mode === "this") {
      delete s.byChat![chatKey];
      if (chat.conversationId) delete s.byChat![chat.conversationId];
      setSelected(validChoice(s, s.all) ? s.all! : "default");
    } else {
      delete s.all;
      setSelected("default");
    }
    writeWpState(userId, s);
  };
  const cancel = () => {
    // ảnh vừa chọn nhưng không Áp dụng → xoá khỏi máy ngay (không đợi lần Áp dụng sau)
    if (Object.keys(draft).some((id) => !state.photos?.[id])) gcLocalImages(userId, new Set(Object.keys(state.photos ?? {})));
    onPreview(null);
    onClose();
  };
  // Xoá 1 ảnh đã lưu: khỏi máy + mọi chỗ đang dùng ảnh đó (về nền chung / mặc định)
  const deletePhoto = (id: string) => {
    const committed = !!state.photos?.[id];
    const without = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== id));
    setDraft(without);
    setOriginals(without);
    let next = state;
    if (committed) {
      next = removePhoto(state, id);
      writeWpState(userId, next);
    }
    deleteLocalImage(userId, id);
    if (selected === `photo:${id}`) {
      const fallback = mode === "this" ? resolveChoice(next, chatKey, chat.conversationId) : validChoice(next, next.all) ? next.all! : "default";
      setSelected(photoIdOf(fallback) === id ? "default" : fallback);
    }
  };
  const canReset = mode === "this" ? hasOwnChoice(state, chatKey, chat.conversationId) : !!state.all;

  const now = new Date();
  const time = bubbleTime(now, market);
  const photoIds = Object.keys(photos).sort((a, b) => photos[b].at - photos[a].at);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && cancel()}>
      <div role="dialog" aria-modal="true" aria-label={tr("Chọn hình nền đoạn chat", "Choose chat wallpaper")} className="pn-wp-sheet">
        <span aria-hidden className="m-grabber" />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[17px] font-semibold text-[#f7eef3]">{tr("Hình nền đoạn chat", "Chat wallpaper")}</p>
          <button type="button" onClick={cancel} aria-label={tr("Đóng", "Close")} className="flex h-10 w-10 items-center justify-center rounded-full text-[#c0b2bc] hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thẻ xem trước: nền thật + bong bóng thật */}
        <div className="chat-wallpaper pn-wp-preview" data-wallpaper={render.id} data-wp-tone={render.tone} style={render.style} data-testid="wp-preview">
          <div className="m-sep !my-0">
            <span className="pn-date-pill">{tr("Hôm nay", "Today")}</span>
          </div>
          <div className="m-row flex justify-start">
            <div className="m-col m-col-group flex flex-col items-start">
              <span className="m-sender">{sampleSender}</span>
              <div className="m-bubble m-in m-bl-tail m-tail">
                <p className="m-text">
                  {tr("Chào chị, 3 giờ chiều nay em làm sơn gel được không ạ? 💅", "Hi! Could I get a gel manicure at 3 today? 💅")}
                  <span className="m-meta-spacer" aria-hidden />
                </p>
                <span className="m-meta" aria-hidden>{time}</span>
              </div>
            </div>
          </div>
          <div className="m-row flex justify-end">
            <div className="m-col flex flex-col items-end">
              <div className="m-bubble m-out m-br-tail m-tail">
                <p className="m-text">
                  {tr("Được nha, hẹn chị 3 giờ!", "Sure, see you at 3!")}
                  <span className="m-meta-spacer m-spacer-out" aria-hidden />
                </p>
                <span className="m-meta" aria-hidden>{time}</span>
              </div>
            </div>
          </div>
          <div className="m-row flex justify-end">
            <div className="m-bare">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stillUrl("💅") ?? ""} alt="" width={64} height={64} crossOrigin="anonymous" className="h-16 w-16" />
              <span className="m-meta-pill">{time}</span>
            </div>
          </div>
        </div>

        {/* Ảnh: độ tối + làm mờ */}
        {pid && meta && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-[#c0b2bc]">
              <span className="flex-shrink-0">{tr("Độ tối", "Dim")}</span>
              <input
                type="range"
                min={DIM_MIN}
                max={DIM_MAX}
                step={1}
                value={meta.dim}
                onChange={(e) => setMeta({ dim: Number(e.target.value) })}
                aria-label={tr("Độ tối", "Dim")}
                className="pn-wp-range min-w-0 flex-1"
              />
              <span className="w-9 flex-shrink-0 text-right tabular-nums">{meta.dim}%</span>
            </label>
            <label className={`flex flex-shrink-0 items-center gap-2 text-[13px] text-[#c0b2bc] ${originals[pid] ? "" : "opacity-50"}`}>
              <input type="checkbox" checked={meta.blur} disabled={!originals[pid] || busy} onChange={toggleBlur} className="h-4 w-4 accent-[#c0406f]" />
              {tr("Làm mờ", "Blur")}
            </label>
          </div>
        )}

        {/* Đoạn chat này | Mọi đoạn chat */}
        <div role="radiogroup" aria-label={tr("Áp dụng cho", "Apply to")} className="pn-wp-seg mt-3">
          {(["this", "all"] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)}>
              {m === "this" ? tr("Đoạn chat này", "This chat") : tr("Mọi đoạn chat", "All chats")}
            </button>
          ))}
        </div>

        <div className="pn-wp-scroll custom-scrollbar" data-testid="wp-scroll">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="wp-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              pickFile(f);
            }}
          />
          {WALLPAPER_GROUPS.map((g, gi) => (
            <section key={g.id} className={gi ? "mt-3" : ""}>
              <h4 className="pn-wp-group">{tr(g.vi, g.en)}</h4>
              <div className="grid grid-cols-4 gap-2.5">
                {gi === 0 && (
                  <>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="pn-wp-tile" aria-label={tr("Thêm ảnh của bạn", "Add your photo")} data-testid="wp-photo-tile">
                      <span className="pn-wp-swatch pn-wp-add">{busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}</span>
                      <span className="pn-wp-label">{tr("Thêm ảnh", "Add photo")}</span>
                    </button>
                    {photoIds.map((id, i) => (
                      <PhotoTile key={id} uid={userId} id={id} n={photoIds.length - i} selected={selected === `photo:${id}`} onPick={() => setSelected(`photo:${id}`)} onDelete={() => deletePhoto(id)} />
                    ))}
                  </>
                )}
                {CHAT_WALLPAPERS.filter((w) => w.group === g.id).map((w) => (
                  <button key={w.id} type="button" aria-pressed={selected === w.id} aria-label={tr(w.vi, w.en)} data-wp={w.id} onClick={() => setSelected(w.id)} className="pn-wp-tile">
                    <span className={`pn-wp-swatch ${selected === w.id ? "pn-wp-on" : ""}`} style={w.pattern ? { background: w.swatch, backgroundSize: w.swatchSize ?? "60px 60px, auto" } : { background: w.swatch }}>
                      {selected === w.id && <Check className="pn-wp-check" />}
                    </span>
                    <span className="pn-wp-label">{tr(w.vi, w.en)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <p className="mt-4 text-[12px] leading-[18px] text-[#a69ba4]">
            {tr("Chỉ đổi trên máy này — người kia không thấy. Ảnh của bạn không được tải lên.", "Only on this device — the other person won't see it. Your photo is never uploaded.")}
          </p>
        </div>

        <div className="pn-wp-actions">
          {canReset ? (
            <button type="button" onClick={reset} className="mr-auto min-h-11 px-1 text-[14px] font-semibold text-[#f29bbb] underline-offset-2 hover:underline">
              {tr("Về mặc định", "Reset to default")}
            </button>
          ) : (
            <span className="mr-auto" />
          )}
          <button type="button" onClick={cancel} className="pn-wp-btn">
            {tr("Huỷ", "Cancel")}
          </button>
          <button ref={applyRef} type="button" onClick={apply} disabled={busy} className="pn-wp-btn pn-wp-primary">
            {tr("Áp dụng", "Apply")}
          </button>
        </div>

        {confirm !== null && (
          <div className="pn-wp-confirm" role="alertdialog" aria-modal="true" aria-label={tr("Mọi đoạn chat", "All chats")}>
            <div className="pn-wp-confirm-card">
              <p className="text-[15px] leading-[22px] text-[#f7eef3]">
                {tr(`Thay luôn hình nền riêng của ${confirm} đoạn chat?`, `Also replace the custom wallpaper on ${confirm} ${confirm === 1 ? "chat" : "chats"}?`)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => commit(false)} className="pn-wp-btn">
                  {tr("Giữ lại", "Keep them")}
                </button>
                <button type="button" onClick={() => commit(true)} className="pn-wp-btn pn-wp-primary">
                  {tr("Thay hết", "Replace all")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoTile({ uid, id, n, selected, onPick, onDelete }: { uid: string; id: string; n: number; selected: boolean; onPick: () => void; onDelete: () => void }) {
  useTr();
  const url = usePhotoUrl(uid, id);
  const label = tr(`Ảnh ${n}`, `Photo ${n}`);
  return (
    <div className="pn-wp-tile" data-wp-photo={id}>
      <button type="button" aria-pressed={selected} aria-label={label} onClick={onPick} className="flex w-full flex-col items-center gap-1">
        <span className={`pn-wp-swatch ${selected ? "pn-wp-on" : ""}`} style={url ? { backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          {selected && <Check className="pn-wp-check" />}
        </span>
        <span className="pn-wp-label">{label}</span>
      </button>
      <button type="button" onClick={onDelete} aria-label={tr(`Xoá ${label.toLowerCase()}`, `Delete ${label.toLowerCase()}`)} className="pn-wp-del" data-testid="wp-photo-delete">
        <span>
          <X className="h-3.5 w-3.5" aria-hidden />
        </span>
      </button>
    </div>
  );
}
