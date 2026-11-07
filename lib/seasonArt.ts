// Ảnh + màu cho băng-rôn "Chủ đề tuần" (V2, trong app). Theo id chủ đề + thị trường (Úc: Nam bán cầu — tháng 11
// là mùa xuân / mùa cưới, Giáng Sinh giữa mùa hè; khung ngày theo lib/studioThemes themeWindow).
//
// Thứ tự ảnh: (1) mẫu THẬT đã đăng trùng dịp (designs.occasion === theme.id, SeasonBanner tự tra) → (2) tấm tay mẫu
// của PawNail (public/hands, ảnh minh hoạ AI — luôn kèm nhãn) CHỈ khi tấm đó hợp mùa → (3) tranh "sơn mài" trừu tượng
// vẽ bằng CSS (không phải ảnh, không người) cho mùa chưa có tấm hợp. Mọi tấm public/hands đều là móng trên áo len kem
// (hợp thu / Lễ Tạ Ơn), nên Giáng Sinh, hè, xuân, cưới, Valentine… KHÔNG dùng lại len kem nữa.
// Cron mẫu (lib/aiDesigns upcomingThemes) đã tự vẽ mẫu cho dịp bắt đầu trong 21 ngày tới → trước mùa sẽ có ảnh thật.
//
// accent = điểm nhấn không-chữ (quầng sáng dưới thẻ) ≥ 3:1; ink = chữ/viền chip trên nền thẻ ≥ 8:1.
export interface SeasonArt {
  accent: string;
  ink: string;
  /** tấm tay mẫu (ảnh minh hoạ AI) — chỉ khi hợp mùa */
  image?: string;
  position: string;
  /** tranh CSS trừu tượng khi chưa có ảnh hợp mùa (background) */
  paint?: string;
}

const lacquer = (base: string, sheen: string, deep: string, fleck: string) =>
  [
    // ánh bóng sơn mài + 2 vệt lụa chéo + nhũ rất mịn → mặt sơn có chiều sâu, không phẳng
    "radial-gradient(60% 90% at 22% 0%, rgb(255 255 255 / 0.16), transparent 60%)",
    "linear-gradient(112deg, transparent 36%, rgb(255 255 255 / 0.08) 45%, transparent 53%)",
    "linear-gradient(124deg, transparent 60%, rgb(255 255 255 / 0.05) 67%, transparent 74%)",
    `radial-gradient(circle at 20% 30%, ${fleck} 0 1px, transparent 1.5px) 0 0 / 23px 23px`,
    `radial-gradient(circle at 70% 60%, ${fleck} 0 0.8px, transparent 1.3px) 0 0 / 31px 31px`,
    `radial-gradient(120% 120% at 90% -10%, ${sheen}, transparent 62%)`,
    `linear-gradient(150deg, ${base} 0%, ${deep} 100%)`,
  ].join(", ");

const DEFAULT: SeasonArt = { accent: "#db2777", ink: "#f59bbe", image: "/hands/p027.jpg", position: "50% 40%" };

const BY_ID: Record<string, SeasonArt> = {
  fall: { accent: "#c46a32", ink: "#f2b483", image: "/hands/p067.jpg", position: "50% 38%" },
  thanksgiving: { accent: "#a8823a", ink: "#e9cb8f", image: "/hands/olive.jpg", position: "50% 42%" },
  christmas: { accent: "#b3263f", ink: "#f4a3b0", position: "50% 50%", paint: lacquer("#7d1426", "rgb(214 72 92 / 0.55)", "#2b0a14", "rgb(240 210 150 / 0.55)") },
  newyear: { accent: "#c9a45c", ink: "#ecd6a6", position: "50% 50%", paint: lacquer("#3a2c1c", "rgb(230 199 154 / 0.5)", "#140f0c", "rgb(240 220 170 / 0.75)") },
  tet: { accent: "#c8302c", ink: "#f6a49c", position: "50% 50%", paint: lacquer("#8a1a18", "rgb(230 160 80 / 0.45)", "#2e0808", "rgb(245 215 140 / 0.7)") },
  valentine: { accent: "#d63a6b", ink: "#f7a8c2", position: "50% 50%", paint: lacquer("#8c1f45", "rgb(244 140 180 / 0.5)", "#2c0a18", "rgb(255 220 230 / 0.55)") },
  spring: { accent: "#c0507a", ink: "#f7b0cc", image: "/hands/pink.jpg", position: "50% 40%" },
  mothersday: { accent: "#c0507a", ink: "#f7b0cc", image: "/hands/pink.jpg", position: "50% 40%" },
  wedding: { accent: "#b88f6a", ink: "#ead3bc", image: "/hands/white.jpg", position: "50% 55%" },
  prom: { accent: "#9b5fd0", ink: "#d5b8f2", position: "50% 50%", paint: lacquer("#3e2463", "rgb(196 150 240 / 0.45)", "#150b24", "rgb(230 210 255 / 0.6)") },
  summer: { accent: "#1f8f86", ink: "#8fe3d8", position: "50% 50%", paint: lacquer("#0f5c63", "rgb(255 150 120 / 0.42)", "#082629", "rgb(255 240 200 / 0.55)") },
  backtoschool: { accent: "#3d6fc4", ink: "#a9c4f2", position: "50% 50%", paint: lacquer("#1d3766", "rgb(240 110 130 / 0.35)", "#0b1326", "rgb(220 230 255 / 0.5)") },
};

// Úc: mùa ngược Mỹ. Xuân (tháng 9–11) = hoa jacaranda tím; hè (12–2) gồm cả Giáng Sinh = biển ngọc + san hô.
const AU: Record<string, SeasonArt> = {
  spring: { accent: "#8a6cc8", ink: "#cdb8f2", position: "50% 50%", paint: lacquer("#3f2f6b", "rgb(214 170 240 / 0.5)", "#171127", "rgb(240 225 255 / 0.6)") },
  christmas: BY_ID.summer,
  newyear: BY_ID.summer,
};

export function seasonArt(themeId: string | undefined, market: "US" | "AU"): SeasonArt {
  if (!themeId) return DEFAULT;
  return (market === "AU" ? AU[themeId] : undefined) ?? BY_ID[themeId] ?? DEFAULT;
}
