// 1 phiên Thử mẫu: giữ ảnh tay + khuôn từng móng, nhận lệnh (nạp ảnh / thêm móng / bỏ móng / đổi dáng /
// vẽ mẫu). Chạy trong Web Worker (lib/tryon/tryon.worker.ts) để điện thoại không bị đơ khi khớp khuôn; máy
// không có Worker thì chạy thẳng trên luồng chính (lib/tryon/client.ts) — cùng 1 đoạn code.
import { fitNail, motifGeometry, rasterNail, renderLook, type Img, type LookColors, type Mark, type NailModel, type NailSeg, type P, type Shape } from "./engine";
import { findNails, marksFromTap } from "./finder";
import { profileFromModels, type HandProfile } from "./profile";

/** Khuôn đáng tin: nhận theo màu, trong khuôn phần lớn là móng, ngoài mép khác hẳn, dáng như 1 cái móng. */
export function goodFit(m: NailModel): boolean {
  const natL = m.fit.s1 - m.fit.s0, ratio = natL / Math.max(1, 2 * m.fit.hw);
  return m.byColor && m.quality.inside >= 0.72 && m.quality.inside - m.quality.ring >= 0.35 && ratio > 0.55 && ratio < 3.6;
}
/** Khuôn CHẮC: sau chân móng là DA thật (sắc ấm), móng khác màu da rõ, khuôn sạch. `strict` (tự dò — không ai chỉ
 *  chỗ): khuôn phải rất sạch — 1 móng tự dò có viền thừa xuống da (bóng tối chân móng đen) làm khách mất tin hơn là
 *  để khách chạm thêm 1 lần. */
export function sureFit(m: NailModel, strict = false): boolean {
  if (!goodFit(m) || !m.skin) return false;
  const ch = Math.hypot(m.skin[1], m.skin[2]), hue = (Math.atan2(m.skin[2], m.skin[1]) * 180) / Math.PI;
  const natL = m.fit.s1 - m.fit.s0, ratio = natL / Math.max(1, 2 * m.fit.hw);
  return ch >= 9 && hue > 12 && hue < 72 && m.contrast >= 14 && m.quality.inside >= (strict ? 0.85 : 0.8) && m.quality.ring <= (strict ? 0.18 : 0.3) && ratio > 0.7 && ratio < 2.8;
}
const fitScore = (m: NailModel) => (m.byColor ? 1 : 0) + m.quality.inside - m.quality.ring;

/** Khớp khuôn 1 móng; khuôn chạm sát giới hạn đầu móng (móng dài hơn chỗ đoán) → thử lại với đầu móng xa hơn. */
export function fitAuto(img: Img, mark: Mark): NailModel {
  let m = fitNail(img, mark);
  // khuôn chạm sát giới hạn 1 đầu (móng dài hơn / chân móng lùi xa hơn chỗ đoán) → nới đầu đó, khớp lại
  for (let round = 0; round < 2 && m.byColor; round++) {
    const atTip = m.fit.s1 > 1.18 * m.L, atBase = m.fit.s0 < -0.18 * m.L;
    if (!atTip && !atBase) break;
    const dx = mark.tip.x - mark.base.x, dy = mark.tip.y - mark.base.y;
    const next = { base: atBase ? { x: mark.base.x - dx * 0.35, y: mark.base.y - dy * 0.35 } : mark.base, tip: atTip ? { x: mark.tip.x + dx * 0.45, y: mark.tip.y + dy * 0.45 } : mark.tip };
    const m2 = fitNail(img, next);
    if (fitScore(m2) <= fitScore(m)) break;
    m = m2; mark = next;
  }
  return m;
}

/** Thử lần lượt các cặp điểm (chiều thuận / ngược…) → giữ khuôn tốt nhất; khuôn đầu đã đáng tin thì dừng. */
export function bestFit(img: Img, marks: Mark[]): { mark: Mark; model: NailModel; ok: boolean } | null {
  let best: { mark: Mark; model: NailModel; ok: boolean } | null = null;
  for (const mark of marks) {
    const model = fitAuto(img, mark), ok = goodFit(model);
    if (!best || (ok && !best.ok) || (ok === best.ok && fitScore(model) > fitScore(best.model))) best = { mark, model, ok };
    if (ok && fitScore(model) > 1.55) break;
  }
  return best;
}

