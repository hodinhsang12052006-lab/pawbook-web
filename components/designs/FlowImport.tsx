"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCopy, ImagePlus, Loader2, RotateCcw, Undo2, Upload } from "lucide-react";
import { useTr } from "@/lib/i18n/useTr";
import { cdnImage } from "@/lib/cdnImage";
import { flowBatches, type FlowBatch } from "@/lib/designArt";
import { parseFlowFilename } from "@/lib/flowBriefs";
import { FLOW_MAX_SIDE, FLOW_MIN_SIDE, FLOW_SQUARE_TOLERANCE, type FlowMark } from "@/lib/flowMarks";

// Admin → Phòng nội dung → Mẫu nail: nhập ảnh chủ tiệm vẽ bằng Google Flow (Nano Banana).
// Kéo thả nhiều ảnh đặt tên theo mã (D001… hoặc id mẫu) → xem ẢNH CŨ / ẢNH MỚI từng mẫu → chọn → Đăng:
// trình duyệt thu nhỏ (≤ 2048px, JPEG 0.9), tải THẲNG lên Cloudinary bằng chữ ký của máy chủ, rồi /import
// gắn ảnh vào mẫu (ảnh cũ giữ lại, bấm Hoàn tác là về). Thêm "Xuất brief" cho các mẫu chưa có ảnh Flow.

interface FlowRow { code: string; designId: string; title: string; occasion: string | null; status: string | null; imageUrl: string | null; flow: FlowMark | null; was: string | null; found: boolean }
interface Upload { secure_url: string; public_id: string; version: number; signature: string; width: number; height: number; bytes: number }
type Status = "checking" | "ready" | "blocked" | "uploading" | "importing" | "done" | "error" | "undone";
interface Item {
  key: string; file: File; preview: string; code: string | null; w: number; h: number;
  row?: FlowRow; issue?: string; checked: boolean; status: Status; error?: string; upload?: Upload; newUrl?: string;
}
interface Candidate { id: string; titleEn: string; shape: string; pattern: string; finish: string; occasion: string | null }

const CONCURRENCY = 3;
const ACCEPT = "image/jpeg,image/png,image/webp";

async function readSize(file: File): Promise<{ w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const out = { w: bmp.width, h: bmp.height };
    bmp.close();
    return out;
  } catch {
    return { w: 0, h: 0 };
  }
}

/** Thu nhỏ về cạnh dài ≤ 2048 và mã hoá JPEG 0.9 (nền trắng cho ảnh PNG trong suốt). */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, FLOW_MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9));
}

const isSquare = (w: number, h: number) => w > 0 && Math.abs(w - h) <= FLOW_SQUARE_TOLERANCE * Math.max(w, h);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
const postJson = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data;
};

