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
const NAIL_PATTERN = svg(
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
  { id: "default", vi: "PawNail", en: "PawNail", style: {}, swatch: "radial-gradient(circle at 90% 10%, rgba(236,72,153,.35), transparent 60%), radial-gradient(circle at 10% 90%, rgba(139,92,246,.3), transparent 60%), #0a1020" },
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
