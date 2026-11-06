// Hashtag tiếng Việt viết không dấu (#ViecLamNail, #ThoNail, #MongMuaThu…) — người xem tiếng Anh không đọc được,
// nên "Hashtag đang lên" lọc theo ngôn ngữ người xem. THUẦN.
import { hasVietnamese } from "@/lib/i18n/viText";
import { themeByTag } from "@/lib/studioThemes";

// Âm tiết tiếng Việt hay gặp trong hashtag nghề nail (không dấu, chữ thường).
const VI_SYLLABLES = new Set(
  "tin nganh viec lam tho tiem mong mua thu he xuan dong tet ruc ro nam moi me co dau tuu truong tuyen gap luong chia ban be khach dep xinh hong trang den do vang xanh tim nau bot nuoc chan tay ve hoa tang ngay cuoi tuan thang nghe kinh nghiem huong dan meo hay nhat noi bat song ao tron vuong dai ngan".split(" "),
);
// Từ tiếng Anh / thương hiệu viết giống âm tiết Việt — không tính.
const EN_OK = new Set(["nail", "nails", "pawnail", "gel", "dip", "art", "design", "set", "fall", "summer", "spring", "winter", "new", "year", "chrome", "french", "ombre", "bridal", "prom", "mani", "pedi", "tips", "tech", "salon"]);

/** "ViecLamNail" → ["viec", "lam", "nail"]. */
const words = (tag: string) => tag.replace(/^#/, "").split(/(?=[A-Z])|[_\-\d]+/).map((w) => w.toLowerCase()).filter(Boolean);

/** Hashtag là tiếng Việt (có dấu, hoặc ≥ 2 âm tiết Việt không dấu, hoặc là bí danh tiếng Việt của chủ đề mùa). */
export function isVietnameseTag(tag: string): boolean {
  if (hasVietnamese(tag)) return true;
  const t = themeByTag(tag);
  if (t && t.hashtag.toLowerCase() !== tag.replace(/^#/, "").toLowerCase()) return true; // bí danh cũ (#MongMuaThu)
  const w = words(tag);
  const vi = w.filter((x) => VI_SYLLABLES.has(x) && !EN_OK.has(x)).length;
  const generic = w.filter((x) => x === "nail" || x === "nails").length;
  // ≥ 2 âm tiết Việt, hoặc 1 âm tiết Việt + "Nail" (#ThoNail), hoặc 1 âm tiết ngắn đứng riêng (#Bot).
  return vi >= 2 || (vi >= 1 && vi + generic === w.length);
}

/** Lọc hashtag theo ngôn ngữ người xem: tiếng Anh → bỏ hashtag tiếng Việt; tiếng Việt → giữ tất cả. */
export const tagsForLocale = <T extends { tag: string }>(list: T[], locale: "vi" | "en"): T[] =>
  locale === "en" ? list.filter((t) => !isVietnameseTag(t.tag)) : list;
