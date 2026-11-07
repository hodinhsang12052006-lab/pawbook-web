// Tìm sticker theo chữ (EN + VI, không dấu). Tìm trên MỌI bộ, kể cả bộ theo mùa đang ngoài mùa, và — khi đã tải manifest
// mở rộng — mọi thư mục Fluent 3D. Nguồn từ: tên + từ khoá Unicode CLDR (EN + VI), thẻ Noto, từ khoá Fluent, tên bộ,
// từ khoá tiếng Việt viết tay (keywordsVi.ts).
// Điểm: trùng nguyên từ 3 > đầu từ 2 > chuỗi con (≥ 3 ký tự) 1 (+0,5 nếu trùng ở chính TÊN sticker, EN hoặc VI).
// Hoà điểm → độ phổ biến Noto → thứ tự bộ. Cuối cùng bỏ trùng theo KÝ TỰ: mỗi ký tự 1 lần (ưu tiên bản động Noto);
// bản 3D trùng ký tự xếp SAU mọi kết quả khác.
import { foldVi } from "@/lib/chat/fold";
import { ALL_PACKS, ANIM_PACKS, SEASON_PACKS, THREE_D_PACKS, TET_ZODIAC, type StickerId, type StickerPack } from "./catalog";
import { KEYWORDS_VI, type ViTarget } from "./keywordsVi";
import type { Manifest } from "./manifest";

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

interface Entry {
  texts: string[]; // cụm từ đã bỏ dấu
  names: number; // texts[0..names) là tên (EN, VI) → được cộng điểm
}
interface Index {
  entries: Map<StickerId, Entry>;
  vi: [string, ViTarget[]][]; // từ khoá VI viết tay đã bỏ dấu
  order: Map<StickerId, number>;
}
let cached: { m: Manifest; idx: Index } | null = null;

function buildIndex(m: Manifest): Index {
  const entries = new Map<StickerId, Entry>();
  for (const id of Object.keys(m)) {
    const meta = m[id];
    const names = [meta.en[0], meta.vi[0]].filter(Boolean).map(foldVi);
    const rest = [...meta.en.slice(1), ...meta.vi.slice(1)].map(foldVi);
    entries.set(id, { texts: [...names, ...rest], names: names.length });
  }
  const order = new Map<StickerId, number>();
  let n = 0;
  for (const p of PACK_ORDER) {
    const labels = [foldVi(p.label[1]), foldVi(p.label[0])];
    for (const id of p.id === "tet" ? packItems("tet") : p.items) {
      if (!order.has(id)) order.set(id, n++);
      entries.get(id)?.texts.push(...labels);
    }
  }
  const vi = Object.entries(KEYWORDS_VI).map(([k, v]) => [foldVi(k), v] as [string, ViTarget[]]);
  return { entries, vi, order };
}

const glyphKey = (m: Manifest, id: StickerId) => m[id].glyph.replace(/️/g, "");

/** Bỏ trùng theo ký tự: giữ 1 bản / ký tự ở vị trí tốt nhất (ưu tiên Noto), bản trùng còn lại xếp cuối. */
export function dedupeByGlyph(ranked: StickerId[], m: Manifest): StickerId[] {
  const groups = new Map<string, StickerId[]>();
  for (const id of ranked) {
    const g = glyphKey(m, id);
    const arr = groups.get(g);
    if (arr) arr.push(id);
    else groups.set(g, [id]);
  }
  const head: StickerId[] = [];
  const tail: StickerId[] = [];
  const done = new Set<string>();
  for (const id of ranked) {
    const g = glyphKey(m, id);
    if (done.has(g)) continue;
    done.add(g);
    const group = groups.get(g)!;
    const keep = group.find((x) => m[x].src === "noto") ?? group[0];
    head.push(keep);
    for (const x of group) if (x !== keep) tail.push(x);
  }
  return [...head, ...tail];
}

export function searchStickers(query: string, manifest: Manifest, limit = 60): StickerId[] {
  const q = foldVi(query).trim().replace(/\s+/g, " ");
  if (!q) return [];
  if (!cached || cached.m !== manifest) cached = { m: manifest, idx: buildIndex(manifest) };
  const { entries, vi, order } = cached.idx;
  const score = new Map<StickerId, number>();
  const bump = (id: StickerId, s: number) => {
    if (s > 0 && manifest[id] && (score.get(id) ?? 0) < s) score.set(id, s);
  };
  for (const [id, { texts, names }] of entries) {
    let best = 0;
    // trùng ở TÊN xếp trên trùng ở từ khoá phụ cùng hạng ("heart" → ❤️ trước 😘); tên ngắn (ít từ) lên trước
    texts.forEach((t, i) => {
      const sc = scoreText(q, t);
      if (sc) best = Math.max(best, sc + (i < names ? 0.5 + 0.2 / Math.max(1, t.split(" ").length) : 0));
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
  const ranked = [...score.entries()]
    .sort(
      ([a, sa], [b, sb]) =>
        sb - sa ||
        (manifest[b].p ?? 0) - (manifest[a].p ?? 0) ||
        (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) ||
        (a < b ? -1 : a > b ? 1 : 0)
    )
    .map(([id]) => id);
  return dedupeByGlyph(ranked, manifest).slice(0, limit);
}
