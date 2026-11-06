import type { CSSProperties } from "react";

// Hình nền khung chat (như "chủ đề" Messenger) — thuần CSS, không tải ảnh,
// không tốn pin. Chọn riêng từng cuộc trò chuyện hoặc cho tất cả; lưu trên
// thiết bị (localStorage) nên người kia không bị đổi theo.

export interface ChatWallpaper {
  id: string;
  vi: string;
  en: string;
  style: CSSProperties;
  swatch: string; // CSS background cho ô xem trước
  pattern?: boolean; // swatch có họa tiết lặp (thu nhỏ cho vừa ô)
}

const svg = (body: string, size = 120) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`)}")`;

// Họa tiết "móng + hoa" vẽ nét mảnh, rất mờ — nền nhận diện ngành nail.
export const NAIL_PATTERN = svg(
  "<g fill='none' stroke='rgba(244,114,182,0.13)' stroke-width='1.4'>" +
    "<path d='M24 18c-6 0-9 6-9 14v16c0 4 3 6 9 6s9-2 9-6V32c0-8-3-14-9-14z'/>" +
    "<path d='M18 26c3-3 9-3 12 0'/>" +
    "<circle cx='86' cy='34' r='5'/><circle cx='86' cy='22' r='6'/><circle cx='97' cy='31' r='6'/><circle cx='93' cy='44' r='6'/><circle cx='79' cy='44' r='6'/><circle cx='75' cy='31' r='6'/>" +
    "<path d='M70 92l4-10 4 10-10-6h12z'/>" +
    "<path d='M22 96c8-6 16-6 24 0'/>" +
    "</g>"
);
const GLITTER = svg(
  "<g fill='rgba(253,224,171,0.5)'><circle cx='12' cy='18' r='1.2'/><circle cx='70' cy='9' r='0.8'/><circle cx='104' cy='40' r='1.4'/><circle cx='40' cy='62' r='0.9'/><circle cx='88' cy='86' r='1.1'/><circle cx='18' cy='104' r='0.8'/></g>" +
    "<g fill='rgba(244,114,182,0.45)'><circle cx='56' cy='30' r='1'/><circle cx='110' cy='108' r='0.9'/><circle cx='30' cy='84' r='1.3'/><circle cx='78' cy='58' r='0.7'/></g>" +
    "<path d='M96 14l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z' fill='rgba(255,255,255,0.35)'/>",
  120
);

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  { id: "default", vi: "PawNail Aurora", en: "PawNail Aurora", style: { backgroundColor: "#07061a" }, swatch: "radial-gradient(circle at 90% 10%, rgba(236,72,153,.35), transparent 60%), radial-gradient(circle at 10% 90%, rgba(139,92,246,.3), transparent 60%), #0a1020" },
  {
    id: "nails",
    vi: "Hoa móng",
    en: "Nail art",
    style: { backgroundColor: "#120a1a", backgroundImage: `radial-gradient(40rem 28rem at 100% 0%, rgba(236,72,153,.12), transparent 60%), ${NAIL_PATTERN}`, backgroundSize: "auto, 120px 120px" },
    swatch: `${NAIL_PATTERN}, #1a0d22`,
    pattern: true,
  },
  {
    id: "rose",
    vi: "Hồng phấn",
    en: "Rose blush",
    style: { backgroundColor: "#1a0a14", backgroundImage: "radial-gradient(36rem 30rem at 0% 0%, rgba(244,114,182,.22), transparent 60%), radial-gradient(30rem 26rem at 100% 100%, rgba(251,113,133,.16), transparent 60%)" },
    swatch: "linear-gradient(135deg, #4a1530, #1a0a14 70%)",
  },
  {
    id: "aurora",
    vi: "Đêm tím",
    en: "Violet night",
    style: { backgroundColor: "#0b0718", backgroundImage: "radial-gradient(40rem 22rem at 50% -10%, rgba(139,92,246,.28), transparent 65%), radial-gradient(30rem 20rem at 0% 100%, rgba(59,130,246,.14), transparent 60%), radial-gradient(28rem 18rem at 100% 70%, rgba(217,70,239,.14), transparent 60%)" },
    swatch: "linear-gradient(160deg, #3b1d6e, #0b0718 75%)",
  },
  {
    id: "glitter",
    vi: "Lấp lánh",
    en: "Glitter",
    style: { backgroundColor: "#0d0b14", backgroundImage: `${GLITTER}, radial-gradient(34rem 24rem at 100% 0%, rgba(250,204,21,.08), transparent 60%)`, backgroundSize: "120px 120px, auto" },
    swatch: `${GLITTER}, linear-gradient(135deg, #2a2112, #0d0b14)`,
    pattern: true,
  },
  {
    id: "marble",
    vi: "Đá marble",
    en: "Marble",
    style: { backgroundColor: "#111318", backgroundImage: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,.05) 42%, transparent 46%), linear-gradient(35deg, transparent 55%, rgba(255,255,255,.04) 57%, transparent 60%), radial-gradient(30rem 22rem at 20% 20%, rgba(203,213,225,.08), transparent 60%)" },
    swatch: "linear-gradient(115deg, #2b2f38 40%, #4b5160 43%, #2b2f38 47%), #2b2f38",
  },
  {
    id: "ocean",
    vi: "Biển đêm",
    en: "Deep ocean",
    style: { backgroundColor: "#04121a", backgroundImage: "radial-gradient(38rem 26rem at 100% 0%, rgba(20,184,166,.16), transparent 60%), radial-gradient(34rem 24rem at 0% 100%, rgba(14,165,233,.16), transparent 60%)" },
    swatch: "linear-gradient(160deg, #0f4c5c, #04121a 75%)",
  },
  {
    id: "champagne",
    vi: "Champagne",
    en: "Champagne",
    style: { backgroundColor: "#15110a", backgroundImage: "radial-gradient(36rem 26rem at 100% 0%, rgba(251,191,36,.14), transparent 60%), radial-gradient(30rem 22rem at 0% 100%, rgba(244,114,182,.10), transparent 60%)" },
    swatch: "linear-gradient(135deg, #5a4520, #15110a 75%)",
  },
];

