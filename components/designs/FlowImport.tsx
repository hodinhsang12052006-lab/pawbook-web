"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, FolderOpen, ImagePlus, Loader2, RotateCcw, Square, Undo2, Upload, X } from "lucide-react";
import { useTr } from "@/lib/i18n/useTr";
import { cdnImage } from "@/lib/cdnImage";
import { flowBatches, type FlowBatch } from "@/lib/designArt";
import { manifestCodeOf, parseFlowFilename, type FilenameIssue } from "@/lib/flowBriefs";
import { FLOW_MAX_SIDE, FLOW_MIN_SIDE, FLOW_SQUARE_TOLERANCE, type FlowMark } from "@/lib/flowMarks";

// Admin → Phòng nội dung → Mẫu nail: nhập ảnh chủ tiệm vẽ bằng Google Flow (Nano Banana).
// Kéo thả nhiều ảnh (hoặc cả thư mục) đặt tên theo mã (D001… hoặc id mẫu) → xem ẢNH CŨ / ẢNH MỚI từng mẫu → chọn →
// Đăng: trình duyệt thu nhỏ (≤ 2048px, JPEG 0.9), tải THẲNG lên Cloudinary bằng chữ ký của máy chủ, rồi /import gắn
// ảnh vào mẫu (ảnh cũ giữ lại, bấm Hoàn tác là về). Thêm "Xuất brief" cho các mẫu chưa có ảnh Flow.

interface FlowRow { code: string; designId: string; title: string; titleVi: string; occasion: string | null; status: string | null; imageUrl: string | null; flow: FlowMark | null; was: string | null; found: boolean }
interface Upload { secure_url: string; public_id: string; version: number; signature: string; width: number; height: number; bytes: number }
type Status = "checking" | "ready" | "blocked" | "queued" | "uploading" | "importing" | "done" | "error" | "undone";
interface Item {
  key: string; file: File; name: string; preview: string; code: string | null; nameIssue?: FilenameIssue; w: number; h: number;
  row?: FlowRow; issue?: string; dupOf?: string; dups?: number; pinned?: boolean;
  checked: boolean; status: Status; error?: string; detail?: string; upload?: Upload; newUrl?: string;
}
interface Candidate { id: string; title: string; titleEn: string; shape: string; pattern: string; finish: string; occasion: string | null; imageUrl: string | null }
interface Run { total: number; ok: number; failed: number; stopped?: boolean }

const CONCURRENCY = 4;
const MAX_FILES = 300;
const ACCEPT = "image/jpeg,image/png,image/webp";
const isImage = (f: File) => ACCEPT.split(",").includes(f.type) || (!f.type && /\.(jpe?g|png|webp)$/i.test(f.name));
const PICKABLE: Status[] = ["ready", "error", "undone"];
const BUSY: Status[] = ["queued", "uploading", "importing"];

// ---------- lỗi: phân loại để báo bằng lời dễ hiểu + tự thử lại lỗi mạng / máy chủ bận ----------
type FailKind = "network" | "auth" | "rate" | "server" | "store" | "conflict" | "image" | "invalid";
class FlowFail extends Error {
  constructor(readonly kind: FailKind, readonly raw: string, readonly retry = false) { super(raw); }
}
const RETRY_WAIT = [1500, 4000]; // tự thử lại 2 lần (mất mạng, máy chủ 5xx, 429) trước khi báo lỗi
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, stopped: () => boolean): Promise<T> {
  for (let n = 0; ; n++) {
    try { return await fn(); } catch (e) {
      const f = e instanceof FlowFail ? e : new FlowFail("server", (e as Error).message);
      if (!f.retry || n >= RETRY_WAIT.length || stopped()) throw f;
      await sleep(RETRY_WAIT[n]);
    }
  }
}
async function call(url: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(url, init); } catch (e) {
    let host = url;
    try { host = new URL(url, window.location.href).host; } catch { /* giữ nguyên */ }
    throw new FlowFail("network", `${(e as Error).message} (${host})`, true);
  }
}
async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<T> {
  const res = await call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.ok && data) return data;
  const raw = data?.error || `HTTP ${res.status}`;
  const s = res.status;
  if (s === 401 || s === 403) throw new FlowFail("auth", raw);
  if (s === 429) throw new FlowFail("rate", raw, true);
  if (s === 409) throw new FlowFail("conflict", raw);
  if (s >= 500 || !data) throw new FlowFail("server", raw, true);
  throw new FlowFail("invalid", raw);
}

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

/** Thu nhỏ về cạnh dài ≤ 2048 và mã hoá JPEG 0.9 (nền trắng cho ảnh PNG trong suốt). JPEG đã ≤ 2048 → gửi nguyên. */
async function uploadBlob(it: Item): Promise<Blob> {
  if (it.file.type === "image/jpeg" && Math.max(it.w, it.h) <= FLOW_MAX_SIDE && it.file.size <= 10 * 1024 * 1024) return it.file;
  try {
    const bmp = await createImageBitmap(it.file);
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
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9));
  } catch (e) {
    throw new FlowFail("image", (e as Error).message);
  }
}

/** File từ 1 lần thả: ảnh lẻ, hoặc đi vào thư mục (kể cả thư mục con, ≤ 4 tầng). `entries` phải lấy NGAY trong sự kiện drop. */
async function collectDropped(files: File[], entries: (FileSystemEntry | null)[]): Promise<File[]> {
  if (!entries.some((e) => e?.isDirectory)) return files;
  const out: File[] = [];
  const walk = async (e: FileSystemEntry | null, depth: number): Promise<void> => {
    if (!e || out.length > MAX_FILES * 3) return;
    if (e.isFile) {
      try { out.push(await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej))); } catch { /* bỏ file đọc không được */ }
      return;
    }
    if (!e.isDirectory || depth > 4) return;
    const reader = (e as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej)).catch(() => [] as FileSystemEntry[]);
      if (!batch.length) break;
      for (const c of batch) await walk(c, depth + 1);
    }
  };
  for (const e of entries) await walk(e, 0);
  return out;
}

