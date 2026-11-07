// Hero (landing "/") + auth photo set — the single seam for marketing imagery.
//
// Today: 24 owner-approved Google Flow catalog images (AI illustrations, 1024 px sources) cropped 4:5 and exported
// by scripts/hero/export_hero.py to public/hero/<code>-{480,640,800}.avif + <code>-640.webp. Every image is
// labelled "AI illustration" on screen (lib/imageLabel.ts). Nothing here may come from the daily design engine.
//
// Later: when larger photography lands (≥ 1600×2400, widths [1080, 1440]), add it to HERO_IMAGES with
// source "photo" and list it in AUTH_BLEED for its season — AuthPhotoStage then switches from the framed 2-card
// plate to a full-bleed photo with a scrim automatically.
import type { SeasonId } from "@/lib/season";

export type HeroSlot = "front" | "mid" | "back" | "m4" | "m5";
export const HERO_SLOTS: readonly HeroSlot[] = ["front", "mid", "back", "m4", "m5"];
export type Skin = "fair" | "light-olive" | "medium-tan" | "warm-medium-brown" | "deep-brown";
export type Chip = "bl" | "br" | "tl" | "tr";
export type Backdrop = "linen" | "marble" | "sage-plaster" | "travertine" | "satin" | "oak" | "ceramic";

export interface HeroImage {
  code: string;
  /** file stem in public/hero ("d130") */
  file: string;
  alt: { en: string; vi: string };
  source: "flow" | "photo";
  skin: Skin;
  backdrop: Backdrop;
  /** horizontal crop start (fraction of the 1024 px source) */
  crop: { x0: number };
  /** corner of the image-source chip — the corner away from the nails */
  chip: Chip;
  w: number;
  h: number;
  widths: number[];
}

const img = (code: string, x0: number, chip: HeroImage["chip"], skin: Skin, backdrop: Backdrop, en: string, vi: string): HeroImage => ({
  code, file: code.toLowerCase(), alt: { en, vi }, source: "flow", skin, backdrop, crop: { x0 }, chip, w: 800, h: 1000, widths: [480, 640, 800],
});