const KEY = "pn_chat_wp";
type Saved = { all?: string; byChat?: Record<string, string> };

function read(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Saved;
  } catch {
    return {};
  }
}

export function getWallpaperId(chatKey: string | null): string {
  const s = read();
  return (chatKey && s.byChat?.[chatKey]) || s.all || "default";
}

export function saveWallpaper(chatKey: string | null, id: string, forAll: boolean) {
  const s = read();
  if (forAll || !chatKey) {
    s.all = id;
    s.byChat = {}; // "cho tất cả" xoá lựa chọn riêng để đồng bộ
  } else {
    s.byChat = { ...(s.byChat || {}), [chatKey]: id };
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export const wallpaperById = (id: string) => CHAT_WALLPAPERS.find((w) => w.id === id) ?? CHAT_WALLPAPERS[0];

// Màu 3 quầng sáng trôi phía sau tin nhắn (components/chat/ChatBackdrop) theo từng chủ đề.
export const WALLPAPER_ORBS: Record<string, [string, string, string]> = {
  default: ["rgba(236,72,153,.55)", "rgba(124,58,237,.5)", "rgba(20,184,166,.28)"],
  nails: ["rgba(236,72,153,.4)", "rgba(190,24,93,.35)", "rgba(251,191,36,.18)"],
  rose: ["rgba(244,114,182,.5)", "rgba(251,113,133,.4)", "rgba(217,70,239,.25)"],
  aurora: ["rgba(139,92,246,.55)", "rgba(59,130,246,.4)", "rgba(217,70,239,.3)"],
  glitter: ["rgba(250,204,21,.25)", "rgba(236,72,153,.3)", "rgba(255,255,255,.12)"],
  marble: ["rgba(203,213,225,.18)", "rgba(148,163,184,.15)", "rgba(244,114,182,.12)"],
  ocean: ["rgba(20,184,166,.45)", "rgba(14,165,233,.45)", "rgba(99,102,241,.25)"],
  champagne: ["rgba(251,191,36,.35)", "rgba(244,114,182,.3)", "rgba(253,186,116,.22)"],
};

// ---- V2 "warm luxe dark" (06/11/2026): bộ hình nền trong app — tĩnh, ấm, mỗi nền khác nhau rõ ràng ----
// Giữ nguyên 8 id + tên vi/en ở trên (đã lưu trong localStorage pn_chat_wp); chỉ thay phần hiển thị.
// Toàn bộ là CSS/SVG tĩnh vẽ trên khung (không phải trên vùng cuộn) — bong bóng đặc nên độ tương phản chữ
// không phụ thuộc hình nền. `--chat-bar-bg` = màu nền ở 96% → thanh trên + khung soạn tin liền mạch.
// Họa tiết là nét vẽ gốc của PawNail (không dùng tài sản của ứng dụng nào khác).
const NAIL_PATHS =
  "<path d='M24 18c-6 0-9 6-9 14v16c0 4 3 6 9 6s9-2 9-6V32c0-8-3-14-9-14z'/>" +
  "<path d='M18 26c3-3 9-3 12 0'/>" +
  "<circle cx='86' cy='34' r='5'/><circle cx='86' cy='22' r='6'/><circle cx='97' cy='31' r='6'/><circle cx='93' cy='44' r='6'/><circle cx='79' cy='44' r='6'/><circle cx='75' cy='31' r='6'/>" +
  "<path d='M70 92l4-10 4 10-10-6h12z'/>" +
  "<path d='M22 96c8-6 16-6 24 0'/>";
const motif = (stroke: string, size: number) => svg(`<g fill='none' stroke='${stroke}' stroke-width='1.2' transform='scale(${size / 120})'>${NAIL_PATHS}</g>`, size);
const MOTIF_ROSE = motif("rgba(255,236,246,0.028)", 160);
const MOTIF_GOLD = motif("rgba(227,196,138,0.06)", 140);
const MOTIF_SWATCH = motif("rgba(255,236,246,0.16)", 160);
const MOTIF_GOLD_SWATCH = motif("rgba(227,196,138,0.28)", 140);
const GLITTER_DOTS = svg(
  "<g fill='rgba(227,196,138,0.22)'><circle cx='12' cy='18' r='1'/><circle cx='70' cy='9' r='0.7'/><circle cx='104' cy='40' r='1.1'/><circle cx='40' cy='62' r='0.8'/><circle cx='88' cy='86' r='0.9'/><circle cx='18' cy='104' r='0.7'/><circle cx='122' cy='120' r='0.9'/><circle cx='58' cy='128' r='0.7'/></g>",
  140
);
const marbleVeins = (a: number) =>
  svg(
    `<g fill='none' stroke-linecap='round'>` +
      `<path d='M-20 70C40 40 70 120 130 90s90-60 150-20' stroke='rgba(255,240,230,${a})' stroke-width='1.6'/>` +
      `<path d='M-20 170c50-30 90 10 140-15s80-55 160-25' stroke='rgba(255,240,230,${a * 0.7})' stroke-width='1'/>` +
      `<path d='M60 -10c-10 60 30 90 10 150s20 80 40 120' stroke='rgba(255,240,230,${a * 0.55})' stroke-width='0.8'/>` +
      `<path d='M180 -10c-20 50 10 80-15 130' stroke='rgba(255,240,230,${a * 0.45})' stroke-width='0.7'/>` +
      `</g>`,
    280
  );
const AMBIENT = "radial-gradient(120% 55% at 50% -8%, rgba(236,140,176,.10), transparent 62%), radial-gradient(70% 45% at 100% 0%, rgba(222,190,132,.07), transparent 60%)";
const bar = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.96)`;
};
const wp = (bg: string, image: string, size: string, swatch?: string, pattern?: boolean): Pick<ChatWallpaper, "style" | "swatch" | "pattern"> => ({
  style: { backgroundColor: bg, backgroundImage: image, backgroundSize: size, ["--chat-bar-bg" as string]: bar(bg) } as CSSProperties,
  swatch: swatch ?? `${image}, ${bg}`,
  pattern,
});

const REFINED: Record<string, Pick<ChatWallpaper, "style" | "swatch" | "pattern"> & { vi?: string; en?: string }> = {
  // Mặc định "Lụa mận": nền mận + ánh sáng hồng/champagne phía trên + họa tiết móng rất mờ
  default: { ...wp("#16111a", `${AMBIENT}, ${MOTIF_ROSE}`, "auto, auto, 160px 160px", `${AMBIENT}, ${MOTIF_SWATCH}, #16111a`, true), vi: "Lụa mận", en: "Plum silk" },
  nails: wp("#17121b", MOTIF_GOLD, "140px 140px", `${MOTIF_GOLD_SWATCH}, #17121b`, true),
  rose: wp("#1a1119", "radial-gradient(80% 50% at 0 0, rgba(232,120,160,.16), transparent 70%), radial-gradient(60% 40% at 100% 100%, rgba(232,120,160,.08), transparent 70%)", "auto, auto"),
  aurora: wp("#15111d", "radial-gradient(90% 50% at 50% -10%, rgba(150,110,200,.16), transparent 70%)", "auto"),
  glitter: wp("#17121a", `${GLITTER_DOTS}, radial-gradient(80% 45% at 100% 0, rgba(227,196,138,.08), transparent 70%)`, "140px 140px, auto", `${GLITTER_DOTS}, radial-gradient(80% 45% at 100% 0, rgba(227,196,138,.2), transparent 70%), #17121a`, true),
  marble: wp("#1a1518", marbleVeins(0.05), "280px 280px", `${marbleVeins(0.14)}, #1f191c`, true),
  ocean: wp("#101518", "radial-gradient(80% 50% at 100% 0, rgba(70,150,160,.14), transparent 70%)", "auto", "radial-gradient(90% 70% at 100% 0, rgba(70,150,160,.35), transparent 70%), #101518"),
  champagne: wp("#19140f", "radial-gradient(100% 55% at 50% -10%, rgba(227,196,138,.16), transparent 70%)", "auto", "radial-gradient(100% 70% at 50% -10%, rgba(227,196,138,.36), transparent 70%), #19140f"),
};
for (const w of CHAT_WALLPAPERS) if (REFINED[w.id]) Object.assign(w, REFINED[w.id]);
