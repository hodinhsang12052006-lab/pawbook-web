import type { Market } from "@prisma/client";

// Lịch chủ đề nail theo mùa — tách riêng (không đụng DB) để giao diện
// (trình duyệt) cũng dùng được. lib/contentEngine.ts dùng lại từ đây.
export interface Theme {
  id: string;
  title: string;
  emoji: string;
  hashtag: string; // không kèm "#"
  blurb: string;
  ideas: string[];
  ownerTip: string;
  colors: [string, string];
  from: [number, number]; // [tháng, ngày] — có thể vắt qua năm mới
  to: [number, number];
  priority: number; // sự kiện cụ thể > mùa chung
  markets?: Market[];
}

export const THEMES: Theme[] = [
  {
    id: "halloween", title: "Mùa Halloween", emoji: "🎃", hashtag: "PawNailHalloween", priority: 3,
    blurb: "Tháng khách thích móng \"chơi\" nhất năm — đen nhám, cam bí ngô, mắt mèo, nhện mạng.",
    ideas: ["Đen nhám + mạng nhện bạc", "Cam bí ngô ombre", "Mắt mèo xanh rêu", "Ma trắng 3D mini"],
    ownerTip: "Làm \"Spooky set\" cố định 3 mẫu, giá trọn gói — khách chọn nhanh, thợ làm nhanh, tăng vòng khách cuối tuần.",
    colors: ["#f97316", "#7c3aed"], from: [10, 1], to: [10, 31],
  },
  {
    id: "fall", title: "Móng mùa thu", emoji: "🍂", hashtag: "MongMuaThu", priority: 1,
    blurb: "Burgundy, nâu caramel, đồi mồi (tortoise) và nhũ vàng đồng đang lên ngôi.",
    ideas: ["Burgundy bóng gương", "Đồi mồi tortoise", "Nâu caramel + viền vàng", "Ombre cam cháy"],
    ownerTip: "Đổi bảng màu trưng bày sang tông ấm — khách nhìn thấy màu mới là muốn đổi màu.",
    colors: ["#b45309", "#7f1d1d"], from: [9, 15], to: [11, 30],
  },
  {
    id: "thanksgiving", title: "Lễ Tạ Ơn & Black Friday", emoji: "🦃", hashtag: "PawNailThanks", priority: 3, markets: ["US"],
    blurb: "Tuần đông khách nhất trước mùa lễ — khách đặt lịch sớm cho tiệc gia đình.",
    ideas: ["Nâu kem + lá phong", "French viền vàng đồng", "Nhũ champagne"],
    ownerTip: "Bán gift card Black Friday (mua $100 tặng $15) — có tiền trước, khách quay lại sau lễ.",
    colors: ["#c2410c", "#a16207"], from: [11, 15], to: [11, 30],
  },
  {
    id: "christmas", title: "Giáng Sinh", emoji: "🎄", hashtag: "PawNailNoel", priority: 3,
    blurb: "Đỏ nhung, xanh thông, nhũ vàng và bông tuyết — mùa cao điểm tip của năm.",
    ideas: ["Đỏ nhung velvet", "Bông tuyết trắng trên nền xanh", "Nhũ vàng full", "Kẹo gậy sọc đỏ"],
    ownerTip: "Mở thêm giờ tối thứ 6–7 trong 2 tuần trước Noel; nhắc khách đặt lịch sớm qua tin nhắn.",
    colors: ["#dc2626", "#15803d"], from: [12, 1], to: [12, 25],
  },
  {
    id: "newyear", title: "Năm Mới", emoji: "✨", hashtag: "NamMoiMongMoi", priority: 3,
    blurb: "Chrome bạc, nhũ lấp lánh và đá nhỏ — móng \"đi tiệc\" đếm ngược.",
    ideas: ["Chrome bạc gương", "Nhũ khói (smoky glitter)", "Đen + đá nhỏ"],
    ownerTip: "Đăng ảnh mẫu đếm ngược mỗi ngày trên bảng tin — khách lưu ảnh mang tới tiệm.",
    colors: ["#64748b", "#a855f7"], from: [12, 26], to: [1, 11],
  },
  {
    id: "tet", title: "Tết Nguyên Đán", emoji: "🧧", hashtag: "TetRucRo", priority: 3,
    blurb: "Đỏ may mắn, vàng sang, hoa mai — hoa đào: khách Việt và khách Á Đông rất chuộng.",
    ideas: ["Đỏ son + nhũ vàng", "Hoa mai vẽ tay", "Hoa đào hồng phấn", "Bao lì xì mini"],
    ownerTip: "Lì xì nhỏ (voucher $5) cho khách quen dịp Tết — rẻ mà khách nhớ tiệm cả năm.",
    colors: ["#dc2626", "#eab308"], from: [1, 12], to: [2, 20],
  },
  {
    id: "valentine", title: "Valentine", emoji: "💘", hashtag: "PawNailValentine", priority: 4, // trùng Tết vài ngày → Valentine ngắn, ưu tiên
    blurb: "Hồng, đỏ, trái tim và french màu — tuần đặt lịch cặp đôi & bạn thân.",
    ideas: ["French hồng + tim nhỏ", "Đỏ cherry bóng", "Tráng gương hồng (glazed)"],
    ownerTip: "Gói \"Bestie set\" 2 người giảm 10% — khách tự rủ thêm khách mới.",
    colors: ["#e11d48", "#f472b6"], from: [2, 1], to: [2, 14],
  },
  {
    id: "spring", title: "Pastel mùa xuân", emoji: "🌸", hashtag: "PastelXuan", priority: 1,
    blurb: "Pastel sữa, hoa nhí, french màu — nhẹ nhàng, dễ bán cho khách văn phòng.",
    ideas: ["Pastel 5 ngón 5 màu", "Hoa cúc nhí", "French xanh mint"],
    ownerTip: "Đặt mẫu pastel ngay quầy lễ tân — mẫu dễ, thợ mới cũng làm đẹp, tăng công suất.",
    colors: ["#f9a8d4", "#a5b4fc"], from: [2, 21], to: [4, 30],
  },
  {
    id: "prom", title: "Mùa Prom", emoji: "💃", hashtag: "PawNailProm", priority: 2, markets: ["US"],
    blurb: "Học sinh cuối cấp đi prom — móng dài, đá, phối màu theo váy.",
    ideas: ["Coffin dài + đá", "Phối màu theo váy", "Chrome hologram"],
    ownerTip: "Nhận đặt lịch nhóm (3–5 bạn) giờ chiều sau giờ học — lấp giờ vắng.",
    colors: ["#c026d3", "#0ea5e9"], from: [4, 1], to: [5, 31],
  },
  {
    id: "mothersday", title: "Ngày của Mẹ", emoji: "💐", hashtag: "MongTangMe", priority: 3,
    blurb: "Tuần gift card bán chạy nhất năm — con cái mua tặng mẹ.",
    ideas: ["Nude sang + hoa nhỏ", "French cổ điển", "Hồng đất thanh lịch"],
    ownerTip: "Gift card in đẹp để sẵn ở quầy + nhắc trên bảng tin: khách mua tặng là khách mới cho tiệm.",
    colors: ["#db2777", "#f59e0b"], from: [4, 25], to: [5, 12],
  },
  {
    id: "wedding", title: "Mùa cưới", emoji: "👰", hashtag: "MongCoDau", priority: 2,
    blurb: "Cô dâu, phù dâu và khách dự tiệc — đặt lịch trước, làm theo nhóm.",
    ideas: ["French ngọc trai", "Trắng sữa + đá", "Nude bóng gương"],
    ownerTip: "Gói \"Bridal party\" trọn nhóm, đặt cọc trước — doanh thu chắc, ít huỷ lịch.",
    colors: ["#e2e8f0", "#f9a8d4"], from: [5, 1], to: [9, 30],
  },
  {
    id: "summer", title: "Móng mùa hè", emoji: "🌴", hashtag: "MongMuaHe", priority: 1,
    blurb: "Neon, trái cây, sóng biển — khách đi du lịch làm móng chân nhiều gấp đôi.",
    ideas: ["Neon cam chanh", "Trái cây vẽ tay", "Sóng biển xanh ngọc", "Pedicure màu kẹo"],
    ownerTip: "Combo tay + chân mùa hè — khách đi biển gần như luôn làm cả chân.",
    colors: ["#06b6d4", "#facc15"], from: [6, 1], to: [8, 31],
  },
  {
    id: "backtoschool", title: "Tựu trường", emoji: "🎒", hashtag: "MongTuuTruong", priority: 2,
    blurb: "Móng ngắn gọn gàng, màu trơn bền — học sinh, sinh viên & phụ huynh.",
    ideas: ["Ngắn tròn màu trơn", "Kẻ caro nhỏ", "Nude bền màu"],
    ownerTip: "Ưu đãi sinh viên giờ vắng (thứ 2–4) — lấp lịch trống, tạo khách quen dài hạn.",
    colors: ["#2563eb", "#f43f5e"], from: [8, 10], to: [9, 10],
  },
];
