// THỬ MẪU PAWNAIL (PawNail Try-On) — máy TẠO MẪU TRÊN TAY KHÁCH của riêng PawNail (không gọi AI bên ngoài, chi phí 0đ,
// chạy ngay trên điện thoại). Ảnh tay thật + vị trí từng móng (thợ chạm gốc → đầu móng) + bộ máy tạo
// mẫu theo trend (lib/designEngine: bảng màu, dáng, hiệu ứng, hoạ tiết, giá gợi ý) → vẽ lớp sơn lên đúng
// từng móng (components/studio). Đây là bộ máy VẼ THEO CÔNG THỨC do PawNail tự viết, không phải mạng
// nơ-ron; khi có đủ ảnh thật (ảnh thợ gửi khách + mẫu được chọn) có thể dạy model riêng trên dữ liệu này.
import { generateEngineDesigns, type EngineDesign } from "@/lib/designEngine";

export interface Pt { x: number; y: number }
export interface NailMark { base: Pt; tip: Pt }

/** Toạ độ 1 móng trong hệ vẽ của NailArt: rộng 26, đầu móng y≈2, chân móng (giữa vòng cung) y≈68. */
export const NAIL_W = 26;
const TIP_Y = 2;
// Neo điểm "gốc móng" hơi cao hơn vòng cung chân móng (y 64–74) → lớp sơn phủ kín sát da như gel thật,
// không lộ viền màu móng cũ ở chân móng (soi ảnh xuất 23/10/2026).
const BASE_Y = 65;

/** transform SVG đặt móng chuẩn vào đúng chỗ móng thật trên ảnh.
 *  widthRatio: bề ngang móng / chiều dài móng thật (móng thật ~0.75–0.9). lengthFactor: kéo dài (đắp móng) 1–1.8. */
export function nailTransform(m: NailMark, widthRatio = 0.86, lengthFactor = 1.15): string {
  const dx = m.tip.x - m.base.x;
  const dy = m.tip.y - m.base.y;
  const len = Math.hypot(dx, dy) || 1;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const sx = (len * widthRatio) / NAIL_W;
  const sy = (len * lengthFactor) / (BASE_Y - TIP_Y);
  return `translate(${m.base.x.toFixed(1)} ${m.base.y.toFixed(1)}) rotate(${deg.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-NAIL_W / 2} ${-BASE_Y})`;
}

/** Khung cắt quanh bàn tay (để ảnh mẫu tập trung vào móng), vuông, có lề. */
export function cropBox(marks: NailMark[], w: number, h: number, pad = 0.55): { x: number; y: number; size: number } {
  if (!marks.length) { const s = Math.min(w, h); return { x: (w - s) / 2, y: (h - s) / 2, size: s }; }
  const xs = marks.flatMap((m) => [m.base.x, m.tip.x]);
  const ys = marks.flatMap((m) => [m.base.y, m.tip.y]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 60);
  const size = Math.min(Math.max(w, h), span * (1 + pad * 2));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const x = Math.max(0, Math.min(w - Math.min(size, w), cx - size / 2));
  const y = Math.max(0, Math.min(h - Math.min(size, h), cy - size / 2));
  return { x, y, size: Math.min(size, w, h) };
}

export interface StudioLook {
  id: string;
  title: { vi: string; en: string };
  palette: string[];
  shape: EngineDesign["shape"];
  finish: EngineDesign["finish"];
  pattern: string;
  priceHint: string;
  minutes: number;
  skills: string[];
}

/** 5–10 mẫu khác nhau theo trend (bảng màu theo mùa, hoạ tiết, hiệu ứng) — mỗi lần bấm "Tạo thêm" ra bộ mới. */
export function studioLooks(n: number, market: "US" | "AU", salt: string, opts: { shape?: EngineDesign["shape"] } = {}): StudioLook[] {
  const date = new Date().toISOString().slice(0, 10);
  const designs = generateEngineDesigns(n, { market, date, occasions: [], risingTags: [], usedTitles: new Set(), salt });
  return designs.map((d, i) => ({
    id: `${salt}-${i}`,
    title: d.title,
    palette: d.palette,
    shape: opts.shape ?? d.shape,
    finish: d.finish,
    pattern: d.pattern,
    priceHint: d.priceHint,
    minutes: d.minutes,
    skills: d.skills,
  }));
}

/** Thu nhỏ ảnh (điện thoại chụp 12MP) xuống cạnh dài tối đa `max` px → data URL JPEG (nhúng được vào SVG khi
 *  xuất ảnh — SVG-làm-ảnh không tải được link ngoài) + Blob (để xem nhanh qua blob:). KHÔNG fetch() data URL:
 *  CSP connect-src của web chặn data: (23/10/2026 — chọn ảnh xong không sang được bước chạm móng). */
export async function toDataUrl(src: string | Blob, max = 1400): Promise<{ url: string; blob: Blob; w: number; h: number }> {
  let source: CanvasImageSource;
  let sw: number, sh: number;
  if (typeof src === "string" && src.startsWith("data:")) {
    const img = new Image();
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("img")); img.src = src; });
    source = img; sw = img.naturalWidth; sh = img.naturalHeight;
  } else {
    const blob = typeof src === "string" ? await (await fetch(src, { mode: "cors" })).blob() : src;
    const bmp = await createImageBitmap(blob);
    source = bmp; sw = bmp.width; sh = bmp.height;
  }
  const k = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * k), h = Math.round(sh * k);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(source, 0, 0, w, h);
  const url = c.toDataURL("image/jpeg", 0.9);
  const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", 0.9));
  return { url, blob, w, h };
}

/** Xuất 1 khung SVG (đã có ảnh nhúng data URL) thành ảnh JPEG vuông `out` px. */
export async function svgToJpeg(svg: SVGSVGElement, out = 1080): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("render")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = out; c.height = out;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0, out, out);
    // Nhãn nhỏ góc dưới — minh bạch: đây là ảnh mẫu thử, không phải ảnh móng đã làm
    g.font = `600 ${Math.round(out * 0.024)}px system-ui, sans-serif`;
    const label = "PawNail · mẫu thử";
    const tw = g.measureText(label).width;
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(out - tw - out * 0.045, out - out * 0.058, tw + out * 0.03, out * 0.042);
    g.fillStyle = "#fff";
    g.fillText(label, out - tw - out * 0.03, out - out * 0.027);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}
