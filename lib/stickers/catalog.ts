// Danh mục sticker app dùng: bộ viết tay (packs.ts) + phần sinh (catalog.generated.ts — mọi emoji động Noto còn lại, nối
// vào cuối bộ hoạt hình tương ứng). Đây là nguồn DUY NHẤT cho thanh bộ, tìm kiếm và danh sách id máy chủ chấp nhận.
import { HAND_ANIM_PACKS, LEGACY_IDS, SEASON_PACKS, TET_ZODIAC, THREE_D_PACKS, type StickerId, type StickerPack } from "./packs";
import { NOTO_FILL_ITEMS } from "./catalog.generated";

export { SEASON_PACKS, THREE_D_PACKS, TET_ZODIAC, LEGACY_IDS };
export type { StickerId, StickerPack };

/** Bộ hoạt hình (Noto): "Lấp lánh" → … → "Biểu tượng"; phần tuyển tay đứng đầu, phần còn lại theo độ phổ biến. */
export const ANIM_PACKS: StickerPack[] = HAND_ANIM_PACKS.map((p) => {
  const more = NOTO_FILL_ITEMS[p.id];
  return more ? { ...p, items: [...p.items, ...more.split(" ")] } : p;
});

export const ALL_PACKS: StickerPack[] = [...SEASON_PACKS, ...ANIM_PACKS, ...THREE_D_PACKS];

/** Mọi id có trong ít nhất 1 bộ (kể cả bộ mùa + con giáp) hoặc LEGACY_IDS — khớp đúng lib/stickers/ids.generated.ts. */
export function allStickerIds(): StickerId[] {
  const out = new Set<StickerId>();
  for (const p of ALL_PACKS) {
    out.add(p.icon);
    for (const i of p.items) out.add(i);
  }
  for (const z of Object.values(TET_ZODIAC)) out.add(z);
  for (const l of LEGACY_IDS) out.add(l);
  return [...out];
}