export default function FlowImport() {
  const { tr } = useTr();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [storage, setStorage] = useState(false);
  const [manifest, setManifest] = useState<{ batch: string; rows: FlowRow[]; imported: number } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadManifest = useCallback(() => {
    fetch("/api/admin/designs/flow")
      .then(async (r) => {
        if (!r.ok) { setAllowed(false); return; }
        const d = await r.json();
        setAllowed(true);
        setStorage(!!d.storage);
        setManifest({ batch: d.batch, rows: d.rows, imported: d.imported });
      })
      .catch(() => setAllowed(false));
  }, []);
  useEffect(loadManifest, [loadManifest]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // dọn object URL khi rời trang
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const patch = useCallback((key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i))), []);

  // Lý do KHÔNG cho chọn ảnh (thiếu mã, mã không có mẫu, ảnh nhỏ / không vuông, trùng mẫu với ảnh khác)
  const issueOf = useCallback((it: Item, seen: Set<string>): string | undefined => {
    if (!it.code) return tr("Không đọc được mã trong tên file (cần D001… hoặc id mẫu).", "No code in the file name (expected D001… or a design id).");
    if (!it.row?.found) return tr("Không có mẫu nào cho mã này.", "No design matches this code.");
    if (!it.w) return tr("Không đọc được ảnh.", "Could not read this image.");
    if (Math.min(it.w, it.h) < FLOW_MIN_SIDE) return tr(`Ảnh nhỏ hơn ${FLOW_MIN_SIDE}px.`, `Image is smaller than ${FLOW_MIN_SIDE}px.`);
    if (!isSquare(it.w, it.h)) return tr("Ảnh không vuông 1:1.", "Image is not square (1:1).");
    if (seen.has(it.row.designId)) return tr("Trùng mẫu với ảnh khác trong danh sách.", "Another image in this list targets the same design.");
    seen.add(it.row.designId);
    return undefined;
  }, [tr]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => ACCEPT.split(",").includes(f.type) || (!f.type && /\.(jpe?g|png|webp)$/i.test(f.name))).slice(0, 300);
    if (!list.length) return;
    // đọc kích thước từng nhóm 6 ảnh (thả 200 ảnh một lúc không giải mã cùng lúc → không ngốn RAM trên điện thoại)
    const fresh: Item[] = [];
    const stamp = Date.now();
    for (let k = 0; k < list.length; k += 6) {
      fresh.push(...(await Promise.all(list.slice(k, k + 6).map(async (file, n) => ({
        key: `${stamp}-${k + n}-${file.name}`, file, preview: URL.createObjectURL(file), code: parseFlowFilename(file.name).code,
        ...(await readSize(file)), checked: false, status: "checking" as Status,
      })))));
    }
    setItems((cur) => [...cur, ...fresh]);
    const codes = [...new Set(fresh.flatMap((i) => (i.code ? [i.code] : [])))];
    const rows = new Map<string, FlowRow>();
    for (let k = 0; k < codes.length; k += 100) {
      const res = await fetch(`/api/admin/designs/flow?codes=${encodeURIComponent(codes.slice(k, k + 100).join(","))}`).catch(() => null);
      const d = res && res.ok ? await res.json().catch(() => null) : null;
      for (const r of (d?.rows ?? []) as FlowRow[]) rows.set(r.code, r);
    }
    setItems((cur) => {
      const seen = new Set(cur.filter((i) => i.status !== "checking" && !i.issue && i.row).map((i) => i.row!.designId));
      return cur.map((i) => {
        if (i.status !== "checking") return i;
        const row = i.code ? rows.get(i.code) : undefined;
        const withRow = { ...i, row };
        const issue = issueOf(withRow, seen);
        return { ...withRow, issue, status: issue ? "blocked" : "ready", checked: !issue && !row?.flow };
      });
    });
  }, [issueOf]);

  const runOne = useCallback(async (it: Item) => {
    try {
      let upload = it.upload;
      if (!upload) {
        patch(it.key, { status: "uploading", error: undefined });
        const s = await postJson("/api/admin/designs/flow/sign", { code: it.code });
        const blob = await toJpeg(it.file);
        const form = new FormData();
        form.append("file", blob, `${it.code}.jpg`);
        form.append("api_key", s.apiKey);
        form.append("signature", s.signature);
        for (const [k, v] of Object.entries(s.params as Record<string, string | number>)) form.append(k, String(v));
        const res = await fetch(s.uploadUrl, { method: "POST", body: form });
        const up = await res.json().catch(() => ({}));
        if (!res.ok || !up.secure_url) throw new Error(up?.error?.message || tr("Tải ảnh lên Cloudinary không được.", "Cloudinary upload failed."));
        upload = { secure_url: up.secure_url, public_id: up.public_id, version: up.version, signature: up.signature, width: up.width, height: up.height, bytes: up.bytes };
        patch(it.key, { upload });
      }
      patch(it.key, { status: "importing", error: undefined });
      const r = await postJson("/api/admin/designs/flow/import", { code: it.code, ...upload });
      patch(it.key, { status: "done", checked: false, newUrl: r.imageUrl, row: it.row ? { ...it.row, flow: r.flow } : it.row });
    } catch (err) {
      const msg = (err as Error).message;
      // ảnh tải lên quá cũ → lần thử lại tải lên lại
      patch(it.key, { status: "error", error: msg, ...(/too old|quá cũ/i.test(msg) ? { upload: undefined } : {}) });
    }
  }, [patch, tr]);

  const runAll = async (queue: Item[]) => {
    if (!queue.length) return;
    setRunning(true);
    const q = [...queue];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, q.length) }, async () => {
      while (q.length) await runOne(q.shift()!);
    }));
    setRunning(false);
    loadManifest();
  };

  const undo = async (it: Item) => {
    if (!it.row) return;
    patch(it.key, { status: "importing", error: undefined });
    try {
      await postJson("/api/admin/designs/flow/undo", { designId: it.row.designId });
      patch(it.key, { status: "undone", row: { ...it.row, flow: null } });
      loadManifest();
    } catch (err) {
      patch(it.key, { status: "error", error: (err as Error).message });
    }
  };

  const selectable = items.filter((i) => !i.issue && ["ready", "error", "undone"].includes(i.status));
  const selected = selectable.filter((i) => i.checked);
  const allOn = selectable.length > 0 && selected.length === selectable.length;
  const doneCount = items.filter((i) => i.status === "done").length;

  if (!allowed) return null; // chỉ admin (API trả 403 cho người khác)

  return (
    <section id="anh-flow" aria-label={tr("Ảnh từ Google Flow", "Images from Google Flow")} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
        <div className="min-w-0 sm:flex-1">
          <h3 className="flex items-center gap-2 text-base font-bold text-white"><ImagePlus className="h-4 w-4 text-slate-300" /> {tr("Ảnh từ Google Flow", "Images from Google Flow")}</h3>
          <p className="text-xs text-slate-400">
            {tr(
              "Kéo thả ảnh Flow đã đặt tên theo mã (D001… hoặc id mẫu). Xem ảnh cũ và ảnh mới, chọn ảnh muốn dùng rồi bấm Đăng. Ảnh cũ được giữ lại — bấm Hoàn tác là về như trước.",
              "Drop Flow images named by their code (D001… or a design id). Compare the current and new image, pick the ones to use, then Publish. The old image is kept — Undo puts it back.",
            )}
          </p>
        </div>
        {manifest && (
          <p data-testid="flow-progress" className="shrink-0 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
            {tr(`Lô ${manifest.batch}: ${manifest.imported}/${manifest.rows.length} mẫu đã có ảnh Flow`, `Batch ${manifest.batch}: ${manifest.imported}/${manifest.rows.length} designs have a Flow image`)}
          </p>
        )}
      </div>
      {allowed && !storage && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">
          {tr("Máy chủ chưa cấu hình Cloudinary — chỉ xem trước được, chưa đăng được.", "Cloudinary is not configured on the server — preview only, publishing is disabled.")}
        </p>
      )}

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${drag ? "border-slate-300 bg-white/[0.06]" : "border-white/20 bg-white/[0.02] hover:bg-white/[0.04]"}`}
      >
        <Upload className="h-5 w-5 text-slate-400" />
        <span className="text-sm font-semibold text-slate-200">{tr("Kéo thả ảnh vào đây hoặc bấm để chọn", "Drop images here or click to choose")}</span>
        <span className="text-[11px] text-slate-500">{tr("JPG / PNG / WebP, vuông, từ 1024px · chọn được nhiều ảnh", "JPG / PNG / WebP, square, 1024px or larger · multiple files")}</span>
        <input ref={inputRef} data-testid="flow-files" type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </label>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
          <label className="inline-flex min-h-[36px] items-center gap-2 text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              data-testid="flow-select-all"
              checked={allOn}
              disabled={!selectable.length || running}
              onChange={() => { const keys = new Set(selectable.map((i) => i.key)); setItems((list) => list.map((i) => (keys.has(i.key) ? { ...i, checked: !allOn } : i))); }}
              className="h-4 w-4 accent-slate-200"
            />
            {tr(`Chọn tất cả (${selected.length}/${selectable.length})`, `Select all (${selected.length}/${selectable.length})`)}
          </label>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {doneCount > 0 && <span className="text-xs text-emerald-300">{tr(`Đã đăng ${doneCount}`, `${doneCount} published`)}</span>}
            <button
              type="button"
              onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.preview)); setItems([]); }}
              disabled={running}
              className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/15 disabled:opacity-40"
            >
              {tr("Xoá hết", "Clear")}
            </button>
            <button
              type="button"
              data-testid="flow-publish"
              onClick={() => runAll(selected)}
              disabled={!selected.length || running || !storage}
              className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-900 disabled:opacity-40 sm:flex-none"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {tr(`Đăng ${selected.length} ảnh đã chọn`, `Publish ${selected.length} selected`)}
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div data-testid="flow-grid" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => <ReviewCard key={it.key} it={it} busy={running} onToggle={() => patch(it.key, { checked: !it.checked })} onRetry={() => runAll([it])} onUndo={() => undo(it)} />)}
        </div>
      )}

      {manifest && <ImportedList rows={manifest.rows.filter((r) => r.flow)} onChange={loadManifest} />}
      <ExportBriefs />
    </section>
  );
}

function StatusPill({ s }: { s: Status }) {
  const { tr } = useTr();
  const map: Record<Status, [string, string]> = {
    checking: [tr("Đang kiểm tra", "Checking"), "text-slate-300 ring-white/15"],
    ready: [tr("Sẵn sàng", "Ready"), "text-slate-200 ring-white/20"],
    blocked: [tr("Không dùng được", "Can't use"), "text-amber-200 ring-amber-400/40"],
    uploading: [tr("Đang tải lên", "Uploading"), "text-sky-200 ring-sky-400/40"],
    importing: [tr("Đang lưu", "Saving"), "text-sky-200 ring-sky-400/40"],
    done: [tr("Đã đăng", "Published"), "text-emerald-200 ring-emerald-400/40"],
    error: [tr("Lỗi", "Error"), "text-rose-200 ring-rose-400/40"],
    undone: [tr("Đã hoàn tác", "Undone"), "text-slate-300 ring-white/15"],
  };
  const [label, cls] = map[s];
  return <span data-testid="flow-status" className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>{label}</span>;
}

function ReviewCard({ it, busy, onToggle, onRetry, onUndo }: { it: Item; busy: boolean; onToggle: () => void; onRetry: () => void; onUndo: () => void }) {
  const { tr } = useTr();
  const r = it.row;
  const working = it.status === "uploading" || it.status === "importing";
  const canPick = !it.issue && ["ready", "error", "undone"].includes(it.status);
  return (
    <article data-testid="flow-card" data-code={it.code ?? ""} className="min-w-0 rounded-xl border border-white/10 bg-slate-900/70 p-3">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          aria-label={tr(`Chọn ${it.code ?? it.file.name}`, `Select ${it.code ?? it.file.name}`)}
          checked={it.checked && canPick}
          disabled={!canPick || busy}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-200"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-slate-400">
            <span className="text-slate-200">{it.code ?? "—"}</span>
            {r?.designId && r.designId !== it.code ? <span className="font-mono"> · {r.designId.slice(0, 10)}…</span> : null}
          </p>
          <p className="truncate text-sm font-semibold text-white" title={r?.title || it.file.name}>{r?.title || it.file.name}</p>
        </div>
        <StatusPill s={it.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <figure className="min-w-0">
          <div className="aspect-square overflow-hidden rounded-lg bg-slate-800">
            {r?.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cdnImage(r.imageUrl, 360)} alt={tr("Ảnh hiện tại", "Current image")} loading="lazy" className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-[11px] text-slate-500">{tr("Chưa có ảnh", "No image")}</div>}
          </div>
          <figcaption className="mt-1 truncate text-[11px] text-slate-400">{it.status === "done" ? tr("Ảnh cũ (đã cất)", "Old image (kept)") : tr("Ảnh hiện tại", "Current image")}</figcaption>
        </figure>
        <figure className="min-w-0">
          <div className="aspect-square overflow-hidden rounded-lg bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.preview} alt={tr("Ảnh mới từ Flow", "New Flow image")} loading="lazy" className="h-full w-full object-cover" />
          </div>
          <figcaption className="mt-1 truncate text-[11px] text-slate-400">{tr("Ảnh mới", "New")} · {it.w}×{it.h}<span className="hidden sm:inline"> · {kb(it.file.size)}</span></figcaption>
        </figure>
      </div>
      {r?.flow && it.status !== "done" && !it.issue && (
        <p className="mt-2 text-[11px] text-slate-400">{tr(`Mẫu này đã có ảnh Flow (${r.flow.code}, ${r.flow.date}) — đăng sẽ thay ảnh đó.`, `Already has a Flow image (${r.flow.code}, ${r.flow.date}) — publishing replaces it.`)}</p>
      )}
      {r?.found && r.status !== "published" && !it.issue && (
        <p className="mt-2 text-[11px] text-slate-400">{tr(`Mẫu đang ở trạng thái "${r.status}" — khách chưa thấy mẫu này.`, `This design is "${r.status}" — clients can't see it yet.`)}</p>
      )}
      {it.issue && <p className="mt-2 text-xs text-amber-200">{it.issue}</p>}
      {it.error && <p className="mt-2 break-words text-xs text-rose-300">{it.error}</p>}
      {(it.status === "error" || it.status === "done" || working) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {it.status === "error" && (
            <button type="button" onClick={onRetry} disabled={busy} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" /> {tr("Thử lại", "Retry")}
            </button>
          )}
          {it.status === "done" && (
            <button type="button" data-testid="flow-undo" onClick={onUndo} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15">
              <Undo2 className="h-3.5 w-3.5" /> {tr("Hoàn tác", "Undo")}
            </button>
          )}
          {working && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {tr("Đang xử lý…", "Working…")}</span>}
        </div>
      )}
    </article>
  );
}

