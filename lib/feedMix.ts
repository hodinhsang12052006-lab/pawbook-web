// Trộn bảng tin cho dễ đọc, chuyên nghiệp (áp trong TỪNG trang của bảng tin — không làm lệch phân trang):
//  • Bài chính thức CÙNG LOẠI (dòng đầu giống nhau, VD 2 bài "💅 Mẫu hôm nay" cách nhau vài giờ) → giữ bài mới nhất.
//  • Bài chính thức rải đều: tối đa 1 bài sau mỗi 3 bài của người thật, không bao giờ 2 bài liền nhau.
// Bài người thật giữ nguyên thứ tự mới → cũ.

// Loại bài chính thức = emoji mở đầu (máy đăng bài dùng cố định: ✨ bộ mẫu hôm nay · 📍 việc làm tuần này ·
// 💬 chủ đề nóng · 📰 tin ngành); bài mẹo mỗi bài 1 emoji riêng nên không bị gộp nhầm.
// Không có emoji → dùng dòng đầu.
export const kindOf = (content: string) => {
  const first = content.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const emoji = first.match(/^\p{Extended_Pictographic}️?/u)?.[0];
  return emoji ?? first.replace(/\d+/g, "#").slice(0, 40).toLowerCase();
};

export function mixFeed<T extends { content: string; author: { role: string } }>(posts: T[], seenKinds = new Set<string>()): T[] {
  const official: T[] = [];
  const people: T[] = [];
  for (const p of posts) {
    if (p.author.role === "ADMIN") {
      const k = kindOf(p.content);
      if (k && seenKinds.has(k)) continue; // cùng loại với bài chính thức mới hơn → bỏ
      if (k) seenKinds.add(k);
      official.push(p);
    } else people.push(p);
  }
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
  // Trang toàn bài chính thức (ít bài người thật) → vẫn hiện, nhưng đã bỏ bài trùng loại.
  while (i < official.length) out.push(official[i++]);
  return out;
}
