"use client";

// Thử mẫu PawNail (Try-On) — CHỤP TAY LÀ CÓ MẪU:
//  (1) chọn ảnh tay (ảnh khách gửi trong chat / chụp mới) → máy TỰ NHẬN từng móng (viền hiện ngay trên ảnh);
//      móng sót: chạm 1 lần giữa móng · nhận nhầm: chạm vào viền để bỏ · ca khó: chế độ chạm gốc + đầu móng;
//  (2) SOI TAY: tông da, dáng / độ dài móng → 10 mẫu trend hợp tay, mỗi mẫu có lý do "vì sao hợp với bạn";
//  (3) mẫu vẽ thẳng lên móng thật như ảnh chụp (ánh sáng thật, hiệu ứng, hoạ tiết bám đúng móng); giữ dáng móng thật
//      hoặc đắp dài theo dáng. Chọn mẫu → gửi khách kèm giá / tải ảnh. Nhận móng + vẽ chạy nền (Web Worker).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Hand, Loader2, MousePointerClick, RefreshCw, RotateCcw, Send, Share2, Sparkles, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import TryOnMotif from "@/components/studio/TryOnMotif";
import { hasMotif, labelJpeg, loadPhoto, lookColors, studioLooks, svgPixels, type Pt, type StudioLook } from "@/lib/studio";
import { adviceLooks, profileChips, bestShape, type AdviceLook } from "@/lib/tryon/advice";
import type { HandProfile } from "@/lib/tryon/profile";
import { TryOnClient } from "@/lib/tryon/client";
import type { Crop, NailInfo, RawImg, TryOnReply } from "@/lib/tryon/session";
import type { Shape } from "@/lib/tryon/engine";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export interface StudioResult { blobs: Blob[]; looks: StudioLook[] }

type ShapeOpt = "natural" | Shape;
const SHAPES: ShapeOpt[] = ["natural", "almond", "oval", "square", "coffin", "stiletto"];
const SHAPE_VI: Record<ShapeOpt, [string, string]> = {
  natural: ["Móng thật", "Natural"], almond: ["Hạnh nhân", "Almond"], oval: ["Oval", "Oval"], square: ["Vuông", "Square"], coffin: ["Coffin", "Coffin"], stiletto: ["Nhọn", "Stiletto"],
};
interface Preview { url: string; blob: Blob }

const inPoly = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
/** Khung vuông ôm các móng đã nhận (có lề) — ảnh mẫu tập trung vào móng, móng to rõ. */
function cropOf(nails: NailInfo[], w: number, h: number, pad = 0.3): Crop {
  const pts = nails.flatMap((n) => n.outline);
  if (!pts.length) { const s = Math.min(w, h); return { x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), w: s, h: s }; }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.max(x1 - x0, y1 - y0, 80);
  const size = Math.round(Math.min(w, h, span * (1 + pad * 2)));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: Math.round(Math.max(0, Math.min(w - size, cx - size / 2))), y: Math.round(Math.max(0, Math.min(h - size, cy - size / 2))), w: size, h: size };
}