const isSquare = (w: number, h: number) => w > 0 && Math.abs(w - h) <= FLOW_SQUARE_TOLERANCE * Math.max(w, h);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** Trùng mẫu: mỗi mẫu chỉ 1 file được dùng — file chủ tiệm chọn (pinned), không thì file MỚI NHẤT; các file khác chờ. */
function arrange(list: Item[]): Item[] {
  const groups = new Map<string, Item[]>();
  for (const i of list) {
    if (i.issue || !i.row?.found || !PICKABLE.includes(i.status)) continue;
    groups.set(i.row.designId, [...(groups.get(i.row.designId) ?? []), i]);
  }
  const winner = new Map<string, { key: string; n: number }>();
  for (const g of groups.values()) {
    const w = g.find((i) => i.pinned) ?? [...g].sort((a, b) => b.file.lastModified - a.file.lastModified || b.name.localeCompare(a.name))[0];
    for (const i of g) winner.set(i.key, { key: w.key, n: g.length - 1 });
  }
  return list.map((i) => {
    const w = winner.get(i.key);
    if (!w) return i.dupOf || i.dups ? { ...i, dupOf: undefined, dups: undefined } : i;
    if (w.key === i.key) return { ...i, dupOf: undefined, dups: w.n || undefined, checked: i.dupOf ? !i.row?.flow : i.checked };
    return { ...i, dupOf: w.key, dups: undefined, checked: false };
  });
}

