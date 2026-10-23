// Luồng chính ↔ bộ máy Thử mẫu. Ưu tiên Web Worker (không đơ giao diện); Worker lỗi / không có → chạy
// thẳng trên luồng chính, phát lại các lệnh đã gửi (ảnh, móng, dáng) để không mất gì người dùng đã làm.
import { TryOnSession, type TryOnMsg, type TryOnReply } from "./session";

type Wait = { ok: (r: TryOnReply) => void; bad: (e: Error) => void; msg: TryOnMsg };

export class TryOnClient {
  private worker: Worker | null = null;
  private local: TryOnSession | null = null;
  private seq = 0;
  private waits = new Map<number, Wait>();
  /** các lệnh làm thay đổi trạng thái — để phát lại khi phải chuyển sang chạy trên luồng chính */
  private log: TryOnMsg[] = [];

  constructor(opts: { worker?: boolean } = {}) {
    if (opts.worker !== false && typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(new URL("./tryon.worker.ts", import.meta.url));
        this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; reply?: TryOnReply; error?: string }>) => {
          const w = this.waits.get(e.data.id);
          if (!w) return;
          this.waits.delete(e.data.id);
          if (e.data.ok && e.data.reply) w.ok(e.data.reply);
          else w.bad(new Error(e.data.error || "tryon"));
        };
        this.worker.onerror = (ev) => { ev.preventDefault?.(); this.fallback(); };
      } catch {
        this.worker = null;
      }
    }
  }

  /** Worker hỏng → chạy trên luồng chính: phát lại trạng thái rồi chạy lại các lệnh đang chờ. */
  private fallback() {
    if (this.local) return;
    this.worker?.terminate();
    this.worker = null;
    this.local = new TryOnSession();
    const pending = [...this.waits.entries()].sort((a, b) => a[0] - b[0]).map(([, w]) => w);
    this.waits.clear();
    const waiting = new Set(pending.map((w) => w.msg));
    for (const m of this.log) if (!waiting.has(m)) { try { this.local.handle(m); } catch { /* bỏ qua lệnh lỗi cũ */ } }
    for (const w of pending) this.runLocal(w.msg).then(w.ok, w.bad);
  }

  private runLocal(msg: TryOnMsg): Promise<TryOnReply> {
    if (!this.local) this.local = new TryOnSession();
    try { return Promise.resolve(this.local.handle(msg).reply); } catch (e) { return Promise.reject(e); }
  }

  call(msg: TryOnMsg): Promise<TryOnReply> {
    if (msg.kind === "image") this.log = [msg];
    else if (msg.kind === "nail" || msg.kind === "remove" || msg.kind === "style") this.log.push(msg);
    if (!this.worker) return new Promise((ok, bad) => setTimeout(() => this.runLocal(msg).then(ok, bad), 0));
    const id = ++this.seq;
    return new Promise((ok, bad) => {
      this.waits.set(id, { ok, bad, msg });
      // ảnh: SAO CHÉP (giữ bản gốc để phát lại nếu Worker hỏng); hoạ tiết: chuyển thẳng
      const transfer = msg.kind === "render" && msg.motif ? [msg.motif.buffer] : [];
      this.worker!.postMessage({ id, msg }, transfer);
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.local = null;
    for (const w of this.waits.values()) w.bad(new Error("disposed"));
    this.waits.clear();
  }
}
