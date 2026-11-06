// Chính tả tiếng Anh theo thị trường cho chữ KHÁCH đọc: Mỹ "color, center, favorite", Úc "colour, centre,
// favourite". Viết chữ gốc theo 1 kiểu nào cũng được — hàm đổi về đúng kiểu của người xem. THUẦN.

const PAIRS: [us: string, au: string][] = [
  ["color", "colour"],
  ["discolor", "discolour"],
  ["favorite", "favourite"],
  ["flavor", "flavour"],
  ["centered", "centred"],
  ["center", "centre"],
  ["sterilize", "sterilise"],
  ["sterilized", "sterilised"],
  ["personalize", "personalise"],
  ["personalized", "personalised"],
  ["organize", "organise"],
  ["jewelry", "jewellery"],
  ["gray", "grey"],
];

function swap(text: string, from: string, to: string): string {
  // khớp đầu từ (giữ phần đuôi: colors, colorful, favorites, centered…), giữ chữ hoa đầu
  return text.replace(new RegExp(`\\b(${from[0]}|${from[0].toUpperCase()})${from.slice(1)}`, "g"), (_, first: string) => (first === first.toUpperCase() ? to[0].toUpperCase() : to[0]) + to.slice(1));
}

/** Đổi chính tả của `text` (tiếng Anh) theo thị trường: "AU" → kiểu Úc/Anh, còn lại → kiểu Mỹ. */
export function marketSpelling(text: string, market?: string | null): string {
  if (!text) return text;
  let out = text;
  for (const [us, au] of PAIRS) out = market === "AU" ? swap(out, us, au) : swap(out, au, us);
  return out;
}
