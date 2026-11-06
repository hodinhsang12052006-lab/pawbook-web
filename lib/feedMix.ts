// Trộn bảng tin cho dễ đọc, chuyên nghiệp (áp trong TỪNG trang của bảng tin — không làm lệch phân trang):
//  • CHỈ gộp bài máy đăng lặp lại trong cùng 1 ngày (UTC): bộ ảnh "✨ 4 mẫu nail…" và tin việc "📍 …" → giữ bài mới nhất.
//    Bài kiến thức / mẹo / tin ngành / thăm dò KHÔNG bao giờ bị bỏ (06/11/2026: trước đây mọi bài cùng emoji mở đầu
//    trong 1 trang bị bỏ → trang 12 bài chỉ còn 3–4 bài, người mới thấy bảng tin "chết").
//  • Bài chính thức rải đều: tối đa 1 bài sau mỗi 3 bài của người thật, không bao giờ 2 bài liền nhau.
//  • Trang toàn bài chính thức: giữ hết, chỉ đổi chỗ để 2 bài cùng loại không đứng liền nhau.
// Bài người thật giữ nguyên thứ tự mới → cũ.

// Loại bài chính thức = emoji mở đầu (máy đăng bài dùng cố định: ✨ bộ mẫu hôm nay · 📍 việc làm tuần này ·
// 💬 chủ đề nóng · 📰 tin ngành); bài mẹo mỗi bài 1 emoji riêng nên không bị gộp nhầm.
// Không có emoji → dùng dòng đầu.
export const kindOf = (content: string) => {
  const first = content.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const emoji = first.match(/^\p{Extended_Pictographic}️?/u)?.[0];
  return emoji ?? first.replace(/\d+/g, "#").slice(0, 40).toLowerCase();
};

/** Loại bài được gộp (bài lặp lại hằng ngày của máy đăng): bộ ảnh mẫu + tin việc theo bang. */
export const COLLAPSE_KINDS = ["✨", "📍"];

type Mixable = { content: string; author: { role: string }; createdAt?: Date | string };
const utcDay = (d?: Date | string) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Đổi chỗ (giữ gần thứ tự cũ nhất) để không có 2 bài cùng loại đứng liền nhau. */
export function spaceByKind<T extends { content: string }>(posts: T[]): T[] {
  const rest = posts.slice();
  const out: T[] = [];
  while (rest.length) {
    const prev = out.length ? kindOf(out[out.length - 1].content) : null;
    const i = rest.findIndex((p) => kindOf(p.content) !== prev);
    out.push(rest.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out;
}

export function mixFeed<T extends Mixable>(posts: T[], opts: { collapseKinds?: string[]; seen?: Set<string> } = {}): T[] {
  const collapse = new Set(opts.collapseKinds ?? COLLAPSE_KINDS);
  const seen = opts.seen ?? new Set<string>();
  const official: T[] = [];
  const people: T[] = [];
  for (const p of posts) {
    if (p.author.role === "ADMIN") {
      const k = kindOf(p.content);
      if (k && collapse.has(k)) {
        const key = `${k}|${utcDay(p.createdAt)}`;
        if (seen.has(key)) continue; // bài lặp hằng ngày đã có bản mới hơn cùng ngày → bỏ
        seen.add(key);
      }
      official.push(p);
    } else people.push(p);
  }
  if (!people.length) return spaceByKind(official);
  const out: T[] = [];
  let sinceOfficial = 3; // cho phép 1 bài chính thức ở đầu trang
  let i = 0;
  for (const p of people) {
    if (sinceOfficial >= 3 && i < official.length) {
      out.push(official[i++]);
      sinceOfficial = 0;
    }
    out.push(p);
    sinceOfficial++;
  }
  // Còn dư bài chính thức (ít bài người thật) → vẫn hiện ở cuối trang, cách loại.
  return out.concat(spaceByKind(official.slice(i)));
}
