// Danh sách hoạ tiết dùng chung cho bộ máy (Web Worker) và giao diện — tách riêng cho nhẹ.

/** Hoạ tiết bộ máy TỰ VẼ ngay trên toạ độ móng thật (bám đúng mép móng, nhận ánh sáng) — không cần lớp SVG. */
export const PROCEDURAL = new Set(["solid", "mixmatch", "jelly", "french", "chromefrench", "doublefrench", "ombre", "babyboomer", "aura", "velvet", "tortoise", "marble", "lines", "chromeline", "dots", "pearls", "gems", "gemcluster", "droplets", "chromedrops", "leopard", "checker", "foil", "stars", "hearts", "charm3d", "ghost", "jackolantern", "bats", "moonstars", "snow", "cherry", "floral", "blossom", "web", "plaid", "candy", "swirl", "polka", "stripes", "chocodip", "fawn", "auroracat", "slimedrip", "candycorn", "blackcat", "skull", "eyeball", "stitches", "mummy", "leaf", "waves", "droplet", "negative", "milkbath", "witchy", "lace",
  // nhóm mẫu mới (French biến tấu, nail Hàn trong, chrome màu, nhũ loang, hoạ tiết Noel, hoa gel 3D, bộ phối theo dịp)
  "fr-micro", "fr-deep", "fr-v", "fr-side", "fr-pinkwhite", "fr-halfmoon", "fr-skittle", "fr-glitter", "fr-santa", "fr-candycane", "fr-tortoise", "syrup", "blush", "cleanmilky",
  "colorchrome", "glitterfade", "holly", "ornament", "gelflower", "mix-halloween", "mix-christmas", "mix-valentine", "mix-fall", "mix-newyear"]);
/** Hoạ tiết phủ MỌI móng (còn lại chỉ vẽ trên móng điểm nhấn) — như NailArt. */
export const ALL_NAIL_PATTERNS = new Set(["jelly", "french", "ombre", "aura", "tortoise", "lines", "babyboomer", "chromefrench", "chromeline", "doublefrench", "swirl", "milkbath", "negative", "velvet", "candycorn", "droplets", "chromedrops", "polka", "stripes", "chocodip", "auroracat"]);