export const HERO_IMAGES: HeroImage[] = [
  img("D130", 0.0, "bl", "warm-medium-brown", "linen", "Raspberry chrome almond nails", "Móng hạnh nhân tráng gương màu mâm xôi"),
  img("D149", 0.2, "bl", "deep-brown", "marble", "Pearl chrome French on milky pink", "French tráng gương ngọc trai trên nền hồng sữa"),
  img("D047", 0.0, "bl", "medium-tan", "sage-plaster", "Burgundy nails with 3D gold chrome drops", "Móng đỏ rượu đính giọt chrome vàng 3D"),
  img("D033", 0.0, "bl", "light-olive", "travertine", "Hot pink aura on milky pink", "Aura hồng đậm trên nền hồng sữa"),
  img("D021", 0.2, "bl", "fair", "marble", "Sheer baby pink with a pearl glaze", "Hồng phấn trong phủ ánh ngọc trai"),
  img("D058", 0.15, "bl", "light-olive", "linen", "Burgundy cat eye", "Mắt mèo đỏ rượu"),
  img("D164", 0.0, "br", "deep-brown", "satin", "Mocha to champagne ombre", "Ombre nâu mocha sang champagne"),
  img("D185", 0.0, "br", "warm-medium-brown", "travertine", "Mulled wine micro French on milky white", "French mảnh đỏ rượu trên nền trắng sữa"),
  img("D210", 0.1, "bl", "warm-medium-brown", "linen", "Burgundy with gold shimmer", "Đỏ rượu ánh nhũ vàng"),
  img("D196", 0.0, "br", "fair", "satin", "Gold glitter fade on emerald", "Nhũ vàng loang trên nền xanh lục bảo"),
  img("D139", 0.2, "bl", "deep-brown", "oak", "Cherry red French on milky white", "French đỏ cherry trên nền trắng sữa"),
  img("D186", 0.0, "br", "fair", "linen", "Gold glitter French on milky white", "French nhũ vàng trên nền trắng sữa"),
  img("D044", 0.0, "br", "deep-brown", "satin", "Sheer strawberry red jelly", "Thạch đỏ dâu trong"),
  img("D094", 0.1, "bl", "deep-brown", "ceramic", "Icy blue chrome", "Chrome xanh băng"),
  img("D161", 0.0, "br", "fair", "travertine", "Silver chrome French on pink nude", "French chrome bạc trên nền hồng nude"),
  img("D129", 0.2, "bl", "deep-brown", "travertine", "Silver chrome French on hot pink", "French chrome bạc trên nền hồng đậm"),
  img("D125", 0.0, "br", "warm-medium-brown", "marble", "Icy blue aura on milky white", "Aura xanh băng trên nền trắng sữa"),
  img("D041", 0.0, "br", "fair", "travertine", "Icy blue and periwinkle mix", "Phối xanh băng và tím dừa cạn"),
  img("D019", 0.2, "tl", "deep-brown", "oak", "Hot pink milk bath nails", "Móng milk bath hồng đậm"),
  img("D063", 0.1, "br", "light-olive", "sage-plaster", "Milky white and gold double French on butter yellow", "French đôi trắng sữa và vàng trên nền vàng bơ"),
  img("D025", 0.2, "bl", "warm-medium-brown", "travertine", "Milky pink chrome", "Chrome hồng sữa"),
  img("D110", 0.2, "bl", "warm-medium-brown", "ceramic", "Persimmon syrup nails", "Móng syrup cam hồng"),
  img("D034", 0.15, "bl", "deep-brown", "linen", "Glossy persimmon", "Cam hồng bóng"),
  img("D090", 0.1, "bl", "warm-medium-brown", "linen", "Cobalt blue syrup nails", "Móng syrup xanh coban"),
];

const BY_CODE = new Map(HERO_IMAGES.map((i) => [i.code, i]));
export const heroImage = (code: string): HeroImage | undefined => BY_CODE.get(code);

const set = (front: string, mid: string, back: string, m4: string, m5: string): Record<HeroSlot, string> => ({ front, mid, back, m4, m5 });
/** Every set: ≥ 40% medium / deep skin, ≥ 3 backdrops, no knit; AU sets never show snow, wool or plaid. */
export const HERO_SETS: Record<SeasonId, Record<HeroSlot, string>> = {
  base: set("D130", "D149", "D047", "D033", "D021"),
  "us-harvest": set("D058", "D164", "D185", "D210", "D047"),
  "us-holiday": set("D196", "D139", "D186", "D044", "D130"),
  nye: set("D186", "D094", "D161", "D129", "D149"),
  "us-winter": set("D094", "D021", "D125", "D149", "D033"),
  "au-jacaranda": set("D041", "D019", "D063", "D025", "D021"),
  "au-summer-festive": set("D110", "D125", "D186", "D034", "D130"),
  "au-summer": set("D090", "D110", "D063", "D034", "D125"),
};

export function heroSet(season: SeasonId | string | null | undefined): Record<HeroSlot, HeroImage> {
  const codes = HERO_SETS[(season ?? "base") as SeasonId] ?? HERO_SETS.base;
  return Object.fromEntries(HERO_SLOTS.map((s) => [s, BY_CODE.get(codes[s])!])) as Record<HeroSlot, HeroImage>;
}

export const avifSrcSet = (i: HeroImage) => i.widths.map((w) => `/hero/${i.file}-${w}.avif ${w}w`).join(", ");
export const webpSrc = (i: HeroImage) => `/hero/${i.file}-640.webp`;