export default function NailStudio({ photos = [], market = "US", onSend, sendLabel }: {
  photos?: string[]; // ảnh tay có sẵn (VD khách gửi trong chat)
  market?: "US" | "AU";
  onSend?: (r: StudioResult) => Promise<void>;
  sendLabel?: string;
}) {
  useTr();
  const [photo, setPhoto] = useState<{ view: string; w: number; h: number } | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [nails, setNails] = useState<NailInfo[]>([]);
  const [profile, setProfile] = useState<HandProfile | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [working, setWorking] = useState(false); // đang nhận 1 móng vừa chạm
  const [manual, setManual] = useState(false); // chế độ chạm gốc + đầu móng
  const [pending, setPending] = useState<Pt | null>(null);
  const [step, setStep] = useState<"photo" | "mark" | "looks">("photo");
  const [salt, setSalt] = useState(() => Math.random().toString(36).slice(2, 8));
  const [shape, setShape] = useState<ShapeOpt>("natural");
  const [lengthFactor, setLengthFactor] = useState(1.35);
  const [styled, setStyled] = useState(0); // tăng mỗi lần bộ máy vẽ lại mặt nạ theo dáng mới
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const engine = useRef<TryOnClient | null>(null);
  const motifs = useRef<Record<string, SVGSVGElement | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const added = useRef<string[]>([]); // thứ tự móng đã thêm (để Hoàn tác)
  const seq = useRef(0);

  const extension = shape !== "natural";
  const looks: (StudioLook | AdviceLook)[] = useMemo(
    () => (profile ? adviceLooks(profile, market, salt, extension) : studioLooks(10, market, salt)),
    [profile, market, salt, extension],
  );
  const crop = useMemo(() => (photo ? cropOf(nails, photo.w, photo.h) : { x: 0, y: 0, w: 1, h: 1 }), [nails, photo]);

  const freeUrls = () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; };
  useEffect(() => () => { freeUrls(); engine.current?.dispose(); }, []);
  useEffect(() => () => { if (photo?.view) URL.revokeObjectURL(photo.view); }, [photo?.view]);

  const apply = (r: TryOnReply) => { if (r.kind === "nails") { setNails(r.nails); setProfile(r.profile); } return r; };

  const load = async (src: string | Blob) => {
    setLoadingPhoto(true);
    try {
      const p = await loadPhoto(src);
      engine.current?.dispose();
      engine.current = new TryOnClient();
      await engine.current.call({ kind: "image", img: { w: p.w, h: p.h, buffer: p.pixels.data.buffer as ArrayBuffer } });
      setPhoto({ view: URL.createObjectURL(p.blob), w: p.w, h: p.h });
      setNails([]); setProfile(null); setPending(null); setPicked(new Set()); setPreviews({}); freeUrls(); added.current = [];
      setShape("natural"); setManual(false); setStep("mark");
      // TỰ NHẬN MÓNG (chạy nền) — khách không phải chạm gì
      setDetecting(true);
      engine.current.call({ kind: "auto" }).then((r) => {
        apply(r);
        const n = r.kind === "nails" ? r.nails.length : 0;
        if (n) added.current = r.kind === "nails" ? r.nails.map((x) => x.id) : [];
      }).catch(() => {}).finally(() => setDetecting(false));
    } catch {
      toast.error(tr("Không mở được ảnh này — thử ảnh khác.", "Couldn't open this photo — try another."));
    } finally {
      setLoadingPhoto(false);
    }
  };

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!photo || step !== "mark" || detecting || working || !engine.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * photo.w, y: ((e.clientY - r.top) / r.height) * photo.h };
    if (manual) {
      if (!pending) { setPending(p); return; }
      const id = `m${seq.current++}`, mark = { base: pending, tip: p };
      setPending(null); setWorking(true);
      engine.current.call({ kind: "nail", id, mark }).then((rep) => { apply(rep); added.current.push(id); }).catch(() => {}).finally(() => setWorking(false));
      return;
    }
    // chạm vào viền móng đã nhận → bỏ móng đó
    const hit = nails.find((n) => inPoly(p, n.outline));
    if (hit) {
      engine.current.call({ kind: "drop", id: hit.id }).then(apply).catch(() => {});
      added.current = added.current.filter((x) => x !== hit.id);
      toast(tr("Đã bỏ móng đó.", "Nail removed."), { icon: "🗑️" });
      return;
    }
    if (nails.length >= 5) { toast(tr("Đã đủ 5 móng — bấm Tạo mẫu.", "All 5 nails found — tap Create.")); return; }
    const id = `t${seq.current++}`;
    setWorking(true);
    engine.current.call({ kind: "tap", id, point: p }).then((rep) => {
      apply(rep);
      if (rep.kind === "nails" && rep.added) added.current.push(id);
      else toast(tr("Chưa nhận ra móng ở đó — chạm đúng giữa móng, hoặc bật “Chạm gốc + đầu”.", "Couldn't find a nail there — tap its centre, or switch on “Tap base + tip”."), { icon: "👆" });
    }).catch(() => {}).finally(() => setWorking(false));
  };

  const undo = () => {
    if (pending) { setPending(null); return; }
    const id = added.current.pop();
    if (id) engine.current?.call({ kind: "drop", id }).then(apply).catch(() => {});
  };

  // Quay lại sửa móng: về dáng móng thật (viền trên ảnh = đúng móng thật, không kèm phần đắp)
  const editNails = () => {
    setStep("mark");
    engine.current?.call({ kind: "style", lengthFactor: 1, shape: "oval" }).then(apply).catch(() => {});
  };

  // Đổi dáng / độ dài đắp → bộ máy vẽ lại mặt nạ từng móng (nhanh, không khớp khuôn lại)
  useEffect(() => {
    if (step !== "looks" || !engine.current) return;
    let live = true;
    const lf = shape === "natural" ? 1 : lengthFactor;
    const t = setTimeout(() => {
      engine.current?.call({ kind: "style", lengthFactor: lf, shape: shape === "natural" ? "oval" : shape }).then((r) => {
        if (!live) return;
        apply(r);
        setStyled((x) => x + 1);
      }).catch(() => {});
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [step, shape, lengthFactor]);

  // Vẽ lần lượt 10 mẫu (chạy nền) mỗi khi bộ mẫu / dáng móng đổi
  const renderAll = useCallback(async (isLive: () => boolean) => {
    if (!engine.current || !photo) return;
    for (const look of looks) {
      if (!isLive()) return;
      let motif: RawImg | null = null;
      const svg = motifs.current[look.id];
      if (svg && nails.some((n) => hasMotif(look.pattern, n.accent, nails.length))) {
        try { const px = await svgPixels(svg, crop.w, crop.h); motif = { w: crop.w, h: crop.h, buffer: px.data.buffer as ArrayBuffer }; } catch { motif = null; }
      }
      try {
        const r = await engine.current.call({ kind: "render", look: lookColors(look), motif, crop });
        if (!isLive() || r.kind !== "image") return;
        const c = document.createElement("canvas");
        c.width = r.img.w; c.height = r.img.h;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.img.buffer), r.img.w, r.img.h), 0, 0);
        const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", 0.9));
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setPreviews((p) => ({ ...p, [look.id]: { url, blob } }));
      } catch {
        if (!isLive()) return;
      }
    }
  }, [looks, photo, crop, nails]);

  useEffect(() => {
    if (step !== "looks" || !nails.length || !styled) return;
    let live = true;
    // chờ lớp hoạ tiết (SVG ẩn) gắn vào trang rồi mới vẽ (bỏ ảnh mẫu cũ — dáng / bộ mẫu đã đổi)
    const t = setTimeout(() => { setPreviews({}); renderAll(() => live); }, 30);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, styled, salt]);

  const exportPicked = async (): Promise<StudioResult> => {
    const chosen = looks.filter((l) => picked.has(l.id) && previews[l.id]);
    const blobs: Blob[] = [];
    for (const l of chosen) {
      const bmp = await createImageBitmap(previews[l.id].blob);
      blobs.push(await labelJpeg(bmp));
      bmp.close();
    }
    return { blobs, looks: chosen };
  };

  const send = async () => {
    if (!picked.size) return toast.error(tr("Chọn ít nhất 1 mẫu.", "Pick at least one look."));
    setBusy(true);
    try {
      const r = await exportPicked();
      if (!r.blobs.length) throw new Error(tr("Mẫu đang vẽ — đợi 1 chút.", "Still painting — one moment."));
      if (onSend) await onSend(r);
      else {
        // KHÁCH: gửi thẳng ảnh mẫu cho thợ / tiệm quen qua Zalo, Messenger, iMessage… (bảng chia sẻ của điện thoại);
        // máy không chia sẻ được ảnh → tải về
        const files = r.blobs.map((b, i) => new File([b], `pawnail-tryon-${i + 1}.jpg`, { type: "image/jpeg" }));
        if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
          try {
            await navigator.share({ files, title: "PawNail", text: tr(`Mẫu mình thử trên tay: ${r.looks.map((l) => l.title.vi).join(", ")} — tiệm làm được không ạ?`, `Looks I tried on my hand: ${r.looks.map((l) => l.title.en).join(", ")} — can you do these?`) });
            return;
          } catch (e) { if ((e as Error).name === "AbortError") return; }
        }
        r.blobs.forEach((b, i) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = `pawnail-tryon-${i + 1}.jpg`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        });
        toast.success(tr(`Đã tải ${r.blobs.length} ảnh mẫu — gửi cho tiệm qua Zalo / Messenger.`, `Saved ${r.blobs.length} looks — send them to your salon.`));
      }
    } catch (e) {
      toast.error((e as Error).message || tr("Không xuất được ảnh.", "Couldn't export."));
    } finally {
      setBusy(false);
    }
  };

  const pill = (on: boolean) => `min-h-[34px] flex-shrink-0 rounded-full px-3 text-xs font-bold ${on ? "bg-pink-600 text-white" : "bg-white/[0.06] text-slate-300 ring-1 ring-white/10"}`;
  const plain = nails.find((n) => !n.byColor);
  const sw = photo ? photo.w / 160 : 1;
  const good = profile ? bestShape(profile) : null;

  const profileCard = profile && (
    <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-pink-500/10 to-fuchsia-500/5 p-3 ring-1 ring-pink-400/20" data-testid="hand-profile">
      <span className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-full ring-2 ring-white/30" style={{ background: profile.skinHex }} aria-hidden />
      <div className="min-w-0 text-xs leading-relaxed text-slate-200">
        <p className="font-black text-white">{tr("Soi tay của bạn", "Your hand")}</p>
        {profileChips(profile).map((c, i) => <p key={i}>{tr(c.vi, c.en)}</p>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />

      {step === "photo" && (
        <section className="space-y-3">
          <p className="text-sm text-slate-300">{tr("Chụp mu bàn tay (thấy rõ móng, đủ sáng) — máy tự nhận móng và gợi ý mẫu hợp tay:", "Snap the back of the hand (nails clearly visible, good light) — we find the nails and suggest looks that suit the hand:")}</p>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((u) => (
                <button key={u} type="button" onClick={() => load(u)} className="overflow-hidden rounded-2xl ring-1 ring-white/10 hover:ring-pink-400/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={loadingPhoto} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-60">
            {loadingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}{tr("Chụp / chọn ảnh tay", "Take / choose a hand photo")}
          </button>
        </section>
      )}

      {photo && step === "mark" && (
        <section className="space-y-3">
          {/* Cao CỐ ĐỊNH: chữ hướng dẫn đổi theo trạng thái mà đổi chiều cao thì ảnh nhảy → chạm lệch móng */}
          <p className="flex min-h-[68px] items-center gap-2 rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-sm leading-snug text-slate-200 ring-1 ring-white/10" aria-live="polite">
            {detecting || working ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pink-300" /> : null}
            <span>
              {detecting
                ? tr("Đang tìm móng trên ảnh…", "Finding the nails…")
                : manual
                  ? pending
                    ? tr("Giờ chạm vào ĐẦU móng đó (mép móng phía ngoài).", "Now tap the TIP of that nail (free edge).")
                    : tr("Chạm GỐC móng (sát da) rồi chạm ĐẦU móng.", "Tap the nail BASE (at the cuticle), then its TIP.")
                  : nails.length
                    ? tr(`Đã nhận ${nails.length} móng. Móng nào còn thiếu: chạm 1 lần vào giữa móng · nhận nhầm: chạm vào viền để bỏ.`, `${nails.length} nails found. Missing one? Tap its centre once · wrong one? Tap its outline to remove.`)
                    : tr("Chưa tự nhận được móng — chạm 1 lần vào giữa từng móng.", "Couldn't find nails automatically — tap the centre of each nail.")}
            </span>
          </p>
          <div className="relative cursor-crosshair overflow-hidden rounded-2xl ring-1 ring-white/10" onClick={tap} data-busy={detecting || working ? "1" : "0"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.view} alt={tr("Ảnh tay khách", "Client's hand")} className="block w-full select-none" draggable={false} />
            <svg viewBox={`0 0 ${photo.w} ${photo.h}`} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="nail-overlay">
              {nails.map((n, i) => (
                <g key={n.id}>
                  {/* viền móng máy đã nhận — đúng mép móng thật (hồng: nhận theo màu; vàng: móng gần màu da) */}
                  <polygon data-nail={i} data-bycolor={n.byColor ? "1" : "0"} points={n.outline.map((q) => `${q.x},${q.y}`).join(" ")} fill={n.byColor ? "rgba(236,72,153,0.18)" : "rgba(251,191,36,0.16)"} stroke={n.byColor ? "#f472b6" : "#fbbf24"} strokeWidth={sw * 0.7} strokeLinejoin="round" />
                </g>
              ))}
              {pending && <circle cx={pending.x} cy={pending.y} r={photo.w / 70} fill="#ec4899" stroke="#fff" strokeWidth={photo.w / 300} />}
            </svg>
            {detecting && <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-pink-500/10 to-transparent" aria-hidden />}
          </div>
          {plain && <p className="text-xs text-amber-300">{tr("Viền vàng: móng gần màu da — máy vẽ theo điểm chạm, kiểm tra lại cho chuẩn.", "Yellow outline: nail is close to skin tone — check it looks right.")}</p>}
          {profileCard}
          <button type="button" onClick={() => { setManual((m) => !m); setPending(null); }} aria-pressed={manual} className={`flex min-h-[40px] w-full items-center justify-center gap-2 rounded-2xl text-xs font-bold ring-1 ${manual ? "bg-pink-600/20 text-pink-200 ring-pink-400/40" : "bg-white/[0.04] text-slate-300 ring-white/10"}`}>
            {manual ? <Hand className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
            {manual ? tr("Đang chạm gốc + đầu móng — bấm để về chạm 1 lần", "Tap base + tip mode — tap to switch back") : tr("Móng khó nhận? Chạm gốc + đầu móng", "Hard nail? Tap base + tip instead")}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={undo} disabled={!pending && !nails.length} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10 disabled:opacity-40"><Undo2 className="h-4 w-4" />{tr("Hoàn tác", "Undo")}</button>
            <button type="button" onClick={() => { setPhoto(null); setStep("photo"); }} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><RotateCcw className="h-4 w-4" />{tr("Ảnh khác", "New photo")}</button>
            <button type="button" onClick={() => { setPicked(new Set()); setStyled(0); setShape("natural"); setStep("looks"); }} disabled={!nails.length || detecting || working} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-40"><Sparkles className="h-4 w-4" />{tr("Tạo mẫu", "Create")}</button>
          </div>
        </section>
      )}

      {photo && step === "looks" && (
        <section className="space-y-3">
          {profileCard}
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {SHAPES.map((s) => (
              <button key={s} type="button" onClick={() => setShape(s)} className={pill(shape === s)}>
                {tr(SHAPE_VI[s][0], SHAPE_VI[s][1])}{s === good ? " ★" : ""}
              </button>
            ))}
          </div>
          {good && <p className="-mt-1 text-[11px] text-slate-400">{tr(`★ Dáng làm ngón tay bạn thon nhất: ${SHAPE_VI[good][0]}`, `★ Most flattering for your fingers: ${SHAPE_VI[good][1]}`)}</p>}
          {shape !== "natural" && (
            <label className="block space-y-1 text-xs text-slate-400">{tr("Độ dài đắp", "Extension length")}
              <input type="range" min={1.1} max={1.9} step={0.05} value={lengthFactor} onChange={(e) => setLengthFactor(Number(e.target.value))} className="w-full accent-pink-500" />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {looks.map((l) => {
              const on = picked.has(l.id), pv = previews[l.id], adv = "why" in l ? l : null;
              return (
                <button key={l.id} type="button" onClick={() => setPicked((p) => { const n = new Set(p); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} aria-pressed={on} className={`relative overflow-hidden rounded-2xl text-left ring-2 transition ${on ? "ring-pink-500" : "ring-white/10"}`}>
                  {pv ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pv.url} alt={tr(l.title.vi, l.title.en)} data-look={l.id} className="block aspect-square w-full bg-black object-cover" />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-white/[0.04]" data-look-pending={l.id}><Loader2 className="h-6 w-6 animate-spin text-pink-300/70" /></span>
                  )}
                  {adv && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-pink-100 backdrop-blur">{tr(adv.tag.vi, adv.tag.en)}</span>}
                  {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-pink-600"><Check className="h-4 w-4 text-white" /></span>}
                  <span className="block bg-slate-950/90 px-2.5 py-2">
                    <span className="block truncate text-[12px] font-bold text-white">{tr(l.title.vi, l.title.en)}</span>
                    {adv && <span className="mt-0.5 line-clamp-2 block text-[10.5px] leading-snug text-slate-400">{tr(adv.why.vi, adv.why.en)}</span>}
                    <span className="block text-[11px] font-semibold text-emerald-300">{l.priceHint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={editNails} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><Undo2 className="h-4 w-4" />{tr("Sửa móng", "Edit nails")}</button>
            <button type="button" onClick={() => { setSalt(Math.random().toString(36).slice(2, 8)); setPicked(new Set()); }} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><RefreshCw className="h-4 w-4" />{tr("Bộ khác", "New set")}</button>
            <button type="button" onClick={send} disabled={busy || !picked.size} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : onSend ? <Send className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {onSend ? (sendLabel || tr(`Gửi ${picked.size || ""}`, `Send ${picked.size || ""}`)) : tr(`Chia sẻ ${picked.size || ""}`, `Share ${picked.size || ""}`)}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">{tr("Ảnh mẫu thử do PawNail vẽ lên tay khách — giá là giá tham khảo, báo giá chính xác theo menu tiệm.", "Try-on previews drawn by PawNail — prices are estimates; quote from your menu.")}</p>
          {/* lớp hoạ tiết từng mẫu (ẩn) — chỉ cho hoạ tiết bộ máy không tự vẽ; chuyển thành điểm ảnh rồi phủ lên móng thật */}
          <div className="hidden" aria-hidden>
            {looks.map((l) => <TryOnMotif key={l.id} ref={(el) => { motifs.current[l.id] = el; }} look={l} nails={nails} crop={crop} />)}
          </div>
        </section>
      )}
    </div>
  );
}