/** TỰ DÒ MÓNG: bộ dò (finder) đưa ứng viên → khớp khuôn từng móng (thử cả 2 chiều) → chỉ nhận khuôn CHẮC, bỏ trùng. */
export function autoNails(img: Img): { nails: { mark: Mark; model: NailModel }[]; all: { mark: Mark; model: NailModel; ok: boolean }[] } {
  const all = findNails(img).map((f) => bestFit(img, [f.mark, { base: f.mark.tip, tip: f.mark.base }])!);
  for (const a of all) a.ok = sureFit(a.model, true);
  // cỡ móng trong 1 ảnh gần đều nhau: bề ngang lệch hẳn trung vị (vùng da / vải nhầm) → bỏ
  const ws = all.filter((a) => a.ok).map((a) => a.model.fit.hw).sort((x, y) => x - y);
  if (ws.length >= 3) { const med = ws[ws.length >> 1]; for (const a of all) if (a.ok && (a.model.fit.hw < 0.55 * med || a.model.fit.hw > 1.8 * med)) a.ok = false; }
  // 2 ứng viên cùng 1 móng (tâm khuôn gần nhau hơn nửa bề ngang) → giữ khuôn tốt hơn
  const center = (m: NailModel) => { const s = (m.fit.s0 + m.fit.s1) / 2; return { x: m.O.x + m.U.x * s + m.V.x * m.fit.c0, y: m.O.y + m.U.y * s + m.V.y * m.fit.c0 }; };
  for (const a of all) for (const b of all) {
    if (a === b || !a.ok || !b.ok) continue;
    const ca = center(a.model), cb = center(b.model);
    if (Math.hypot(ca.x - cb.x, ca.y - cb.y) < Math.max(a.model.fit.hw, b.model.fit.hw)) { if (fitScore(a.model) >= fitScore(b.model)) b.ok = false; else a.ok = false; }
  }
  return { nails: all.filter((x) => x.ok).map(({ mark, model }) => ({ mark, model })), all };
}

/** 1 chạm giữa móng → móng (thử các trục / chiều do bộ dò đưa ra, giữ khuôn tốt nhất). */
export function tapFit(img: Img, point: P, hint: P | null) {
  // tối đa 2 trục × 2 chiều; trục chính trước — đa số chạm xong ở lần khớp đầu
  return bestFit(img, marksFromTap(img, point, hint).slice(0, 4));
}

export interface NailInfo {
  /** mã móng do luồng chính đặt (để bỏ / thay đúng móng) */
  id: string;
  /** đường viền móng đã nhận (toạ độ ảnh) */
  outline: P[];
  /** tách theo màu được (móng khác màu da) — false: móng gần màu da, dùng khuôn theo 2 điểm chạm */
  byColor: boolean;
  /** móng điểm nhấn (vẽ hoạ tiết / màu phụ) — chọn theo vị trí trên bàn tay, không theo thứ tự chạm */
  accent: boolean;
  /** đặt lớp hoạ tiết (SVG) đúng móng: gốc, đầu (kể cả phần đắp), bề ngang */
  geo: { base: P; tip: P; width: number };
}
export interface Crop { x: number; y: number; w: number; h: number }
export interface RawImg { w: number; h: number; buffer: ArrayBuffer }

export type TryOnMsg =
  | { kind: "image"; img: RawImg }
  | { kind: "auto" }
  | { kind: "tap"; id: string; point: P }
  | { kind: "nail"; id: string; mark: Mark }
  | { kind: "drop"; id: string }
  | { kind: "style"; lengthFactor: number; shape: Shape }
  | { kind: "render"; look: LookColors; motif: RawImg | null; crop: Crop };

export type TryOnReply =
  | { kind: "ok" }
  | { kind: "nails"; nails: NailInfo[]; added?: string | null; profile: HandProfile | null }
  | { kind: "image"; img: RawImg };

const toImg = (r: RawImg): Img => ({ w: r.w, h: r.h, data: new Uint8ClampedArray(r.buffer) });

export class TryOnSession {
  private img: Img | null = null;
  private nails = new Map<string, { model: NailModel; seg: NailSeg }>();
  private lf = 1;
  private shape: Shape = "oval";
  private seq = 0;

  private raster(model: NailModel) { return rasterNail(this.img!, model, { lengthFactor: this.lf, shape: this.shape }); }

