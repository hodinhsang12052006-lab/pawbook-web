// Từ khoá tìm sticker tiếng Việt (viết tay) — BỔ SUNG cho tên + từ khoá Unicode CLDR tiếng Việt (manifest): cụm hay gõ trong
// tiệm (cảm ơn, đặt lịch, lì xì…) và tên bộ. So khớp KHÔNG DẤU (foldVi): "cam on" = "cảm ơn" = "cám ơn".
// Giá trị: id sticker, hoặc "pack:<id bộ>" = cả bộ (kể cả bộ theo mùa đang ngoài mùa).
import { flId, type StickerId } from "./packs";

export type ViTarget = StickerId | `pack:${string}`;

const ENTRIES: [keys: string[], targets: ViTarget[]][] = [
  [["cảm ơn", "cám ơn", "thank", "thanks"], ["pack:thanks", "🙏"]],
  [["yêu", "thương", "tim", "love"], ["pack:hearts", "pack:love"]],
  [["móng", "nail", "sơn", "sơn gel", "làm móng"], ["💅", flId("Nail polish"), "pack:beauty"]],
  [["lấp lánh", "sang chảnh", "glam"], ["pack:glam"]],
  [["đẹp", "làm đẹp", "son", "môi"], ["pack:beauty"]],
  [["chúc mừng", "mừng", "congrats"], ["pack:celebrate", "pack:party"]],
  [["sinh nhật"], ["🎂", flId("Birthday cake"), flId("Cupcake")]],
  [["cười", "haha", "hihi"], ["😂", "🤣"]],
  // CLDR chỉ giữ 8 từ / emoji — "laugh", "lol" rơi mất khỏi 😂 (tab Emoji tìm "laugh" không ra 😂)
  [["laugh", "lol", "lmao"], ["😂", "🤣", "😆"]],
  [["khóc", "buồn"], ["😭", "🥺", "🥲"]],
  [["giận", "tức"], ["😡", "😤"]],
  [["ok", "được", "đồng ý"], ["👍", "👌", flId("Check mark button")]],
  [["tiền", "lương", "tip", "boa"], ["💸", flId("Money bag"), flId("Dollar banknote")]],
  [["lịch", "hẹn", "đặt lịch", "booking"], [flId("Spiral calendar"), flId("Calendar"), flId("Alarm clock")]],
  [["cà phê", "trà sữa"], ["☕", "🧋"]],
  [["ngủ", "mệt"], ["😴", "🥱"]],
  [["chào", "xin chào", "hello", "hi"], ["👋"]],
  [["xin lỗi", "sorry"], ["🙏", "🥺"]],
  [["giỏi", "đỉnh", "tuyệt"], ["💯", "🔥", "👏", "🤩"]],
  [["tết", "lì xì", "năm mới"], ["pack:tet", "pack:newyear"]],
  [["noel", "giáng sinh"], ["pack:christmas_us", "pack:christmas_au"]],
  [["tạ ơn"], ["pack:thanksgiving_us"]],
  [["trung thu"], ["pack:midautumn"]],
  [["phụ nữ", "8/3", "20/10"], ["pack:women"]],
  [["mẹ"], ["pack:mothers_day"]],
  [["thú cưng", "pet"], ["😺", "😻", "🐱", "🐕", "🐾", "🐹", "🐰", "🦜"]],
  // CLDR tiếng Việt gọi 🐶 là "mặt cún" — "chó" cũng phải ra (tab Emoji: 🐶 có trên bàn phím; tab Nhãn dán: 🐕 động)
  [["chó", "cún"], ["🐶", "🐕"]],
  [["ăn", "đói", "uống"], ["pack:food"]],
  [["tiệc", "party"], ["pack:party", "pack:celebrate"]],
  [["công việc", "làm việc"], ["pack:work"]],
  [["hoa"], ["💐", "🌹", "🌷", "🌸", flId("Bouquet"), flId("Tulip"), flId("Rose"), flId("Sunflower")]],
];

/** Từ khoá (giữ dấu, chữ thường) → đích. */
export const KEYWORDS_VI: Record<string, ViTarget[]> = (() => {
  const out: Record<string, ViTarget[]> = {};
  for (const [keys, targets] of ENTRIES) for (const k of keys) out[k] = [...(out[k] || []), ...targets];
  return out;
})();
