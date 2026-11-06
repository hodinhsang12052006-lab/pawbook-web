// Ảnh + màu cho băng-rôn "Chủ đề tuần" (V2, trong app). Theo id chủ đề + thị trường (Úc đón Giáng Sinh mùa hè).
// Ảnh: tấm tay mẫu của chính PawNail (public/hands, lib/designRender HANDS) — luôn kèm nhãn "Ảnh minh hoạ AI".
// Khi có mẫu thật đã đăng trùng dịp (designs.occasion === theme.id) thì băng-rôn dùng ảnh mẫu đó thay thế.
// accent = điểm nhấn không-chữ (chấm màu, quầng sáng dưới thẻ) ≥ 3:1; ink = chữ/viền chip trên nền thẻ ≥ 8:1.
export interface SeasonArt {
  accent: string;
  ink: string;
  /** chấm thứ 2 trong dải màu (mặc định = theme.colors[1]) */
  dot2?: string;
  image: string;
  position: string;
}

const DEFAULT: SeasonArt = { accent: "#db2777", ink: "#f59bbe", image: "/hands/p027.jpg", position: "50% 40%" };
const AU_SUMMER: SeasonArt = { accent: "#1f8f86", ink: "#8fe3d8", image: "/hands/pink.jpg", position: "50% 40%" };

const BY_ID: Record<string, SeasonArt> = {
  fall: { accent: "#c46a32", ink: "#f2b483", image: "/hands/p067.jpg", position: "50% 38%" },
  thanksgiving: { accent: "#a8823a", ink: "#e9cb8f", image: "/hands/olive.jpg", position: "50% 42%" },
  christmas: { accent: "#a3223a", ink: "#f4a3b0", dot2: "#2e6a4e", image: "/hands/white.jpg", position: "50% 55%" },
  newyear: { accent: "#c9a45c", ink: "#ecd6a6", image: "/hands/hand.jpg", position: "50% 50%" },
  "summer-au": AU_SUMMER,
  "spring-au": { accent: "#c0507a", ink: "#f7b0cc", image: "/hands/pink.jpg", position: "50% 40%" },
};

export function seasonArt(themeId: string | undefined, market: "US" | "AU"): SeasonArt {
  if (!themeId) return DEFAULT;
  if (market === "AU" && themeId === "christmas") return AU_SUMMER; // Giáng Sinh giữa mùa hè ở Úc
  return BY_ID[themeId] ?? DEFAULT;
}
