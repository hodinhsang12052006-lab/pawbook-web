// 1 phiên Thử mẫu: giữ ảnh tay + khuôn từng móng, nhận lệnh (nạp ảnh / thêm móng / bỏ móng / đổi dáng /
// vẽ mẫu). Chạy trong Web Worker (lib/tryon/tryon.worker.ts) để điện thoại không bị đơ khi khớp khuôn; máy
// không có Worker thì chạy thẳng trên luồng chính (lib/tryon/client.ts) — cùng 1 đoạn code.
import { fitNail, motifGeometry, rasterNail, renderLook, type Img, type LookColors, type Mark, type NailModel, type NailSeg, type P, type Shape } from "./engine";

export interface NailInfo {
  /** đường viền móng đã nhận (toạ độ ảnh) */
  outline: P[];
  /** tách theo màu được (móng khác màu da) — false: móng gần màu da, dùng khuôn theo 2 điểm chạm */
  byColor: boolean;
  /** đặt lớp hoạ tiết (SVG) đúng móng: gốc, đầu (kể cả phần đắp), bề ngang */
  geo: { base: P; tip: P; width: number };
}
export interface Crop { x: number; y: number; w: number; h: number }
export interface RawImg { w: number; h: number; buffer: ArrayBuffer }

export type TryOnMsg =
  | { kind: "image"; img: RawImg }
  | { kind: "nail"; index: number; mark: Mark }
  | { kind: "remove"; from: number }
  | { kind: "style"; lengthFactor: number; shape: Shape }
  | { kind: "render"; look: LookColors; motif: RawImg | null; crop: Crop };

export type TryOnReply =
  | { kind: "ok" }
  | { kind: "nail"; nail: NailInfo }
  | { kind: "nails"; nails: NailInfo[] }
  | { kind: "image"; img: RawImg };

const toImg = (r: RawImg): Img => ({ w: r.w, h: r.h, data: new Uint8ClampedArray(r.buffer) });

export class TryOnSession {
  private img: Img | null = null;
  private models: NailModel[] = [];
  private segs: NailSeg[] = [];
  private lf = 1;
  private shape: Shape = "oval";

  private info(i: number): NailInfo {
    const seg = this.segs[i];
    return { outline: seg.outline, byColor: seg.byColor, geo: motifGeometry(seg, this.lf) };
  }

  /** Xử lý 1 lệnh → kết quả + danh sách bộ nhớ chuyển thẳng (không sao chép) về luồng chính. */
  handle(msg: TryOnMsg): { reply: TryOnReply; transfer: ArrayBuffer[] } {
    switch (msg.kind) {
      case "image":
        this.img = toImg(msg.img);
        this.models = []; this.segs = [];
        return { reply: { kind: "ok" }, transfer: [] };
      case "nail": {
        if (!this.img) throw new Error("no image");
        const model = fitNail(this.img, msg.mark);
        this.models[msg.index] = model;
        this.segs[msg.index] = rasterNail(this.img, model, { lengthFactor: this.lf, shape: this.shape });
        return { reply: { kind: "nail", nail: this.info(msg.index) }, transfer: [] };
      }
      case "remove":
        this.models.length = Math.min(this.models.length, msg.from);
        this.segs.length = Math.min(this.segs.length, msg.from);
        return { reply: { kind: "ok" }, transfer: [] };
      case "style": {
        if (!this.img) throw new Error("no image");
        this.lf = Math.max(1, Math.min(2, msg.lengthFactor));
        this.shape = msg.shape;
        this.segs = this.models.map((m) => rasterNail(this.img!, m, { lengthFactor: this.lf, shape: this.shape }));
        return { reply: { kind: "nails", nails: this.segs.map((_, i) => this.info(i)) }, transfer: [] };
      }
      case "render": {
        if (!this.img) throw new Error("no image");
        const out = renderLook(this.img, this.segs.filter(Boolean), msg.look, msg.motif ? toImg(msg.motif) : null, msg.crop);
        const buffer = out.data.buffer as ArrayBuffer;
        return { reply: { kind: "image", img: { w: out.w, h: out.h, buffer } }, transfer: [buffer] };
      }
    }
  }
}
