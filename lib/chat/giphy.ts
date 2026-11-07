// Đổi 1 trang kết quả GIPHY (v1/gifs/search | trending) thành danh sách GIF của app. THUẦN (route /api/gifs + unit test —
// không cần khoá thật: scripts/qa/stickers_unit.mts đưa vào JSON giả).
//  - send (nội dung tin): fixed_height MP4 (cao 200px, rộng theo tỉ lệ — 16:9 ≈ 356px, bong bóng 240px không bị phóng to
//    ~3× trên màn 2,6–3× DPR như fixed_width) + "#wh=WxH" + "&still=<fixed_height_still>" (poster). Thiếu MP4 → WebP / GIF
//    như trước 11/2026.
//  - preview (ô trong lưới): MP4 fixed_width (rộng 200px — nhẹ hơn WebP cùng cỡ nhiều lần, đủ khung hình), thiếu →
//    WebP fixed_width_downsampled / fixed_width_small.
//  - still: ảnh tĩnh của ô (fixed_width_still) — khi tắt chuyển động / tiết kiệm dữ liệu.
// Bỏ "?cid=…&rid=…" (tham số đo đếm) khỏi mọi URL; chỉ nhận URL https trên media*.giphy.com.
import { gifVideoContent } from "./gif";

export interface GifResult {
  id: string;
  send: string;
  preview: string;
  still?: string;
  w: number;
  h: number;
  title: string;
}

type Img = { url?: string; webp?: string; mp4?: string; width?: string | number; height?: string | number };
export type GiphyItem = { id?: string; title?: string; images?: Record<string, Img | undefined> };

const strip = (u: unknown) => (typeof u === "string" ? u.split("?")[0] : "");
export const GIPHY_MEDIA = /^https:\/\/media\d*\.giphy\.com\//;
const GIPHY_MP4 = /^https:\/\/media\d*\.giphy\.com\/[^?#\s"'<>]+\.mp4$/;
const GIPHY_FILE = /^https:\/\/media\d*\.giphy\.com\/[^?#\s"'<>]+$/;

export function mapGiphyItems(items: GiphyItem[]): GifResult[] {
  const out: GifResult[] = [];
  for (const g of items) {
    const im = g.images || {};
    const fh = im.fixed_height || {};
    const w = Number(fh.width);
    const h = Number(fh.height);
    if (!g.id || !(w > 0) || !(h > 0)) continue;
    const mp4 = strip(fh.mp4);
    const poster = strip(im.fixed_height_still?.url);
    const legacy = strip(fh.webp || fh.url);
    const send = GIPHY_MP4.test(mp4) ? gifVideoContent(mp4, w, h, GIPHY_FILE.test(poster) ? poster : null) : GIPHY_FILE.test(legacy) ? `${legacy}#wh=${w}x${h}` : "";
    const tileMp4 = strip(im.fixed_width?.mp4);
    const preview = GIPHY_MP4.test(tileMp4) ? tileMp4 : strip(im.fixed_width_downsampled?.webp || im.fixed_width_small?.webp) || legacy;
    const still = strip(im.fixed_width_still?.url || im.fixed_height_still?.url);
    if (!send || !GIPHY_FILE.test(preview)) continue;
    out.push({ id: `g_${g.id}`, send, preview, ...(GIPHY_FILE.test(still) ? { still } : {}), w, h, title: String(g.title || "").slice(0, 120) });
  }
  return out;
}