export default function FlowImport() {
  const { tr, locale } = useTr();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [storage, setStorage] = useState(false);
  const [manifest, setManifest] = useState<{ batch: string; rows: FlowRow[]; imported: number } | null>(null);
  const [importedRows, setImportedRows] = useState<FlowRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [confirm, setConfirm] = useState<"clear" | "undo" | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const stopRef = useRef(false);
  const runningRef = useRef(false);

  const loadManifest = useCallback(() => {
    fetch("/api/admin/designs/flow")
      .then(async (r) => {
        if (!r.ok) { setAllowed(false); return; }
        const d = await r.json();
        setAllowed(true);
        setStorage(!!d.storage);
        setManifest({ batch: d.batch, rows: d.rows, imported: d.imported });
        setImportedRows(d.importedRows ?? []);
      })
      .catch(() => setAllowed((a) => a ?? false));
  }, []);
  useEffect(loadManifest, [loadManifest]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // dọn object URL khi rời trang
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);
  // đang đăng mà tải lại / đóng tab → trình duyệt hỏi lại trước khi bỏ dở
  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [running]);
  // thả ảnh lệch ra ngoài khung: chặn trình duyệt mở ảnh (mất cả danh sách đang xem / đang đăng)
  useEffect(() => {
    if (!allowed) return;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types ?? []).includes("Files");
    const inside = (e: DragEvent) => !!sectionRef.current && e.target instanceof Node && sectionRef.current.contains(e.target);
    const over = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (!inside(e) && e.dataTransfer) e.dataTransfer.dropEffect = "none"; };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (!inside(e)) setNotice(tr("Thả ảnh vào khung “Ảnh từ Google Flow” nhé.", "Drop the images inside the “Images from Google Flow” panel."));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); };
  }, [allowed, tr]);

  const patch = useCallback((key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i))), []);
  /** Lỗi máy chủ "tiếng Việt / English" → đúng 1 ngôn ngữ đang dùng. */
  const pick = useCallback((msg: string) => { const i = msg.indexOf(" / "); return i > 0 ? tr(msg.slice(0, i), msg.slice(i + 3)) : msg; }, [tr]);
  const explain = useCallback((e: unknown): { error: string; detail?: string } => {
    const f = e instanceof FlowFail ? e : new FlowFail("server", (e as Error)?.message ?? String(e));
    const msg: Record<FailKind, string> = {
      network: tr("Mất kết nối — kiểm tra Wi-Fi rồi bấm Thử lại.", "Connection lost — check your Wi-Fi, then press Retry."),
      auth: tr("Phiên đăng nhập hết hạn — đăng nhập lại rồi bấm Đăng.", "Your session has expired — sign in again, then press Publish."),
      rate: tr("Đăng quá nhiều trong 1 giờ — đợi một lúc rồi bấm Thử lại.", "Too many uploads this hour — wait a while, then press Retry."),
      server: tr("Máy chủ đang bận — đợi vài phút rồi bấm Thử lại.", "The server is busy — wait a few minutes, then press Retry."),
      store: tr("Kho ảnh từ chối ảnh này — bấm Thử lại; vẫn lỗi thì lưu lại ảnh dạng JPG rồi thả lại.", "The image store rejected this image — press Retry; if it still fails, re-save it as JPG and drop it again."),
      conflict: tr("Mẫu vừa được đổi ở nơi khác — bấm Thử lại.", "This design was just changed elsewhere — press Retry."),
      image: tr("Trình duyệt không đọc được ảnh này — mở ảnh, lưu lại dạng JPG rồi thả lại.", "The browser can't read this image — open it, save it as JPG and drop it again."),
      invalid: pick(f.raw),
    };
    const error = msg[f.kind];
    return { error, detail: f.raw && f.raw !== error ? f.raw : undefined };
  }, [tr, pick]);

  // Lý do KHÔNG cho chọn ảnh (tên file, mã không có mẫu, ảnh nhỏ / không vuông). Trùng mẫu xử lý riêng (arrange).
  const issueOf = useCallback((it: Item, lookupFailed: boolean): string | undefined => {
    if (it.nameIssue === "ambiguous") return tr("Tên file có nhiều mã khác nhau — đổi tên chỉ còn 1 mã (VD D012.jpg).", "The file name has several different codes — rename it to a single code (e.g. D012.jpg).");
    if (it.nameIssue === "mismatch") return tr("Mã D… và id mẫu trong tên file không cùng một mẫu — đổi tên cho đúng.", "The D-code and the design id in the file name are different designs — fix the name.");
    if (!it.code) return tr("Không đọc được mã trong tên file (cần D001… hoặc id mẫu).", "No code in the file name (expected D001… or a design id).");
    if (!it.row && lookupFailed) return tr("Chưa tra được mã (mất mạng hoặc phiên đăng nhập hết hạn) — thả lại ảnh.", "Couldn't look up the code (offline or signed out) — drop the image again.");
    if (!it.row?.found) return tr("Không có mẫu nào cho mã này.", "No design matches this code.");
    if (!it.w) return tr("Không đọc được ảnh.", "Could not read this image.");
    if (Math.min(it.w, it.h) < FLOW_MIN_SIDE) return tr(`Ảnh nhỏ hơn ${FLOW_MIN_SIDE}px.`, `Image is smaller than ${FLOW_MIN_SIDE}px.`);
    if (!isSquare(it.w, it.h)) return tr("Ảnh không vuông 1:1.", "Image is not square (1:1).");
    return undefined;
  }, [tr]);

  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter(isImage);
    if (!imgs.length) { setNotice(tr("Không thấy ảnh JPG/PNG/WebP nào trong mục vừa thả.", "No JPG/PNG/WebP images found in what you dropped.")); return; }
    const list = imgs.slice(0, MAX_FILES);
    setNotice(imgs.length > MAX_FILES ? tr(`Chỉ lấy ${MAX_FILES}/${imgs.length} ảnh đầu — đăng xong lượt này rồi thả phần còn lại.`, `Only the first ${MAX_FILES} of ${imgs.length} images were added — publish these, then drop the rest.`) : null);
    setReading({ done: 0, total: list.length });
    // đọc kích thước từng nhóm 6 ảnh (thả 200 ảnh một lúc không giải mã cùng lúc → không ngốn RAM trên điện thoại)
    const fresh: Item[] = [];
    const stamp = Date.now();
    for (let k = 0; k < list.length; k += 6) {
      fresh.push(...(await Promise.all(list.slice(k, k + 6).map(async (file, n) => {
        const p = parseFlowFilename(file.name);
        return {
          key: `${stamp}-${k + n}-${file.name}`, file, name: file.name, preview: URL.createObjectURL(file), code: p.code, nameIssue: p.issue,
          ...(await readSize(file)), checked: false, status: "checking" as Status,
        };
      }))));
      setReading({ done: fresh.length, total: list.length });
    }
    setItems((cur) => [...cur, ...fresh]);
    const codes = [...new Set(fresh.flatMap((i) => (i.code ? [i.code] : [])))];
    const rows = new Map<string, FlowRow>();
    let lookupFailed = false;
    for (let k = 0; k < codes.length; k += 100) {
      const res = await fetch(`/api/admin/designs/flow?codes=${encodeURIComponent(codes.slice(k, k + 100).join(","))}`).catch(() => null);
      const d = res && res.ok ? await res.json().catch(() => null) : null;
      if (!d) lookupFailed = true;
      for (const r of (d?.rows ?? []) as FlowRow[]) rows.set(r.code, r);
    }
    const keys = new Set(fresh.map((i) => i.key)); // chỉ ảnh của LẦN THẢ NÀY (lần thả trước còn đang tra thì để nó tự xong)
    setItems((cur) => arrange(cur.map((i) => {
      if (!keys.has(i.key)) return i;
      const row = i.code ? rows.get(i.code) : undefined;
      const withRow = { ...i, row };
      const issue = issueOf(withRow, lookupFailed);
      return { ...withRow, issue, status: issue ? "blocked" : "ready", checked: !issue && !row?.flow };
    })));
    setReading(null);
  }, [issueOf, tr]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setDrag(false);
    if (runningRef.current) { setNotice(tr("Đang đăng — đợi xong lượt này rồi thả thêm ảnh.", "Publishing — wait for this run to finish, then drop more images.")); return; }
    const dt = e.dataTransfer;
    const files = Array.from(dt.files ?? []);
    const entries = Array.from(dt.items ?? []).map((i) => (i.kind === "file" && typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null));
    collectDropped(files, entries).then(addFiles);
  };

  const swap = (key: string) => setItems((list) => {
    const did = list.find((i) => i.key === key)?.row?.designId;
    if (!did) return list;
    return arrange(list.map((i) => (i.row?.designId === did && PICKABLE.includes(i.status) ? { ...i, pinned: i.key === key, checked: i.key === key } : i)));
  });
  const remove = (key: string) => setItems((list) => {
    const it = list.find((i) => i.key === key);
    if (it) URL.revokeObjectURL(it.preview);
    return arrange(list.filter((i) => i.key !== key));
  });

  /** 1 ảnh: (thu nhỏ) → ký → tải thẳng lên Cloudinary → /import. Lỗi mạng / máy chủ bận tự thử lại 2 lần. */
  const runOne = useCallback(async (it: Item): Promise<boolean> => {
    const stopped = () => stopRef.current;
    try {
      let upload = it.upload;
      if (!upload) {
        patch(it.key, { status: "uploading", error: undefined, detail: undefined });
        const blob = await uploadBlob(it);
        upload = await withRetry(async () => {
          const s = await postJson<{ apiKey: string; signature: string; uploadUrl: string; params: Record<string, string | number> }>("/api/admin/designs/flow/sign", { code: it.code });
          const form = new FormData();
          form.append("file", blob, `${it.code}.jpg`);
          form.append("api_key", s.apiKey);
          form.append("signature", s.signature);
          for (const [k, v] of Object.entries(s.params)) form.append(k, String(v));
          const res = await call(s.uploadUrl, { method: "POST", body: form });
          const up = await res.json().catch(() => null);
          if (!res.ok || !up?.secure_url) throw new FlowFail("store", `${up?.error?.message || `HTTP ${res.status}`} (Cloudinary)`, res.status >= 500 || res.status === 429);
          return { secure_url: up.secure_url, public_id: up.public_id, version: up.version, signature: up.signature, width: up.width, height: up.height, bytes: up.bytes } as Upload;
        }, stopped);
        patch(it.key, { upload });
      }
      patch(it.key, { status: "importing", error: undefined, detail: undefined });
      const u = upload;
      const r = await withRetry(() => postJson<{ imageUrl: string; flow: FlowMark }>("/api/admin/designs/flow/import", { code: it.code, ...u }), stopped);
      patch(it.key, { status: "done", checked: false, newUrl: r.imageUrl, row: it.row ? { ...it.row, flow: r.flow } : it.row });
      return true;
    } catch (err) {
      const raw = err instanceof FlowFail ? err.raw : String((err as Error)?.message ?? err);
      // ảnh tải lên quá cũ / Cloudinary không xác nhận → lần thử lại tải lên lại từ đầu
      patch(it.key, { status: "error", ...explain(err), ...(/too old|quá cũ|did not confirm|không xác nhận/i.test(raw) ? { upload: undefined } : {}) });
      return false;
    }
  }, [patch, explain]);

  const runAll = async (queue: Item[]) => {
    if (!queue.length || runningRef.current) return;
    runningRef.current = true;
    stopRef.current = false;
    setRunning(true);
    setConfirm(null);
    setRun({ total: queue.length, ok: 0, failed: 0 });
    const keys = new Set(queue.map((i) => i.key));
    setItems((list) => list.map((i) => (keys.has(i.key) ? { ...i, status: "queued", error: undefined, detail: undefined } : i)));
    const q = [...queue];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, q.length) }, async () => {
      while (q.length && !stopRef.current) {
        const ok = await runOne(q.shift()!);
        setRun((r) => r && { ...r, ok: r.ok + (ok ? 1 : 0), failed: r.failed + (ok ? 0 : 1) });
      }
    }));
    if (q.length) { // bấm Dừng: ảnh chưa đến lượt trở lại "Sẵn sàng", vẫn được chọn
      const rest = new Set(q.map((i) => i.key));
      setItems((list) => list.map((i) => (rest.has(i.key) ? { ...i, status: "ready" } : i)));
      setRun((r) => r && { ...r, stopped: true });
    }
    runningRef.current = false;
    setRunning(false);
    loadManifest();
  };

  /** Hoàn tác nhiều mẫu (tối đa 3 cùng lúc). Trả số mẫu hoàn tác được. */
  const undoMany = useCallback(async (designIds: string[], onEach?: (id: string, ok: boolean, e?: unknown) => void) => {
    const q = [...designIds];
    let n = 0;
    await Promise.all(Array.from({ length: Math.min(3, q.length) }, async () => {
      while (q.length) {
        const id = q.shift()!;
        try { await withRetry(() => postJson("/api/admin/designs/flow/undo", { designId: id }), () => false); n++; onEach?.(id, true); } catch (e) { onEach?.(id, false, e); }
      }
    }));
    return n;
  }, []);
  const markUndone = useCallback((id: string, ok: boolean, e?: unknown) => {
    setItems((list) => list.map((i) => (i.row?.designId === id && (i.status === "done" || i.status === "importing")
      ? ok ? { ...i, status: "undone", error: undefined, detail: undefined, upload: undefined, row: { ...i.row, flow: null } } : { ...i, status: "done", ...explain(e) }
      : i)));
  }, [explain]);
  const undoItems = async (list: Item[]) => {
    const ids = [...new Set(list.flatMap((i) => (i.row ? [i.row.designId] : [])))];
    setConfirm(null);
    setItems((cur) => cur.map((i) => (i.row && ids.includes(i.row.designId) && i.status === "done" ? { ...i, status: "importing" } : i)));
    await undoMany(ids, markUndone);
    loadManifest();
  };

  const visible = onlyProblems ? items.filter((i) => i.issue || i.dupOf || i.status === "error") : items;
  const selectable = items.filter((i) => !i.issue && !i.dupOf && PICKABLE.includes(i.status));
  const pool = selectable.filter((i) => !i.row?.flow); // "chọn tất cả" không chọn lại mẫu đã có ảnh Flow
  const selected = selectable.filter((i) => i.checked);
  const allOn = pool.length > 0 && pool.every((i) => i.checked);
  const done = items.filter((i) => i.status === "done");
  const failed = items.filter((i) => i.status === "error" && !i.dupOf);
  const counts = {
    ready: selectable.filter((i) => !i.row?.flow).length,
    has: selectable.filter((i) => i.row?.flow).length,
    dup: items.filter((i) => i.dupOf).length,
    blocked: items.filter((i) => i.issue).length,
  };
  const zoomed = zoom ? items.find((i) => i.key === zoom) ?? null : null;

  if (!allowed) return null; // chỉ admin (API trả 403 cho người khác)

  return (
    <section
      ref={sectionRef}
      id="anh-flow"
      aria-label={tr("Ảnh từ Google Flow", "Images from Google Flow")}
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setDrag(true); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDrag(false); }}
      onDrop={onDrop}
      className={`space-y-3 rounded-2xl border bg-slate-950/60 p-4 transition-colors ${drag ? "border-slate-300/60" : "border-white/10"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
        <div className="min-w-0 sm:flex-1">
          <h3 className="flex items-center gap-2 text-base font-bold text-white"><ImagePlus className="h-4 w-4 text-slate-300" /> {tr("Ảnh từ Google Flow", "Images from Google Flow")}</h3>
          <p className="text-xs text-slate-400">
            {tr(
              "Kéo thả ảnh Flow (hoặc cả thư mục) đã đặt tên theo mã (D001… hoặc id mẫu). Xem ảnh cũ và ảnh mới, chọn ảnh muốn dùng rồi bấm Đăng. Ảnh cũ được giữ lại — bấm Hoàn tác là về như trước.",
              "Drop Flow images (or a whole folder) named by their code (D001… or a design id). Compare the current and new image, pick the ones to use, then Publish. The old image is kept — Undo puts it back.",
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {tr("Lỡ tải lại trang giữa chừng: thả lại cả thư mục — ảnh đã đăng sẽ được bỏ qua.", "Reloaded mid-run? Drop the same folder again — images already published are skipped.")}
          </p>
        </div>
        {manifest && (
          <p data-testid="flow-progress" className="shrink-0 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
            {tr(`Lô ${manifest.batch}: ${manifest.imported}/${manifest.rows.length} mẫu đã có ảnh Flow`, `Batch ${manifest.batch}: ${manifest.imported}/${manifest.rows.length} designs have a Flow image`)}
          </p>
        )}
      </div>
      {!storage && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">
          {tr("Máy chủ chưa cấu hình Cloudinary — chỉ xem trước được, chưa đăng được.", "Cloudinary is not configured on the server — preview only, publishing is disabled.")}
        </p>
      )}

      <div
        className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${drag ? "border-slate-300 bg-white/[0.06]" : "border-white/20 bg-white/[0.02]"}`}
      >
        <Upload className="h-5 w-5 text-slate-400" />
        <span className="text-sm font-semibold text-slate-200">{tr("Kéo thả ảnh hoặc cả thư mục vào khung này", "Drop images or a whole folder anywhere in this panel")}</span>
        <span className="text-[11px] text-slate-500">{tr("JPG / PNG / WebP, vuông, từ 1024px · tối đa 300 ảnh mỗi lần", "JPG / PNG / WebP, square, 1024px or larger · up to 300 images at a time")}</span>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={running} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-white/20 hover:bg-white/[0.05] disabled:opacity-40">
            <ImagePlus className="h-4 w-4" /> {tr("Chọn ảnh", "Choose images")}
          </button>
          <button type="button" data-testid="flow-folder" onClick={() => folderRef.current?.click()} disabled={running} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-white/20 hover:bg-white/[0.05] disabled:opacity-40">
            <FolderOpen className="h-4 w-4" /> {tr("Chọn cả thư mục", "Choose a folder")}
          </button>
        </div>
        <input ref={fileRef} data-testid="flow-files" type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
        <input
          ref={(el) => { folderRef.current = el; el?.setAttribute("webkitdirectory", ""); }}
          data-testid="flow-folder-input" type="file" multiple className="sr-only" tabIndex={-1} aria-hidden
          onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
      </div>
      {(notice || reading) && (
        <p data-testid="flow-notice" role="status" className="flex items-start justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10">
          <span>
            {reading ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />{tr(`Đang đọc ${reading.done}/${reading.total} ảnh…`, `Reading ${reading.done}/${reading.total} images…`)} </> : null}
            {notice}
          </span>
          {notice && <button type="button" onClick={() => setNotice(null)} aria-label={tr("Đóng", "Dismiss")} className="-m-1 shrink-0 p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
        </p>
      )}

      {items.length > 0 && (
        <div data-testid="flow-runbar" className="sticky top-[68px] z-30 space-y-2 rounded-xl bg-slate-900/95 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label className="inline-flex min-h-[36px] items-center gap-2 text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                data-testid="flow-select-all"
                checked={allOn}
                disabled={!pool.length || running}
                onChange={() => { const keys = new Set(pool.map((i) => i.key)); setItems((list) => list.map((i) => (keys.has(i.key) ? { ...i, checked: !allOn } : i))); }}
                className="h-5 w-5 accent-slate-200"
              />
              {tr(`Chọn tất cả (${selected.length}/${pool.length})`, `Select all (${selected.length}/${pool.length})`)}
            </label>
            <p data-testid="flow-summary" className="text-[11px] text-slate-400">
              {[
                tr(`${counts.ready} sẵn sàng`, `${counts.ready} ready`),
                counts.has ? tr(`${counts.has} đã có ảnh Flow`, `${counts.has} already have a Flow image`) : "",
                counts.dup ? tr(`${counts.dup} trùng`, `${counts.dup} duplicates`) : "",
                counts.blocked ? tr(`${counts.blocked} không dùng được`, `${counts.blocked} can't be used`) : "",
                tr(`${failed.length} lỗi`, `${failed.length} errors`),
              ].filter(Boolean).join(" · ")}
            </p>
            <label className="inline-flex min-h-[32px] items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <input type="checkbox" data-testid="flow-filter" checked={onlyProblems} onChange={() => setOnlyProblems((v) => !v)} className="h-4 w-4 accent-slate-200" />
              {tr("Chỉ xem ảnh có vấn đề", "Only show problems")}
            </label>
          </div>
          {run && (running || run.ok + run.failed > 0) && (
            <div aria-live="polite">
              <p data-testid="flow-run-status" className="text-xs font-semibold text-slate-200">
                {running
                  ? tr(`Đang đăng ${run.ok + run.failed}/${run.total}`, `Publishing ${run.ok + run.failed}/${run.total}`)
                  : run.stopped ? tr(`Đã dừng: đăng được ${run.ok}/${run.total}`, `Stopped: ${run.ok}/${run.total} published`) : tr(`Xong: đã đăng ${run.ok}/${run.total}`, `Done: ${run.ok}/${run.total} published`)}
                {run.failed ? <span className="text-rose-300">{tr(` · ${run.failed} lỗi`, ` · ${run.failed} failed`)}</span> : null}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.ok + run.failed}>
                <div className="h-full rounded-full bg-slate-200 transition-[width] duration-300" style={{ width: `${Math.round(((run.ok + run.failed) / Math.max(1, run.total)) * 100)}%` }} />
              </div>
            </div>
          )}
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
              <span className="font-semibold">
                {confirm === "clear"
                  ? tr(`Xoá ${items.length} ảnh khỏi danh sách? (ảnh đã đăng vẫn giữ trên trang)`, `Remove ${items.length} images from the list? (published images stay live)`)
                  : tr(`Hoàn tác ${done.length} ảnh vừa đăng — trả lại ảnh cũ?`, `Undo the ${done.length} images just published — restore the old images?`)}
              </span>
              <button
                type="button"
                data-testid="flow-confirm"
                onClick={() => {
                  if (confirm === "clear") { items.forEach((i) => URL.revokeObjectURL(i.preview)); setItems([]); setRun(null); setConfirm(null); }
                  else undoItems(done);
                }}
                className="inline-flex min-h-[36px] items-center rounded-lg bg-slate-100 px-3 font-bold text-slate-900"
              >
                {confirm === "clear" ? tr("Xoá", "Remove") : tr("Hoàn tác", "Undo")}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="inline-flex min-h-[36px] items-center rounded-lg px-3 font-semibold text-slate-300 ring-1 ring-white/15">{tr("Thôi", "Cancel")}</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <button type="button" data-testid="flow-stop" onClick={() => { stopRef.current = true; }} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-white/20">
                  <Square className="h-3.5 w-3.5" /> {tr("Dừng", "Stop")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { if (items.length > 10 || done.length) setConfirm("clear"); else { items.forEach((i) => URL.revokeObjectURL(i.preview)); setItems([]); setRun(null); } }}
                    className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/15"
                  >
                    {tr("Xoá hết", "Clear")}
                  </button>
                  {failed.length > 0 && (
                    <button type="button" data-testid="flow-retry-failed" onClick={() => runAll(failed)} disabled={!storage} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-rose-400/40 disabled:opacity-40">
                      <RotateCcw className="h-3.5 w-3.5" /> {tr(`Thử lại ${failed.length} ảnh lỗi`, `Retry ${failed.length} failed`)}
                    </button>
                  )}
                  {done.length > 0 && (
                    <button type="button" data-testid="flow-undo-session" onClick={() => setConfirm("undo")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-white/15">
                      <Undo2 className="h-3.5 w-3.5" /> {tr(`Hoàn tác cả lượt vừa đăng (${done.length})`, `Undo this run (${done.length})`)}
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                data-testid="flow-publish"
                onClick={() => runAll(selected)}
                disabled={!selected.length || running || !storage}
                className="ml-auto inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-900 disabled:opacity-40 sm:flex-none"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {tr(`Đăng ${selected.length} ảnh đã chọn`, `Publish ${selected.length} selected`)}
              </button>
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div data-testid="flow-grid" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((it) => (
            <ReviewCard
              key={it.key}
              it={it}
              locale={locale}
              dupName={it.dupOf ? items.find((i) => i.key === it.dupOf)?.name : undefined}
              busy={running}
              onToggle={() => (it.dupOf ? swap(it.key) : patch(it.key, { checked: !it.checked }))}
              onRetry={() => runAll([it])}
              onUndo={() => undoItems([it])}
              onRemove={() => remove(it.key)}
              onZoom={() => setZoom(it.key)}
            />
          ))}
          {onlyProblems && !visible.length && <p className="text-xs text-slate-400">{tr("Không có ảnh nào có vấn đề.", "No problems.")}</p>}
        </div>
      )}

      {zoomed && <CompareDialog it={zoomed} locale={locale} onClose={() => setZoom(null)} />}
      <ImportedList rows={importedRows} undoMany={undoMany} explain={explain} onChange={(ids) => { ids.forEach((id) => markUndone(id, true)); loadManifest(); }} />
      <ExportBriefs />
    </section>
  );
}

