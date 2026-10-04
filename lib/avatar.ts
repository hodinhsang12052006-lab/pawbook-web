// Avatar mặc định dùng chung toàn app. Trước đây mỗi nơi tự chế một kiểu:
// emoji hoạt hình (dicebear), chữ cái nền hồng (ui-avatars), thậm chí ảnh
// stock một người phụ nữ lạ cho người chưa có ảnh → trông thiếu chuyên nghiệp
// và gây hiểu nhầm. Giờ ai chưa tải ảnh thật đều hiện chữ cái đầu trên nền
// gradient cố định theo tên (vẽ tại chỗ, không gọi dịch vụ ngoài).

const PLACEHOLDER_PATTERNS = [
  "dicebear.com",
  "ui-avatars.com",
  "photo-1487412947147-5cebf100ffc2", // ảnh stock fallback cũ ở Navbar/Sidebar
  "/cho1.jpg",
];

/** true khi URL rỗng hoặc chỉ là ảnh giữ chỗ — không phải ảnh người dùng tự tải. */
export function isPlaceholderAvatar(url?: string | null): boolean {
  if (!url) return true;
  return PLACEHOLDER_PATTERNS.some((p) => url.includes(p));
}

/** "Nguyễn Thị Lan" → "NL", "Diana Phan" → "DP", "lan" → "L". */
export function initialsOf(name?: string | null): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] || "";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] || "" : "";
  return (first + last).toUpperCase();
}

// Bảng màu trầm, sang — đủ tương phản với chữ trắng, hợp nền tối của app.
const GRADIENTS: [string, string][] = [
  ["#db2777", "#7c3aed"], // hồng → tím (màu thương hiệu)
  ["#2563eb", "#7c3aed"], // xanh dương → tím
  ["#0891b2", "#2563eb"], // xanh ngọc → xanh dương
  ["#059669", "#0d9488"], // lục bảo
  ["#d97706", "#db2777"], // hổ phách → hồng
  ["#7c3aed", "#c026d3"], // tím → tím hồng
  ["#e11d48", "#f97316"], // đỏ hồng → cam
  ["#4f46e5", "#0ea5e9"], // chàm → xanh trời
];

/**
 * Cho những chỗ buộc phải dùng <img src> (ví dụ danh sách chat): ảnh thật thì
 * trả nguyên URL, còn không thì trả SVG chữ cái đầu dạng data URI — cùng kiểu
 * với component <Avatar>.
 */
export function avatarSrc(url: string | null | undefined, name?: string | null, seed?: string | null): string {
  if (!isPlaceholderAvatar(url)) return url!;
  const [from, to] = avatarGradient(seed || name);
  const text = initialsOf(name).replace(/[<>&"']/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="40" height="40" fill="url(#g)"/>` +
    `<ellipse cx="20" cy="6" rx="18" ry="10" fill="#fff" opacity="0.08"/>` +
    `<text x="20" y="20" dy="0.35em" text-anchor="middle" fill="#fff" font-size="${text.length > 1 ? 15 : 17}" font-weight="700" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Màu cố định theo chuỗi (id hoặc tên) — cùng người luôn cùng màu ở mọi nơi. */
export function avatarGradient(seed?: string | null): [string, string] {
  let h = 0;
  for (const ch of seed || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}
