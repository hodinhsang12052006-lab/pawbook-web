// Danh sách hoạ tiết dùng chung cho bộ máy (Web Worker) và giao diện — tách riêng cho nhẹ.

/** Hoạ tiết bộ máy TỰ VẼ ngay trên toạ độ móng thật (bám đúng mép móng, nhận ánh sáng) — không cần lớp SVG. */
export const PROCEDURAL = new Set(["solid", "mixmatch", "jelly", "french", "chromefrench", "doublefrench", "ombre", "babyboomer", "aura", "velvet", "tortoise", "marble", "lines", "chromeline", "dots", "pearls", "gems", "gemcluster", "droplets", "chromedrops", "leopard", "checker", "foil", "stars", "hearts", "charm3d", "ghost", "jackolantern", "bats", "moonstars", "snow", "cherry", "floral", "blossom", "web", "plaid", "candy", "swirl", "polka", "stripes", "chocodip", "fawn", "auroracat", "slimedrip", "candycorn", "blackcat", "skull", "eyeball", "stitches", "mummy", "leaf", "waves", "droplet", "negative", "milkbath", "witchy", "lace"]);
/** Hoạ tiết phủ MỌI móng (kỹ thuật cả bộ: French, ombre, thạch, chrome màu, nhũ loang…). Còn lại lib/tryon/sets chia vai
 *  hero / echo / thread / quiet — hoạ tiết in lặp (chấm bi, sọc, đồi mồi, line…) và giọt 3D chỉ ≤ 2 móng không kề nhau
 *  (kín 4 móng nhìn như giấy dán tường); chấm bi + mắt mèo vẫn đủ 4 móng (sets tự giữ). */
export const ALL_NAIL_PATTERNS = new Set(["jelly", "french", "ombre", "aura", "babyboomer", "chromefrench", "doublefrench", "swirl", "milkbath", "negative", "velvet", "candycorn", "chocodip", "auroracat",
  "fr-micro", "fr-deep", "fr-v", "fr-side", "fr-pinkwhite", "fr-halfmoon", "fr-skittle", "fr-glitter", "fr-santa", "fr-candycane", "fr-tortoise", "syrup", "blush", "cleanmilky", "colorchrome", "glitterfade"]);
