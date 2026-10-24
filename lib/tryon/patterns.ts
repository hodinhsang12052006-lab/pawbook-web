// Danh sách hoạ tiết dùng chung cho bộ máy (Web Worker) và giao diện — tách riêng cho nhẹ.

/** Hoạ tiết bộ máy TỰ VẼ ngay trên toạ độ móng thật (bám đúng mép móng, nhận ánh sáng) — không cần lớp SVG. */
export const PROCEDURAL = new Set(["solid", "mixmatch", "jelly", "french", "chromefrench", "doublefrench", "ombre", "babyboomer", "aura", "velvet", "tortoise", "marble", "lines", "chromeline", "dots", "pearls", "gems", "gemcluster"]);
/** Hoạ tiết phủ MỌI móng (còn lại chỉ vẽ trên móng điểm nhấn) — như NailArt. */
export const ALL_NAIL_PATTERNS = new Set(["french", "ombre", "aura", "tortoise", "lines", "babyboomer", "chromefrench", "chromeline", "doublefrench", "swirl", "milkbath", "negative", "velvet", "candycorn"]);