  /** Móng điểm nhấn theo VỊ TRÍ trên bàn tay (xếp ngang theo hướng móng): ≥ 4 móng → móng thứ 2 tính từ mỗi
   *  bên (ngón trỏ + áp út khi đủ 5 ngón), 3 móng → móng giữa. */
  private list(): NailInfo[] {
    const items = [...this.nails.entries()];
    if (!items.length) return [];
    let ax = 0, ay = 0;
    for (const [, n] of items) { const d = { x: n.seg.tip.x - n.seg.base.x, y: n.seg.tip.y - n.seg.base.y }, l = Math.hypot(d.x, d.y) || 1; ax += d.x / l; ay += d.y / l; }
    const cx = (n: NailSeg) => ((n.base.x + n.tip.x) / 2) * -ay + ((n.base.y + n.tip.y) / 2) * ax;
    const order = [...items].sort((a, b) => cx(a[1].seg) - cx(b[1].seg)).map(([id]) => id);
    const N = order.length;
    const acc = new Set(N >= 4 ? [order[1], order[N - 2]] : N === 3 ? [order[1]] : []);
    return items.map(([id, n]) => {
      n.seg.accent = acc.has(id);
      return { id, outline: n.seg.outline, byColor: n.seg.byColor, accent: acc.has(id), geo: motifGeometry(n.seg, this.lf) };
    });
  }

  /** Hướng gốc → đầu trung bình của các móng đã có (gợi ý cho móng chạm 1 lần). */
  private hint(): P | null {
    let x = 0, y = 0;
    for (const { seg } of this.nails.values()) { const dx = seg.tip.x - seg.base.x, dy = seg.tip.y - seg.base.y, l = Math.hypot(dx, dy) || 1; x += dx / l; y += dy / l; }
    const l = Math.hypot(x, y);
    return l > 0.5 ? { x: x / l, y: y / l } : null;
  }

  /** Xử lý 1 lệnh → kết quả + danh sách bộ nhớ chuyển thẳng (không sao chép) về luồng chính. */
  handle(msg: TryOnMsg): { reply: TryOnReply; transfer: ArrayBuffer[] } {
    const nails = (added: string | null = null): { reply: TryOnReply; transfer: ArrayBuffer[] } => ({
      reply: { kind: "nails", nails: this.list(), added, profile: profileFromModels([...this.nails.values()].map((n) => n.model).filter((m) => m.byColor)) },
      transfer: [],
    });
    switch (msg.kind) {
      case "image":
        this.img = toImg(msg.img);
        this.nails.clear();
        return { reply: { kind: "ok" }, transfer: [] };
      case "auto": {
        if (!this.img) throw new Error("no image");
        for (const n of autoNails(this.img).nails) this.nails.set(`a${this.seq++}`, { model: n.model, seg: this.raster(n.model) });
        return nails();
      }
      case "tap": {
        if (!this.img) throw new Error("no image");
        const r = tapFit(this.img, msg.point, this.hint());
        // chỉ nhận khuôn CHẮC (sau chân móng là da thật, móng khác màu da rõ) — chạm nhầm vào nền / áo không thêm móng
        if (!r || !sureFit(r.model)) return nails(null);
        this.nails.set(msg.id, { model: r.model, seg: this.raster(r.model) });
        return nails(msg.id);
      }
      case "nail": {
        if (!this.img) throw new Error("no image");
        const model = fitAuto(this.img, msg.mark);
        this.nails.set(msg.id, { model, seg: this.raster(model) });
        return nails(msg.id);
      }
      case "drop":
        this.nails.delete(msg.id);
        return nails();
      case "style": {
        if (!this.img) throw new Error("no image");
        this.lf = Math.max(1, Math.min(2, msg.lengthFactor));
        this.shape = msg.shape;
        for (const n of this.nails.values()) n.seg = this.raster(n.model);
        return nails();
      }
      case "render": {
        if (!this.img) throw new Error("no image");
        this.list(); // cập nhật móng điểm nhấn
        const out = renderLook(this.img, [...this.nails.values()].map((n) => n.seg), msg.look, msg.motif ? toImg(msg.motif) : null, msg.crop);
        const buffer = out.data.buffer as ArrayBuffer;
        return { reply: { kind: "image", img: { w: out.w, h: out.h, buffer } }, transfer: [buffer] };
      }
    }
  }
}
