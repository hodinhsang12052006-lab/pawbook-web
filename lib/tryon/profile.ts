// Soi tay từ khuôn các móng đã nhận: tông da (ấm / lạnh / trung tính), độ sáng da, dài / rộng / dáng đầu móng,
// màu đang sơn. Tách riêng (không kéo theo bộ tạo mẫu) để chạy nhẹ trong Web Worker.
import type { NailModel } from "./engine";

export interface HandProfile {
  undertone: "warm" | "cool" | "neutral";
  depth: "fair" | "medium" | "tan" | "deep";
  skinHex: string;
  nails: number;
  /** dài / rộng trung bình của móng thật */
  ratio: number;
  length: "short" | "medium" | "long";
  tip: "square" | "squoval" | "round" | "oval" | "almond";
  polishHex: string | null;
}

const toHex = (lab: number[]): string => {
  const [L, a, b] = lab;
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = f(fx) * 0.95047, Y = f(fy), Z = f(fz) * 1.08883;
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return "#" + lin.map((v) => { const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0"); }).join("");
};
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

/** Soi tay từ khuôn các móng (cần ≥ 1 móng nhận theo màu để biết màu da). */
export function profileFromModels(models: NailModel[]): HandProfile | null {
  const skins = models.map((m) => m.skin).filter((s): s is number[] => !!s);
  if (!skins.length) return null;
  const skin = [0, 1, 2].map((c) => med(skins.map((s) => s[c])));
  // tông da: da "ấm" ngả vàng (b lớn so với a), "lạnh" ngả hồng (a gần bằng b)
  const r = skin[2] / Math.max(1, skin[1]);
  const undertone = r > 1.55 ? "warm" : r < 1.15 ? "cool" : "neutral";
  const depth = skin[0] >= 72 ? "fair" : skin[0] >= 58 ? "medium" : skin[0] >= 45 ? "tan" : "deep";
  const ratios = models.map((m) => (m.fit.s1 - m.fit.s0) / Math.max(1, 2 * m.fit.hw));
  const ratio = med(ratios);
  const rt = med(models.map((m) => m.fit.rt));
  const colored = models.filter((m) => m.byColor && m.contrast >= 14);
  return {
    undertone, depth, skinHex: toHex(skin), nails: models.length, ratio,
    length: ratio < 1.05 ? "short" : ratio < 1.45 ? "medium" : "long",
    tip: rt < 0.35 ? "square" : rt < 0.75 ? "squoval" : rt < 1.2 ? "round" : rt < 1.6 ? "oval" : "almond",
    polishHex: colored.length ? toHex([0, 1, 2].map((c) => med(colored.map((m) => m.nail[c])))) : null,
  };
}