function StatusPill({ it }: { it: Item }) {
  const { tr } = useTr();
  const s = it.status;
  const map: Record<Status, [string, string]> = {
    checking: [tr("Đang kiểm tra", "Checking"), "text-slate-300 ring-white/15"],
    ready: [tr("Sẵn sàng", "Ready"), "text-slate-200 ring-white/20"],
    blocked: [tr("Không dùng được", "Can't use"), "text-amber-200 ring-amber-400/40"],
    queued: [tr("Đang chờ", "Queued"), "text-slate-300 ring-white/15"],
    uploading: [tr("Đang tải lên", "Uploading"), "text-sky-200 ring-sky-400/40"],
    importing: [tr("Đang lưu", "Saving"), "text-sky-200 ring-sky-400/40"],
    done: [tr("Đã đăng", "Published"), "text-emerald-200 ring-emerald-400/40"],
    error: [tr("Lỗi", "Error"), "text-rose-200 ring-rose-400/40"],
    undone: [tr("Đã hoàn tác", "Undone"), "text-slate-300 ring-white/15"],
  };
  let [label, cls] = map[s];
  if (it.dupOf) [label, cls] = [tr("Trùng mẫu", "Duplicate"), "text-amber-200 ring-amber-400/40"];
  else if (s === "ready" && it.row?.flow) [label, cls] = [tr("Đã có ảnh Flow", "Has Flow image"), "text-emerald-200 ring-emerald-400/30"];
  return <span data-testid="flow-status" className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>{label}</span>;
}

