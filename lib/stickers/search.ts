// Tìm sticker theo chữ (EN + VI, không dấu). Tìm trên MỌI bộ, kể cả bộ theo mùa đang ngoài mùa.
// Điểm: trùng nguyên từ 3 > đầu từ 2 > chuỗi con (≥ 3 ký tự) 1 (+0,5 nếu trùng ở chính tên sticker).
// Hoà điểm → độ phổ biến Noto → thứ tự bộ.
import { foldVi } from "@/lib/chat/fold";
import { ALL_PACKS, ANIM_PACKS, SEASON_PACKS, THREE_D_PACKS, TET_ZODIAC, type StickerId, type StickerPack } from "./packs";
import { KEYWORDS_VI, type ViTarget } from "./keywordsVi";
import type { StickerMeta } from "./manifest.generated";

type Manifest = Record<StickerId, StickerMeta>;

/** Thứ tự bộ khi hoà điểm: bộ hoạt hình → 3D → mùa (giống thanh bộ). */
const PACK_ORDER: StickerPack[] = [...ANIM_PACKS, ...THREE_D_PACKS, ...SEASON_PACKS];

function packItems(id: string): StickerId[] {
  const p = ALL_PACKS.find((x) => x.id === id);
  if (!p) return [];
  return p.id === "tet" ? [...p.items, ...Object.values(TET_ZODIAC)] : p.items;
}

function scoreText(q: string, text: string): number {
  // text: cụm từ đã bỏ dấu, chữ thường
  if (text === q) return 3;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.includes(q)) return 3;
  if (text.startsWith(q) || words.some((w) => w.startsWith(q))) return 2;
  if (q.length >= 3 && text.includes(q)) return 1;
  return 0;
}

interface Index {
  en: Map<StickerId, string[]>; // cụm từ EN đã bỏ dấu (từ khoá + tên bộ chứa nó)
  vi: [string, ViTarget[]][]; // từ khoá VI đã bỏ dấu
  order: Map<StickerId, number>;
}
let cached: { m: Manifest; idx: Index } | null = null;

function buildIndex(m: Manifest): Index {
  const en = new Map<StickerId, string[]>();
  for (const [id, meta] of Object.entries(m)) en.set(id, meta.en.map(foldVi));
  const order = new Map<StickerId, number>();
  let n = 0;
  for (const p of PACK_ORDER) {
    for (const id of p.id === "tet" ? packItems("tet") : p.items) {
      if (!order.has(id)) order.set(id, n++);
      const labels = en.get(id);
      if (labels) labels.push(foldVi(p.label[1]), foldVi(p.label[0]));
    }
  }
  const vi = Object.entries(KEYWORDS_VI).map(([k, v]) => [foldVi(k), v] as [string, ViTarget[]]);
  return { en, vi, order };
}

export function searchStickers(query: string, manifest: Manifest, limit = 60): StickerId[] {
  const q = foldVi(query).trim().replace(/\s+/g, " ");
  if (!q) return [];
  if (!cached || cached.m !== manifest) cached = { m: manifest, idx: buildIndex(manifest) };
  const { en, vi, order } = cached.idx;
  const score = new Map<StickerId, number>();
  const bump = (id: StickerId, s: number) => {
    if (s > 0 && manifest[id] && (score.get(id) ?? 0) < s) score.set(id, s);
  };
  for (const [id, texts] of en) {
    let best = 0;
    // texts[0] = tên sticker: trùng ở TÊN xếp trên trùng ở từ khoá phụ cùng hạng ("heart" → ❤️ trước 😘)
    texts.forEach((t, i) => {
      const sc = scoreText(q, t);
      // tên ngắn (ít từ) lên trước: "red heart" trước "smiling face with heart eyes"
      if (sc) best = Math.max(best, sc + (i === 0 ? 0.5 + 0.2 / Math.max(1, t.split(" ").length) : 0));
    });
    bump(id, best);
  }
  for (const [key, targets] of vi) {
    const s = scoreText(q, key);
    if (!s) continue;
    for (const t of targets) {
      if (t.startsWith("pack:")) for (const id of packItems(t.slice(5))) bump(id, s);
      else bump(t, s);
    }
  }
  return [...score.entries()]
    .sort(
      ([a, sa], [b, sb]) =>
        sb - sa ||
        (manifest[b].p ?? 0) - (manifest[a].p ?? 0) ||
        (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) ||
        (a < b ? -1 : a > b ? 1 : 0)
    )
    .slice(0, limit)
    .map(([id]) => id);
}