/** Ảnh Flow lô hiện tại đã nhập (sau khi tải lại trang vẫn hoàn tác được). */
function ImportedList({ rows, onChange }: { rows: FlowRow[]; onChange: () => void }) {
  const { tr } = useTr();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!rows.length) return null;
  const undo = async (r: FlowRow) => {
    setBusy(r.designId);
    setErr(null);
    try { await postJson("/api/admin/designs/flow/undo", { designId: r.designId }); onChange(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };
  return (
    <details className="rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">{tr(`Ảnh Flow đã đăng (${rows.length})`, `Published Flow images (${rows.length})`)}</summary>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
      <ul className="mt-2 divide-y divide-white/5">
        {rows.map((r) => (
          <li key={r.designId} className="flex items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.imageUrl && <img src={cdnImage(r.imageUrl, 96)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{r.code} · {r.title}</p>
              <p className="text-[11px] text-slate-500">{r.flow?.date}</p>
            </div>
            <button type="button" onClick={() => undo(r)} disabled={busy === r.designId} className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">
              {busy === r.designId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} {tr("Hoàn tác", "Undo")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Brief cho trợ lý Flow: các mẫu đã đăng chưa có ảnh Flow, mã = id mẫu, lô 12 ảnh. */
function ExportBriefs() {
  const { tr } = useTr();
  const [list, setList] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const batches: FlowBatch[] = useMemo(
    () => (list ? flowBatches(list.map((c) => ({ code: c.id, titleEn: c.titleEn, shape: c.shape, pattern: c.pattern, finish: c.finish }))) : []),
    [list],
  );
  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/designs/flow?export=1").catch(() => null);
    const d = res && res.ok ? await res.json().catch(() => null) : null;
    setList(d?.candidates ?? []);
    setAt(0);
    setLoading(false);
  };
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied("fail"); }
    setTimeout(() => setCopied(null), 2500);
  };
  const cur = batches[at];
  return (
    <details className="rounded-xl border border-white/10 p-3" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !list && !loading) load(); }}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">{tr("Xuất brief cho Flow (mẫu chưa có ảnh Flow)", "Export briefs for Flow (designs without a Flow image)")}</summary>
      <p className="mt-2 text-xs text-slate-400">
        {tr(
          "Dán từng lô 12 brief vào trợ lý Google Flow. Mỗi ảnh phải được đổi tên đúng mã brief (id mẫu), rồi kéo thả ảnh vào ô phía trên.",
          "Paste each batch of 12 briefs into the Google Flow agent. Every image must be renamed to its brief code (the design id); then drop the images in the box above.",
        )}
      </p>
      {loading && <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {tr("Đang tải…", "Loading…")}</p>}
      {list && !batches.length && <p className="mt-2 text-xs text-slate-500">{tr("Mẫu nào cũng đã có ảnh Flow.", "Every design already has a Flow image.")}</p>}
      {cur && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p data-testid="flow-export-count" className="text-xs text-slate-300">{tr(`${list!.length} mẫu · ${batches.length} lô`, `${list!.length} designs · ${batches.length} batches`)}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setAt((n) => Math.max(0, n - 1))} disabled={at === 0} className="min-h-[32px] rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">‹</button>
              <span className="px-1 text-xs tabular-nums text-slate-300">{tr(`Lô ${at + 1}/${batches.length}`, `Batch ${at + 1}/${batches.length}`)}</span>
              <button type="button" onClick={() => setAt((n) => Math.min(batches.length - 1, n + 1))} disabled={at >= batches.length - 1} className="min-h-[32px] rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">›</button>
            </div>
          </div>
          <textarea readOnly value={cur.text} rows={7} aria-label={tr("Nội dung lô brief", "Batch brief text")} className="w-full resize-y rounded-lg bg-slate-900 p-2 font-mono text-[11px] leading-relaxed text-slate-200 ring-1 ring-white/10" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(cur.text, "one")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-900">
              <ClipboardCopy className="h-4 w-4" /> {copied === "one" ? tr("Đã sao chép", "Copied") : tr("Sao chép lô này", "Copy this batch")}
            </button>
            <button type="button" onClick={() => copy(batches.map((b) => b.text).join("\n\n"), "all")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-white/15">
              <ClipboardCopy className="h-4 w-4" /> {copied === "all" ? tr("Đã sao chép", "Copied") : tr(`Sao chép tất cả (${batches.length} lô)`, `Copy all (${batches.length} batches)`)}
            </button>
            {copied === "fail" && <span className="self-center text-xs text-rose-300">{tr("Trình duyệt chặn sao chép — bôi đen và copy thủ công.", "Clipboard blocked — select the text and copy it manually.")}</span>}
          </div>
        </div>
      )}
    </details>
  );
}
