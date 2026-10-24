// THỬ MẪU PAWNAIL (PawNail Try-On) — máy TẠO MẪU TRÊN TAY KHÁCH của riêng PawNail (không gọi AI bên ngoài, chi phí 0đ,
// chạy ngay trên điện thoại). Ảnh tay thật + vị trí từng móng (chạm gốc → đầu móng) → bộ máy ảnh thật
// (lib/tryon/engine: khớp khuôn đúng móng thật, giữ ánh sáng thật, thay màu / hiệu ứng / hoạ tiết) + bộ máy
// tạo mẫu theo trend (lib/designEngine: bảng màu, dáng, hiệu ứng, hoạ tiết, giá gợi ý). Đây là bộ máy XỬ LÝ
// ẢNH do PawNail tự viết, không phải mạng nơ-ron; khi có đủ ảnh thật có thể dạy model riêng trên dữ liệu này.
import { generateEngineDesigns, type EngineDesign } from "@/lib/designEngine";
import type { Finish, LookColors } from "@/lib/tryon/engine";
import { ALL_NAIL_PATTERNS, PROCEDURAL } from "@/lib/tryon/patterns";

export interface Pt { x: number; y: number }
export interface NailMark { base: Pt; tip: Pt }

/** Toạ độ 1 móng trong hệ vẽ của NailArt: rộng 26, đầu móng y≈2, giữa vòng cung chân móng y≈69. */
export const NAIL_W = 26;
const TIP_Y = 2;
const BASE_Y = 69;

/** transform SVG đặt móng chuẩn của NailArt lên đúng móng thật đã nhận (gốc, đầu kể cả phần đắp, bề ngang). */
export function motifTransform(g: { base: Pt; tip: Pt; width: number }): string {
  const dx = g.tip.x - g.base.x, dy = g.tip.y - g.base.y;
  const len = Math.hypot(dx, dy) || 1;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return `translate(${g.base.x.toFixed(1)} ${g.base.y.toFixed(1)}) rotate(${deg.toFixed(2)}) scale(${(g.width / NAIL_W).toFixed(4)} ${(len / (BASE_Y - TIP_Y)).toFixed(4)}) translate(${-NAIL_W / 2} ${-BASE_Y})`;
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

const FINISHES: Finish[] = ["glossy", "matte", "chrome", "cateye", "glitter"];
/** Nền đặc riêng của vài hoạ tiết (như NailArt). */
const BASE_FILL: Record<string, string> = { tortoise: "#b45309", babyboomer: "#f2c4c4", milkbath: "#f8fafc", negative: "#f3d6c8" };
const seedOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 100000; };

/** Mẫu (bảng màu + hiệu ứng + hoạ tiết) → thông số tô của bộ máy ảnh thật. */
export function lookColors(look: StudioLook): LookColors {
  const pal = look.palette.length ? look.palette : ["#ec4899", "#a855f7"];
  return {
    colors: [BASE_FILL[look.pattern] ?? pal[0], pal[1] ?? pal[0], pal[2] ?? pal[pal.length - 1]],
    finish: FINISHES.includes(look.finish as Finish) ? (look.finish as Finish) : "glossy",
    pattern: look.pattern,
    seed: seedOf(look.id),
    // thạch / negative space: hơi trong (móng thật thấy nhẹ) — móng cũ sẽ được tháo trước khi làm, nên không để lộ màu cũ
    opacity: look.pattern === "jelly" ? 0.85 : look.pattern === "negative" ? 0.9 : 1,
  };
}

/** Móng có cần lớp hoạ tiết SVG không: hoạ tiết bộ máy tự vẽ (french, ombre, đá 3D…) → không; còn lại: hoạ tiết
 *  toàn bộ → mọi móng, hoạ tiết điểm nhấn → móng điểm nhấn (bộ máy chọn theo vị trí trên bàn tay). */
export function hasMotif(pattern: string, accent: boolean, n: number): boolean {
  return !PROCEDURAL.has(pattern) && (ALL_NAIL_PATTERNS.has(pattern) || accent || n < 3);
}

/** Mở ảnh tay, thu nhỏ (điện thoại chụp 12MP) xuống cạnh dài tối đa `max` px → Blob JPEG (xem nhanh qua blob:)
 *  + điểm ảnh cho bộ máy Thử mẫu. KHÔNG fetch() data URL: CSP connect-src của web chặn data: (23/10/2026). */
export async function loadPhoto(src: string | Blob, max = 1400): Promise<{ blob: Blob; w: number; h: number; pixels: ImageData }> {
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
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(source, 0, 0, w, h);
  const pixels = g.getImageData(0, 0, w, h); // điểm ảnh cho bộ máy Thử mẫu (đúng ảnh đang hiển thị)
  const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", 0.9));
  return { blob, w, h, pixels };
}

/** Ảnh mẫu thử (khung cắt quanh bàn tay) → JPEG vuông `out` px kèm nhãn "PawNail · mẫu thử". */
export async function labelJpeg(src: CanvasImageSource, out = 1080): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = out; c.height = out;
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, out, out);
  // Nhãn nhỏ góc dưới — minh bạch: đây là ảnh mẫu thử, không phải ảnh móng đã làm
  g.font = `600 ${Math.round(out * 0.024)}px system-ui, sans-serif`;
  const label = "PawNail · mẫu thử";
  const tw = g.measureText(label).width;
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fillRect(out - tw - out * 0.045, out - out * 0.058, tw + out * 0.03, out * 0.042);
  g.fillStyle = "#fff";
  g.fillText(label, out - tw - out * 0.03, out - out * 0.027);
  return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", 0.92));
}

/** Lớp SVG (hoạ tiết) → điểm ảnh RGBA `w`×`h` (qua blob: — CSP img-src cho phép blob:). */
export async function svgPixels(svg: SVGSVGElement, w: number, h: number): Promise<ImageData> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("svg")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, w, h);
    return g.getImageData(0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}