// Desktop front card: sizes = 1.5 × its 352 px layout width, so a DPR 1 screen still decodes the 640 file (the card
// is projected in 3D and the eye lands on it first; 480 px looked soft). mid/back already get ≥ 2× from the 480 file.
export const HERO_SIZES = {
  front: "(min-width:1024px) 528px, min(64vw, 300px)",
  mid: "(min-width:1024px) 232px, min(64vw, 300px)",
  back: "(min-width:1024px) 200px, min(64vw, 300px)",
  strip: "min(64vw, 300px)",
} as const;
/**
 * Chip corner per position: in the 3D stack the mid card shows only its LEFT part (a "br" chip would hide behind
 * the front card → top-left, which is clear of the nails for every mid entry) and the back card only its bottom /
 * right edge (never "tl"); the auth plate's back card shows only its RIGHT part ("tr"). "a>b" = replace a by b,
 * "*>b" = always b. The pre-paint picker applies the same rule (data-chip-fix).
 */
export const CHIP_FIX: Partial<Record<HeroSlot | "authBack", string>> = { mid: "br>tl", back: "tl>bl", authBack: "*>tr" };
export function fixChip(chip: Chip, fix: string | undefined): Chip {
  if (!fix) return chip;
  const [from, to] = fix.split(">");
  return from === "*" || from === chip ? (to as Chip) : chip;
}

export const slotSizes = (slot: HeroSlot) => (slot === "front" || slot === "mid" || slot === "back" ? HERO_SIZES[slot] : HERO_SIZES.strip);

/**
 * Seam: season → full-bleed auth photo (≥ 1600×2400, widths [1080, 1440]) — empty until larger photography
 * exists. A 1024 px source would look soft full-bleed at DPR 2, so today the auth panel is a framed 2-card plate.
 */
export const AUTH_BLEED: Partial<Record<SeasonId, string>> = {};

// ---------------------------------------------------------------------------------------------------------------
// Pre-paint picker. "/" and /auth/* are static HTML, so the server cannot know the viewer's market / season.
// The photo markup is rendered WITHOUT src/srcset (nothing downloads for the wrong season), and this inline script
// — placed right after the markup — reads html[data-season] (SEASON_BOOT) and fills every [data-hero-slot] in its
// previous sibling before first paint. React then renders the identical attributes after mount.

/** Compact per-language data for the picker: c = code → [file, alt, chip], s = season → "slot codes". */
function pickerData(lang: "en" | "vi", withAlt: boolean) {
  const c: Record<string, [string, string, string]> = {};
  for (const i of HERO_IMAGES) c[i.code] = [i.file, withAlt ? `${i.alt[lang]} — ${lang === "vi" ? "ảnh minh hoạ AI" : "AI illustration"}` : "", i.chip];
  const s: Record<string, string> = {};
  for (const [season, slots] of Object.entries(HERO_SETS)) s[season] = HERO_SLOTS.map((k) => slots[k]).join(" ");
  return { c, s };
}

/** Inline script for a photo group: `withAlt` false for the decorative (aria-hidden) auth stage. */
export function heroPickerScript(lang: "en" | "vi", withAlt = true): string {
  const data = JSON.stringify(pickerData(lang, withAlt)).replace(/</g, "\\u003c");
  return (
    `(()=>{try{var M=${data},r=document.currentScript.previousElementSibling,` +
    `t=(M.s[document.documentElement.getAttribute("data-season")]||M.s.base).split(" ");` +
    `r.querySelectorAll("[data-hero-slot]").forEach(e=>{var a=M.c[t[+e.dataset.heroSlot]],i=e.querySelector("img"),s=e.querySelector("source"),l=e.querySelector("[data-chip]"),c=a[2],f=(e.dataset.chipFix||"").split(">");` +
    `if(f[0]=="*"||f[0]==c)c=f[1];s.srcset=[480,640,800].map(w=>"/hero/"+a[0]+"-"+w+".avif "+w+"w").join(", ");s.sizes=i.sizes=e.dataset.sizes;i.alt=a[1];i.src="/hero/"+a[0]+"-640.webp";l&&(l.dataset.chip=c)})}catch(e){}})()`
  );
}
