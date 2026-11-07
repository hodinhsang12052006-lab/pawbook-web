// Từ khoá tìm sticker tiếng Việt (viết tay). So khớp KHÔNG DẤU (foldVi): "cam on" = "cảm ơn" = "cám ơn".
// Giá trị: id sticker, hoặc "pack:<id bộ>" = cả bộ (kể cả bộ theo mùa đang ngoài mùa).
import { flId, type StickerId } from "./packs";

export type ViTarget = StickerId | `pack:${string}`;

const ENTRIES: [keys: string[], targets: ViTarget[]][] = [
  [["cảm ơn", "cám ơn", "thank", "thanks"], ["pack:thanks", "🙏"]],
  [["yêu", "thương", "tim", "love"], ["pack:hearts", "pack:love"]],
  [["móng", "nail", "sơn", "sơn gel", "làm móng"], ["💅", flId("Nail polish"), "pack:beauty"]],
  [["đẹp", "làm đẹp", "son", "môi"], ["pack:beauty"]],
  [["chúc mừng", "mừng", "congrats"], ["pack:celebrate", "pack:party"]],
  [["sinh nhật"], ["🎂", flId("Birthday cake"), flId("Cupcake")]],
  [["cười", "haha", "hihi"], ["😂", "🤣"]],
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
  [["thú cưng", "mèo", "chó"], ["pack:animals"]],
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
