// Menu mẫu nail cá nhân — kiểu dữ liệu, kiểm tra đầu vào, tính chi phí vật tư (dùng chung máy chủ + client).

export const MENU_CATEGORIES = ["HAND", "FOOT", "COMBO", "ADDON"] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<MenuCategory, [string, string]> = {
  HAND: ["Móng tay", "Hands"],
  FOOT: ["Móng chân", "Feet"],
  COMBO: ["Combo tay + chân", "Mani + pedi combos"],
  ADDON: ["Dịch vụ thêm", "Add-ons"],
};
export const TECHNIQUES = ["Gel", "Gel-X", "Bột/Acrylic", "Dip/SNS", "Sơn thường", "Builder gel", "Design", "Chân tay nước"];
export const MAX_MENU_ITEMS = 120;
export const MAX_MENU_IMAGES = 5;

export interface MenuMaterial { name: string; qty: string; cost: number | null }

export interface MenuItemInput {
  category: MenuCategory;
  name: string;
  description: string | null;
  technique: string | null;
  priceFrom: number;
  priceTo: number | null;
  minutes: number | null;
  durabilityWeeks: number | null;
  difficulty: number | null;
  occasion: string | null;
  images: string[];
  materials: MenuMaterial[];
  sourceDesignId: string | null;
  active: boolean;
}

export interface PublicMenuItem extends Omit<MenuItemInput, "materials"> {
  id: string;
  sortOrder: number;
  // Chỉ chủ menu nhận được (người khác: null)
  materials: MenuMaterial[] | null;
  materialCost: number | null;
}

/** Tổng chi phí vật tư (bỏ qua dòng chưa nhập giá). null nếu chưa có giá nào. */
export function materialCost(list: MenuMaterial[]): number | null {
  const priced = list.filter((m) => typeof m.cost === "number" && m.cost >= 0);
  if (!priced.length) return null;
  return Math.round(priced.reduce((a, m) => a + (m.cost as number), 0) * 100) / 100;
}

export const priceLabel = (from: number, to: number | null) =>
  to && to > from ? `$${trim(from)}–${trim(to)}` : `$${trim(from)}`;
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Ảnh chỉ từ kho Cloudinary của PawNail (tải qua /api/upload) hoặc ảnh mẫu PawNail — chặn link lạ
// (theo dõi IP người xem, ảnh không phù hợp).
const IMG_OK = /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/(image|video)\/upload\/[^\s"'<>]+$/i;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
};

/** Làm sạch + kiểm tra 1 mẫu. Trả { ok, value } hoặc { ok:false, error }. */
export function parseMenuItem(b: Record<string, unknown>): { ok: true; value: MenuItemInput } | { ok: false; error: string } {
  const name = str(b.name, 80);
  if (name.length < 2) return { ok: false, error: "Nhập tên mẫu (ít nhất 2 ký tự)." };
  const category = (MENU_CATEGORIES as readonly string[]).includes(String(b.category)) ? (b.category as MenuCategory) : "HAND";
  const priceFrom = num(b.priceFrom, 0, 5000);
  if (priceFrom === null) return { ok: false, error: "Nhập giá (0–5000 USD/AUD)." };
  let priceTo = num(b.priceTo, 0, 5000);
  if (priceTo !== null && priceTo <= priceFrom) priceTo = null;
  const rawImages = (Array.isArray(b.images) ? b.images : []).map((u) => str(u, 600)).filter(Boolean);
  if (rawImages.some((u) => !IMG_OK.test(u))) return { ok: false, error: "Ảnh phải tải lên qua PawNail." };
  const images = rawImages.slice(0, MAX_MENU_IMAGES);
  const materials = (Array.isArray(b.materials) ? b.materials : [])
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return { name: str(o.name, 60), qty: str(o.qty, 30), cost: num(o.cost, 0, 1000) };
    })
    .filter((m) => m.name)
    .slice(0, 30);
  return {
    ok: true,
    value: {
      category,
      name,
      description: str(b.description, 500) || null,
      technique: str(b.technique, 40) || null,
      priceFrom,
      priceTo,
      minutes: num(b.minutes, 5, 600) !== null ? Math.round(num(b.minutes, 5, 600)!) : null,
      durabilityWeeks: num(b.durabilityWeeks, 1, 12) !== null ? Math.round(num(b.durabilityWeeks, 1, 12)!) : null,
      difficulty: num(b.difficulty, 1, 3) !== null ? Math.round(num(b.difficulty, 1, 3)!) : null,
      occasion: str(b.occasion, 40) || null,
      images,
      materials,
      sourceDesignId: str(b.sourceDesignId, 40) || null,
      active: b.active !== false,
    },
  };
}

/** Dòng DB → dữ liệu trả về; `owner` = người xem có phải chủ menu không. */
export function toPublicMenuItem(r: {
  id: string; category: string; name: string; description: string | null; technique: string | null; priceFrom: number; priceTo: number | null;
  minutes: number | null; durabilityWeeks: number | null; difficulty: number | null; occasion: string | null; images: string; materials: string;
  sourceDesignId: string | null; sortOrder: number; active: boolean;
}, owner: boolean): PublicMenuItem {
  const parse = <T,>(s: string, d: T): T => { try { const v = JSON.parse(s); return Array.isArray(v) ? (v as T) : d; } catch { return d; } };
  const mats = parse<MenuMaterial[]>(r.materials, []);
  return {
    id: r.id,
    category: ((MENU_CATEGORIES as readonly string[]).includes(r.category) ? r.category : "HAND") as MenuCategory,
    name: r.name,
    description: r.description,
    technique: r.technique,
    priceFrom: r.priceFrom,
    priceTo: r.priceTo,
    minutes: r.minutes,
    durabilityWeeks: r.durabilityWeeks,
    difficulty: r.difficulty,
    occasion: r.occasion,
    images: parse<string[]>(r.images, []),
    sourceDesignId: r.sourceDesignId,
    sortOrder: r.sortOrder,
    active: r.active,
    materials: owner ? mats : null,
    materialCost: owner ? materialCost(mats) : null,
  };
}
