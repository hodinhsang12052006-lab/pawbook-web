import type { CSSProperties } from "react";
import { avatarGradient } from "@/lib/avatar";
import { nailMotif } from "@/lib/chatWallpapers";

// Ảnh bìa mặc định (V2) cho hồ sơ chưa có ảnh: 8 kết cấu "sơn mài / lụa" trừu tượng vẽ bằng CSS — tác phẩm gốc của
// PawNail, không người, không chữ, không gọi mạng. Cùng tông với avatar monogram (cùng hạt giống = cùng màu), nên
// avatar + bìa luôn đi đôi. Chỉ trang trí: phần tử dùng nó phải aria-hidden.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

// V2.1: thêm họa tiết móng + hoa nét mảnh (cùng nét vẽ với hình nền chat "Nail art") → bìa trông có chủ đích, đúng
// ngành, thay vì 1 mảng mờ trống. Vẫn là minh hoạ chung chung — người dùng thay bằng ảnh thật (portfolio / ảnh tiệm).
const MOTIF = nailMotif("rgba(255,240,246,0.13)", 112);

export function defaultCover(seed?: string | null): CSSProperties {
  const [base, sheen] = avatarGradient(seed);
  return {
    backgroundColor: "#1c1521",
    backgroundImage: [
      MOTIF,
      GRAIN,
      // ánh bóng sơn mài phía trên trái + 2 dải "lụa" chéo → mặt sơn có chiều sâu, không phẳng
      "radial-gradient(55% 90% at 28% 0%, rgb(255 255 255 / 0.10), transparent 62%)",
      "linear-gradient(115deg, transparent 38%, rgb(255 255 255 / 0.07) 46%, transparent 54%)",
      "linear-gradient(122deg, transparent 62%, rgb(255 255 255 / 0.045) 69%, transparent 75%)",
      `radial-gradient(120% 140% at 85% -20%, ${sheen}cc, transparent 60%)`,
      `radial-gradient(90% 120% at 0% 120%, ${base}b3, transparent 65%)`,
      `linear-gradient(135deg, ${base} 0%, #1c1521 100%)`,
    ].join(", "),
    backgroundSize: "112px 112px, 160px 160px, auto, auto, auto, auto, auto, auto",
    backgroundPosition: "18px 10px, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0",
  };
}

/** Lớp mờ dần ở đáy bìa (dưới phần avatar đè lên) — dùng cho cả bìa mặc định lẫn ảnh portfolio. */
export const COVER_FADE = "linear-gradient(180deg, transparent 40%, rgb(38 29 42 / 0.92) 100%)";