function ReviewCard({ it, locale, dupName, busy, onToggle, onRetry, onUndo, onRemove, onZoom }: {
  it: Item; locale: string; dupName?: string; busy: boolean;
  onToggle: () => void; onRetry: () => void; onUndo: () => void; onRemove: () => void; onZoom: () => void;
}) {
  const { tr } = useTr();
  const r = it.row;
  const working = BUSY.includes(it.status);
  const canPick = !it.issue && PICKABLE.includes(it.status);
  const title = r?.found ? (locale === "en" ? r.title : r.titleVi || r.title) : it.name;
  return (
    <article data-testid="flow-card" data-code={it.code ?? ""} className="min-w-0 rounded-xl border border-white/10 bg-slate-900/70 p-3">
      <div className="flex items-start gap-2">
        <label className="-m-1.5 flex min-w-0 flex-1 cursor-pointer items-start gap-2 p-1.5">
          <input
            type="checkbox"
            aria-label={tr(`Chọn ${it.code ?? it.name}`, `Select ${it.code ?? it.name}`)}
            checked={it.checked && canPick && !it.dupOf}
            disabled={!canPick || busy}
            onChange={onToggle}
            className="mt-0.5 h-5 w-5 shrink-0 accent-slate-200"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold text-slate-400">
              <span className="text-slate-200">{it.code ?? "—"}</span>
              {r?.designId && r.designId !== it.code ? <span className="font-mono"> · {r.designId.slice(0, 10)}…</span> : null}
            </span>
            <span className="block truncate text-sm font-semibold text-white" title={title}>{title}</span>
            <span data-testid="flow-filename" className="block truncate font-mono text-[10px] text-slate-500" title={it.name}>{it.name}</span>
          </span>
        </label>
        <StatusPill it={it} />
        {!working && !busy && (
          <button type="button" data-testid="flow-remove" onClick={onRemove} aria-label={tr(`Bỏ ${it.name} khỏi danh sách`, `Remove ${it.name} from the list`)} className="-m-1 shrink-0 rounded p-1 text-slate-500 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <button type="button" onClick={onZoom} aria-label={tr("Phóng to để so sánh", "Enlarge to compare")} className="mt-2 grid w-full grid-cols-2 gap-2 text-left">
        <span className="min-w-0">
          <span className="mb-1 block truncate text-[11px] font-semibold text-slate-300">{it.status === "done" ? tr("Ảnh cũ (đã cất)", "Old image (kept)") : tr("Ảnh hiện tại", "Current image")}</span>
          <span className="block aspect-square overflow-hidden rounded-lg bg-slate-800">
            {r?.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cdnImage(r.imageUrl, 360)} alt={tr("Ảnh hiện tại", "Current image")} loading="lazy" className="h-full w-full object-cover" />
              : <span className="flex h-full items-center justify-center text-[11px] text-slate-500">{tr("Chưa có ảnh", "No image")}</span>}
          </span>
        </span>
        <span className="min-w-0">
          <span className="mb-1 block truncate text-[11px] font-semibold text-slate-300">{tr("Ảnh mới", "New")} <span className="font-normal text-slate-500">· {it.w}×{it.h}<span className="hidden sm:inline"> · {kb(it.file.size)}</span></span></span>
          <span className="block aspect-square overflow-hidden rounded-lg bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.preview} alt={tr("Ảnh mới từ Flow", "New Flow image")} loading="lazy" className="h-full w-full object-cover" />
          </span>
        </span>
      </button>
      {it.dupOf && (
        <p className="mt-2 text-[11px] text-amber-200">{tr(`Trùng mẫu — đang dùng file “${dupName ?? "khác"}”. Tick ô này để dùng file này thay.`, `Duplicate — “${dupName ?? "another file"}” is used. Tick this box to use this file instead.`)}</p>
      )}
      {!!it.dups && !it.dupOf && (
        <p className="mt-2 text-[11px] text-slate-400">{tr(`Có ${it.dups + 1} file cho mẫu này — đang dùng file này (mới nhất hoặc bạn chọn).`, `${it.dups + 1} files for this design — using this one (newest, or your pick).`)}</p>
      )}
      {r?.flow && it.status !== "done" && !it.issue && (
        <p className="mt-2 text-[11px] text-slate-400">{tr(`Mẫu này đã có ảnh Flow (${r.flow.code}, ${r.flow.date}) — đăng sẽ thay ảnh đó.`, `Already has a Flow image (${r.flow.code}, ${r.flow.date}) — publishing replaces it.`)}</p>
      )}
      {r?.found && r.status !== "published" && !it.issue && (
        <p className="mt-2 text-[11px] text-slate-400">{tr(`Mẫu đang ở trạng thái "${r.status}" — khách chưa thấy mẫu này.`, `This design is "${r.status}" — clients can't see it yet.`)}</p>
      )}
      {it.issue && <p className="mt-2 text-xs text-amber-200">{it.issue}</p>}
      {it.error && <p className="mt-2 break-words text-xs text-rose-300">{it.error}</p>}
      {it.detail && <p className="mt-0.5 break-words font-mono text-[10px] text-slate-500">{tr("Chi tiết", "Details")}: {it.detail}</p>}
      {(it.status === "error" || it.status === "done" || working) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {it.status === "error" && (
            <button type="button" onClick={onRetry} disabled={busy} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" /> {tr("Thử lại", "Retry")}
            </button>
          )}
          {it.status === "done" && (
            <>
              <button type="button" data-testid="flow-undo" onClick={onUndo} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15">
                <Undo2 className="h-3.5 w-3.5" /> {tr("Hoàn tác", "Undo")}
              </button>
              {r?.designId && (
                <a href={`/designs/${r.designId}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-300 hover:text-white">
                  <ExternalLink className="h-3.5 w-3.5" /> {tr("Xem trên trang", "View live")}
                </a>
              )}
            </>
          )}
          {working && <span className="inline-flex items-center gap-1 text-xs text-slate-400">{it.status === "queued" ? null : <Loader2 className="h-3.5 w-3.5 animate-spin" />} {it.status === "queued" ? tr("Chờ tới lượt…", "Waiting…") : tr("Đang xử lý…", "Working…")}</span>}
        </div>
      )}
    </article>
  );
}

/** So sánh lớn ảnh cũ / ảnh mới (bấm vào 2 ảnh trên thẻ). */
function CompareDialog({ it, locale, onClose }: { it: Item; locale: string; onClose: () => void }) {
  const { tr } = useTr();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const r = it.row;
  const title = r?.found ? (locale === "en" ? r.title : r.titleVi || r.title) : it.name;
  return (
    <div role="dialog" aria-modal="true" aria-label={tr("So sánh ảnh", "Compare images")} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div className="max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-slate-950 p-3 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold text-white"><span className="text-slate-400">{it.code ?? "—"}</span> · {title}<span className="block truncate font-mono text-[10px] font-normal text-slate-500">{it.name}</span></p>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="shrink-0 rounded-lg p-1.5 text-slate-300 ring-1 ring-white/15 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <figure className="min-w-0">
            <figcaption className="mb-1 text-xs font-semibold text-slate-300">{tr("Ảnh hiện tại", "Current image")}</figcaption>
            {r?.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cdnImage(r.imageUrl, 1024)} alt={tr("Ảnh hiện tại", "Current image")} className="aspect-square w-full rounded-lg bg-slate-800 object-cover" />
              : <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">{tr("Chưa có ảnh", "No image")}</div>}
          </figure>
          <figure className="min-w-0">
            <figcaption className="mb-1 text-xs font-semibold text-slate-300">{tr("Ảnh mới", "New")} · {it.w}×{it.h}</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.preview} alt={tr("Ảnh mới từ Flow", "New Flow image")} className="aspect-square w-full rounded-lg bg-slate-800 object-cover" />
          </figure>
        </div>
      </div>
    </div>
  );
}

/** MỌI mẫu đang là ảnh Flow (mọi lô) — hoàn tác từng ảnh hoặc cả ngày nhập, kể cả sau khi tải lại trang. */
function ImportedList({ rows, undoMany, explain, onChange }: {
  rows: FlowRow[];
  undoMany: (ids: string[], onEach?: (id: string, ok: boolean, e?: unknown) => void) => Promise<number>;
  explain: (e: unknown) => { error: string; detail?: string };
  onChange: (undoneIds: string[]) => void;
}) {
  const { tr, locale } = useTr();
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, FlowRow[]>();
    for (const r of rows) m.set(r.flow?.date ?? "", [...(m.get(r.flow?.date ?? "") ?? []), r]);
    return [...m.entries()];
  }, [rows]);
  if (!rows.length) return null;
  const undo = async (ids: string[], tag: string) => {
    setBusy(tag);
    setAsk(null);
    setErr(null);
    const okIds: string[] = [];
    const errs: unknown[] = [];
    await undoMany(ids, (id, ok, e) => { if (ok) okIds.push(id); else errs.push(e); });
    if (errs.length) setErr(`${explain(errs[0]).error}${errs.length > 1 ? tr(` (${errs.length} ảnh chưa hoàn tác được)`, ` (${errs.length} images not undone)`) : ""}`);
    setBusy(null);
    onChange(okIds);
  };
  return (
    <details data-testid="flow-imported" className="rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">{tr(`Ảnh Flow đã đăng (${rows.length})`, `Published Flow images (${rows.length})`)}</summary>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
      {groups.map(([date, list]) => (
        <div key={date} className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-300">{tr(`Nhập ngày ${date} · ${list.length} ảnh`, `Imported ${date} · ${list.length} images`)}</p>
            {ask === date ? (
              <span className="inline-flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-200">{tr(`Hoàn tác ${list.length} ảnh?`, `Undo ${list.length} images?`)}</span>
                <button type="button" data-testid="flow-undo-day-confirm" onClick={() => undo(list.map((r) => r.designId), date)} className="inline-flex min-h-[32px] items-center rounded-lg bg-slate-100 px-2.5 font-bold text-slate-900">{tr("Hoàn tác", "Undo")}</button>
                <button type="button" onClick={() => setAsk(null)} className="inline-flex min-h-[32px] items-center rounded-lg px-2.5 font-semibold text-slate-300 ring-1 ring-white/15">{tr("Thôi", "Cancel")}</button>
              </span>
            ) : (
              <button type="button" data-testid="flow-undo-day" onClick={() => setAsk(date)} disabled={!!busy} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">
                {busy === date ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} {tr("Hoàn tác cả ngày này", "Undo this whole day")}
              </button>
            )}
          </div>
          <ul className="mt-1 divide-y divide-white/5">
            {list.map((r) => (
              <li key={r.designId} className="flex items-center gap-2 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.was ? <img src={cdnImage(r.was, 96)} alt={tr("Ảnh cũ", "Old")} loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-cover opacity-80" /> : <span className="h-10 w-10 shrink-0 rounded-md bg-slate-800" />}
                <span aria-hidden className="text-slate-500">→</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.imageUrl && <img src={cdnImage(r.imageUrl, 96)} alt={tr("Ảnh Flow", "Flow image")} loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{r.code.length > 12 ? `${r.code.slice(0, 10)}…` : r.code} · {locale === "en" ? r.title : r.titleVi || r.title}</p>
                  <a href={`/designs/${r.designId}`} target="_blank" rel="noreferrer" className="text-[11px] text-slate-500 hover:text-slate-300">{tr("Xem trên trang", "View live")}</a>
                </div>
                <button type="button" onClick={() => undo([r.designId], r.designId)} disabled={!!busy} className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">
                  {busy === r.designId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} {tr("Hoàn tác", "Undo")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

/** Brief cho trợ lý Flow: các mẫu đã đăng chưa có ảnh Flow, lô 12 ảnh. Mã = D-mã lô 2026-11 nếu mẫu có, không thì id mẫu. */
function ExportBriefs() {
  const { tr, locale } = useTr();
  const [list, setList] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<number>>(() => new Set());
  const coded = useMemo(() => (list ?? []).map((c) => ({ ...c, code: manifestCodeOf(c.id) ?? c.id })), [list]);
  const batches: FlowBatch[] = useMemo(
    () => flowBatches(coded.map((c) => ({ code: c.code, titleEn: c.titleEn, shape: c.shape, pattern: c.pattern, finish: c.finish }))),
    [coded],
  );
  const oldBatch = coded.filter((c) => c.code !== c.id).length;
  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/designs/flow?export=1").catch(() => null);
    const d = res && res.ok ? await res.json().catch(() => null) : null;
    setList(d?.candidates ?? []);
    setAt(0);
    setSent(new Set());
    setLoading(false);
  };
  const copy = async (text: string, what: string, mark?: number[]) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      if (mark) setSent((s) => new Set([...s, ...mark]));
    } catch { setCopied("fail"); }
    setTimeout(() => setCopied(null), 2500);
  };
  const cur = batches[at];
  const members = cur ? coded.slice(cur.index * 12, cur.index * 12 + cur.codes.length) : [];
  return (
    <details className="rounded-xl border border-white/10 p-3" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !list && !loading) load(); }}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">{tr("Xuất brief cho Flow (mẫu chưa có ảnh Flow)", "Export briefs for Flow (designs without a Flow image)")}</summary>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-slate-400">
        <li>{tr("Bấm “Sao chép lô này” (12 brief).", "Press “Copy this batch” (12 briefs).")}</li>
        <li>{tr("Dán vào trợ lý Google Flow rồi gửi — mỗi lần MỘT lô.", "Paste it into the Google Flow agent and send — ONE batch at a time.")}</li>
        <li>{tr("Tải 12 ảnh về cùng một thư mục.", "Download the 12 images into one folder.")}</li>
        <li>{tr("Xem lại: mỗi ảnh phải mang đúng mã brief trong tên file (trợ lý Flow đổi tên — đừng gõ tay mã dài).", "Check that every file name carries its brief code (the Flow agent renames them — don't type long codes by hand).")}</li>
        <li>{tr("Kéo cả thư mục vào khung phía trên, xem lại rồi bấm Đăng.", "Drag the whole folder into the panel above, review, then Publish.")}</li>
      </ol>
      {loading && <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {tr("Đang tải…", "Loading…")}</p>}
      {list && !batches.length && <p className="mt-2 text-xs text-slate-500">{tr("Mẫu nào cũng đã có ảnh Flow.", "Every design already has a Flow image.")}</p>}
      {oldBatch > 0 && (
        <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300 ring-1 ring-white/10">
          {tr(
            `${oldBatch} mẫu thuộc lô 2026-11 dùng lại mã D… cũ. Nếu đã có ảnh Flow cho các mã đó, thả ảnh vào trước rồi hẵng xuất brief.`,
            `${oldBatch} designs belong to batch 2026-11 and keep their D-code. If you already have Flow images for those codes, drop them in first, then export.`,
          )}
        </p>
      )}
      {cur && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p data-testid="flow-export-count" className="text-xs text-slate-300">{tr(`${list!.length} mẫu · ${batches.length} lô`, `${list!.length} designs · ${batches.length} batches`)}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setAt((n) => Math.max(0, n - 1))} disabled={at === 0} aria-label={tr("Lô trước", "Previous batch")} className="min-h-[32px] rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">‹</button>
              <span className="px-1 text-xs tabular-nums text-slate-300">
                {tr(`Lô ${at + 1}/${batches.length}`, `Batch ${at + 1}/${batches.length}`)}
                {sent.has(at) && <span className="ml-1 text-emerald-300">· {tr("đã sao chép", "copied")}</span>}
              </span>
              <button type="button" onClick={() => setAt((n) => Math.min(batches.length - 1, n + 1))} disabled={at >= batches.length - 1} aria-label={tr("Lô sau", "Next batch")} className="min-h-[32px] rounded-lg px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 disabled:opacity-40">›</button>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.03] p-1.5 ring-1 ring-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.imageUrl ? <img src={cdnImage(c.imageUrl, 80)} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" /> : <span className="h-8 w-8 shrink-0 rounded bg-slate-800" />}
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[10px] text-slate-400">{c.code.length > 12 ? `${c.code.slice(0, 10)}…` : c.code}</span>
                  <span className="block truncate text-[11px] text-slate-200">{locale === "en" ? c.titleEn : c.title || c.titleEn}</span>
                </span>
              </li>
            ))}
          </ul>
          <textarea readOnly value={cur.text} rows={6} aria-label={tr("Nội dung lô brief", "Batch brief text")} className="w-full resize-y rounded-lg bg-slate-900 p-2 font-mono text-[11px] leading-relaxed text-slate-200 ring-1 ring-white/10" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(cur.text, "one", [at])} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-900">
              <ClipboardCopy className="h-4 w-4" /> {copied === "one" ? tr("Đã sao chép", "Copied") : tr("Sao chép lô này", "Copy this batch")}
            </button>
            {at < batches.length - 1 && (
              <button type="button" onClick={async () => { await copy(cur.text, "next", [at]); setAt((n) => Math.min(batches.length - 1, n + 1)); }} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 ring-1 ring-white/15">
                <ClipboardCopy className="h-4 w-4" /> {copied === "next" ? tr("Đã sao chép", "Copied") : tr("Sao chép & sang lô tiếp", "Copy & next batch")}
              </button>
            )}
            <button type="button" onClick={() => copy(batches.map((b) => b.text).join("\n\n"), "all")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
              <ClipboardCopy className="h-4 w-4" /> {copied === "all" ? tr("Đã sao chép", "Copied") : tr(`Sao chép tất cả ${batches.length} lô (để lưu, đừng dán 1 lần vào Flow)`, `Copy all ${batches.length} batches (to save — don't paste at once into Flow)`)}
            </button>
            {copied === "fail" && <span className="self-center text-xs text-rose-300">{tr("Trình duyệt chặn sao chép — bôi đen và copy thủ công.", "Clipboard blocked — select the text and copy it manually.")}</span>}
          </div>
        </div>
      )}
    </details>
  );
}
