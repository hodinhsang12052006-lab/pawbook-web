// Bộ MẪU GỢI Ý soạn sẵn (không dùng AI) — dùng khi chưa có Gemini, hoặc để
// thử luồng duyệt. Nội dung thật, theo dịp lễ trong lịch Studio; minh hoạ do
// app tự vẽ từ bảng màu + dáng móng + hiệu ứng (components/designs/NailArt).
import type { Bi } from "@/lib/aiDesigns";

export interface SampleDesign {
  occasion: string | null;
  title: Bi;
  description: Bi;
  skills: string[];
  difficulty: 1 | 2 | 3;
  minutes: number;
  priceHint: string;
  palette: string[];
  shape: "almond" | "coffin" | "square" | "oval" | "stiletto";
  finish: "glossy" | "matte" | "chrome" | "cateye" | "glitter";
  materials: (Bi & { qty: string })[];
  steps: Bi[];
}

const BASE_TOP = { vi: "Base & top coat gel", en: "Gel base & top coat", qty: "1 bộ" };

export const SAMPLE_DESIGNS: SampleDesign[] = [
  {
    occasion: "halloween",
    title: { vi: "Đen nhám mạng nhện bạc", en: "Matte black silver web" },
    description: { vi: "Nền đen nhám, mạng nhện bạc vẽ tay trên 2 ngón — mẫu Halloween được hỏi nhiều nhất, sang mà không “lố”.", en: "Matte black base with hand-drawn silver webs on two accent nails — the most-requested Halloween look, chic not costume-y." },
    skills: ["Gel-X", "Design"], difficulty: 2, minutes: 60, priceHint: "$50–65",
    palette: ["#111111", "#1f1f1f", "#c0c0c0"], shape: "almond", finish: "matte",
    materials: [BASE_TOP, { vi: "Gel đen tuyền", en: "Jet black gel", qty: "1 lọ" }, { vi: "Gel vẽ nét bạc", en: "Silver liner gel", qty: "1 lọ" }, { vi: "Top nhám (matte top)", en: "Matte top coat", qty: "1 lọ" }, { vi: "Cọ nét mảnh 7mm", en: "7mm liner brush", qty: "1 cây" }],
    steps: [{ vi: "Dũa form almond, sơn base", en: "Shape almond, apply base" }, { vi: "Sơn 2 lớp gel đen, hơ đèn mỗi lớp", en: "Two coats of black gel, cure each" }, { vi: "Vẽ mạng nhện bạc trên ngón áp út", en: "Draw silver webs on the ring fingers" }, { vi: "Phủ top nhám, chừa nét bạc bóng", en: "Matte top, keep the silver lines glossy" }],
  },
  {
    occasion: "halloween",
    title: { vi: "Mắt mèo cam bí ngô", en: "Pumpkin cat eye" },
    description: { vi: "Gel mắt mèo cam cháy hút nam châm thành dải sáng — làm nhanh, khách chọn nhiều tuần cuối tháng 10.", en: "Burnt-orange cat-eye gel pulled into a bright magnetic band — quick to do, a late-October favorite." },
    skills: ["Gel-X"], difficulty: 1, minutes: 45, priceHint: "$45–55",
    palette: ["#c2410c", "#f97316", "#fdba74"], shape: "oval", finish: "cateye",
    materials: [BASE_TOP, { vi: "Gel mắt mèo cam", en: "Orange cat-eye gel", qty: "1 lọ" }, { vi: "Nam châm mắt mèo", en: "Cat-eye magnet", qty: "1 cái" }, { vi: "Gel đen lót (tuỳ chọn)", en: "Black base gel (optional)", qty: "1 lọ" }],
    steps: [{ vi: "Sơn base, 1 lớp đen lót cho màu sâu", en: "Base, one black layer for depth" }, { vi: "Sơn gel mắt mèo, hút nam châm 5 giây", en: "Cat-eye gel, hold the magnet 5 seconds" }, { vi: "Hơ đèn ngay khi dải sáng đẹp", en: "Cure as soon as the band looks right" }, { vi: "Lớp 2 + top bóng", en: "Second coat + glossy top" }],
  },
  {
    occasion: "fall",
    title: { vi: "Đồi mồi caramel viền vàng", en: "Caramel tortoiseshell with gold" },
    description: { vi: "Đồi mồi nâu caramel chấm loang, viền vàng đồng mảnh — mẫu mùa thu bán chạy cho khách văn phòng.", en: "Caramel tortoiseshell with fine bronze outlines — a fall best-seller with office clients." },
    skills: ["Gel-X", "Design"], difficulty: 2, minutes: 70, priceHint: "$55–70",
    palette: ["#78350f", "#b45309", "#fbbf24"], shape: "almond", finish: "glossy",
    materials: [BASE_TOP, { vi: "Gel nâu caramel trong (jelly)", en: "Caramel jelly gel", qty: "1 lọ" }, { vi: "Gel nâu đậm", en: "Dark brown gel", qty: "1 lọ" }, { vi: "Gel nhũ vàng đồng", en: "Bronze glitter gel", qty: "1 lọ" }, { vi: "Cọ chấm", en: "Dotting tool", qty: "1 cây" }],
    steps: [{ vi: "Lớp jelly caramel mỏng", en: "Thin caramel jelly layer" }, { vi: "Chấm loang nâu đậm, chưa hơ đèn để màu tự tan", en: "Dot dark brown, let it bleed before curing" }, { vi: "Thêm lớp jelly phủ, hơ đèn", en: "Another jelly coat, cure" }, { vi: "Vẽ viền vàng đồng, phủ top", en: "Bronze outline, top coat" }],
  },
  {
    occasion: "thanksgiving",
    title: { vi: "French nâu kem lá phong", en: "Cream brown maple French" },
    description: { vi: "French nâu kem nhẹ nhàng, 1 chiếc lá phong nhỏ trên ngón áp út — hợp đi tiệc gia đình Lễ Tạ Ơn.", en: "Soft cream-brown French with a tiny maple leaf on the ring finger — perfect for Thanksgiving dinner." },
    skills: ["Dip/SNS", "Design"], difficulty: 1, minutes: 50, priceHint: "$45–55",
    palette: ["#f5e6d3", "#92400e", "#c2410c"], shape: "square", finish: "glossy",
    materials: [{ vi: "Bột dip nude kem", en: "Cream nude dip powder", qty: "1 hũ" }, { vi: "Bột dip nâu", en: "Brown dip powder", qty: "1 hũ" }, { vi: "Bộ dung dịch dip (base, activator, top)", en: "Dip liquid set (base, activator, top)", qty: "1 bộ" }, { vi: "Sticker lá phong", en: "Maple leaf decals", qty: "1 tấm" }],
    steps: [{ vi: "Nhúng nền nude kem 2 lớp", en: "Two coats of cream nude dip" }, { vi: "Tạo đầu French nâu", en: "Dip brown French tips" }, { vi: "Activator, dũa mịn", en: "Activator, buff smooth" }, { vi: "Dán lá phong, phủ top", en: "Place maple decal, top coat" }],
  },
  {
    occasion: "christmas",
    title: { vi: "Đỏ nhung velvet nhũ vàng", en: "Velvet red with gold" },
    description: { vi: "Đỏ nhung hiệu ứng velvet, 2 ngón nhũ vàng full — mùa Noel tip cao nhất năm, khách chọn mẫu đỏ nhiều nhất.", en: "Velvet-effect red with two full-gold glitter accents — the biggest tip season, and red is the top pick." },
    skills: ["Gel-X"], difficulty: 1, minutes: 50, priceHint: "$50–60",
    palette: ["#7f1d1d", "#b91c1c", "#facc15"], shape: "coffin", finish: "cateye",
    materials: [BASE_TOP, { vi: "Gel velvet đỏ (mắt mèo đỏ)", en: "Red velvet (cat-eye) gel", qty: "1 lọ" }, { vi: "Gel nhũ vàng", en: "Gold glitter gel", qty: "1 lọ" }, { vi: "Nam châm tròn", en: "Round magnet", qty: "1 cái" }],
    steps: [{ vi: "Form coffin vừa, sơn base", en: "Medium coffin, base" }, { vi: "Gel velvet đỏ, xoay nam châm cho mịn", en: "Red velvet gel, sweep the magnet for a soft glow" }, { vi: "Nhũ vàng full 2 ngón", en: "Full gold glitter on two accents" }, { vi: "Top bóng", en: "Glossy top" }],
  },
  {
    occasion: "newyear",
    title: { vi: "Chrome bạc gương đếm ngược", en: "Countdown mirror chrome" },
    description: { vi: "Chrome bạc tráng gương toàn bộ móng — sáng lấp lánh dưới đèn tiệc, mẫu “đi tiệc” cuối năm.", en: "Full mirror silver chrome — catches every party light, the go-to New Year's Eve set." },
    skills: ["Gel-X"], difficulty: 2, minutes: 55, priceHint: "$55–70",
    palette: ["#9ca3af", "#e5e7eb", "#f8fafc"], shape: "stiletto", finish: "chrome",
    materials: [BASE_TOP, { vi: "Gel đen hoặc xám lót", en: "Black or grey base gel", qty: "1 lọ" }, { vi: "Bột tráng gương bạc", en: "Silver mirror powder", qty: "1 hũ" }, { vi: "No-wipe top", en: "No-wipe top coat", qty: "1 lọ" }, { vi: "Mút tán bột", en: "Powder applicator", qty: "5 cái" }],
    steps: [{ vi: "Lót màu xám, hơ đèn", en: "Grey base color, cure" }, { vi: "No-wipe top, hơ đèn 30 giây", en: "No-wipe top, cure 30 seconds" }, { vi: "Chà bột gương đến khi sáng gương", en: "Burnish mirror powder until reflective" }, { vi: "Bọc mép, 2 lớp top", en: "Cap the edge, two top coats" }],
  },
  {
    occasion: "tet",
    title: { vi: "Đỏ son hoa mai vẽ tay", en: "Lacquer red with apricot blossoms" },
    description: { vi: "Đỏ son may mắn, hoa mai vàng vẽ tay trên ngón áp út — khách Việt rất chuộng dịp Tết.", en: "Lucky lacquer red with hand-painted yellow apricot blossoms — a Lunar New Year favorite." },
    skills: ["Design"], difficulty: 3, minutes: 80, priceHint: "$60–80",
    palette: ["#b91c1c", "#facc15", "#78350f"], shape: "almond", finish: "glossy",
    materials: [BASE_TOP, { vi: "Gel đỏ son", en: "Lacquer red gel", qty: "1 lọ" }, { vi: "Gel vẽ vàng", en: "Yellow art gel", qty: "1 lọ" }, { vi: "Gel vẽ nâu (cành)", en: "Brown art gel (branches)", qty: "1 lọ" }, { vi: "Cọ vẽ bản 4mm", en: "4mm flat art brush", qty: "1 cây" }],
    steps: [{ vi: "Sơn đỏ son 2 lớp", en: "Two coats of lacquer red" }, { vi: "Vẽ cành nâu mảnh", en: "Paint thin brown branches" }, { vi: "Chấm cánh hoa mai 5 cánh", en: "Dot five-petal blossoms" }, { vi: "Nhụy vàng đậm, phủ top", en: "Deep-yellow centers, top coat" }],
  },
  {
    occasion: "valentine",
    title: { vi: "French hồng tim nhỏ", en: "Pink French with tiny hearts" },
    description: { vi: "French hồng ngọt, tim đỏ nhỏ xíu chấm ngẫu nhiên — mẫu cặp đôi & bạn thân đặt nhiều tuần Valentine.", en: "Sweet pink French with tiny scattered red hearts — booked by couples and besties all Valentine's week." },
    skills: ["Gel-X", "Design"], difficulty: 1, minutes: 45, priceHint: "$45–55",
    palette: ["#fce7f3", "#f472b6", "#e11d48"], shape: "almond", finish: "glossy",
    materials: [BASE_TOP, { vi: "Gel nude hồng sữa", en: "Milky pink nude gel", qty: "1 lọ" }, { vi: "Gel hồng đậm (đầu French)", en: "Hot pink gel (French tips)", qty: "1 lọ" }, { vi: "Gel đỏ vẽ tim", en: "Red gel for hearts", qty: "1 lọ" }, { vi: "Cọ chấm nhỏ", en: "Small dotting tool", qty: "1 cây" }],
    steps: [{ vi: "Nền hồng sữa", en: "Milky pink base" }, { vi: "Đầu French hồng đậm mảnh", en: "Thin hot-pink French tips" }, { vi: "Chấm 2 giọt tạo tim nhỏ", en: "Two dots dragged into tiny hearts" }, { vi: "Top bóng", en: "Glossy top" }],
  },
  {
    occasion: "spring",
    title: { vi: "Pastel 5 ngón 5 màu", en: "Five-color pastel set" },
    description: { vi: "Mỗi ngón 1 màu pastel sữa — dễ làm, thợ mới cũng đẹp, tăng công suất mùa xuân.", en: "A different milky pastel on each nail — easy enough for new techs, great for spring volume." },
    skills: ["Dip/SNS"], difficulty: 1, minutes: 40, priceHint: "$40–50",
    palette: ["#fbcfe8", "#ddd6fe", "#bfdbfe", "#bbf7d0", "#fef08a"], shape: "oval", finish: "glossy",
    materials: [{ vi: "Bột dip pastel (5 màu)", en: "Pastel dip powders (5 colors)", qty: "5 hũ" }, { vi: "Bộ dung dịch dip", en: "Dip liquid set", qty: "1 bộ" }, { vi: "Dũa 180/240", en: "180/240 file", qty: "1 cây" }],
    steps: [{ vi: "Base dip từng ngón", en: "Dip base nail by nail" }, { vi: "Nhúng 2 lớp, mỗi ngón 1 màu", en: "Two dips, one color per nail" }, { vi: "Activator, dũa form oval", en: "Activator, file oval" }, { vi: "2 lớp top", en: "Two top coats" }],
  },
  {
    occasion: "wedding",
    title: { vi: "French ngọc trai cô dâu", en: "Bridal pearl French" },
    description: { vi: "French trắng sữa ánh ngọc trai, 1 hạt ngọc nhỏ ở chân móng — gói Bridal party bán theo nhóm.", en: "Milky white pearl-sheen French with one tiny pearl at the cuticle — sold as a bridal-party package." },
    skills: ["Gel-X", "Design"], difficulty: 2, minutes: 70, priceHint: "$60–80",
    palette: ["#fdf2f8", "#f5f5f4", "#e7e5e4"], shape: "almond", finish: "chrome",
    materials: [BASE_TOP, { vi: "Gel trắng sữa", en: "Milky white gel", qty: "1 lọ" }, { vi: "Bột tráng ngọc trai", en: "Pearl chrome powder", qty: "1 hũ" }, { vi: "Hạt ngọc trai 2mm", en: "2mm pearl beads", qty: "10 hạt" }, { vi: "Keo gắn đá", en: "Gem glue gel", qty: "1 lọ" }],
    steps: [{ vi: "Nền trắng sữa trong", en: "Sheer milky white base" }, { vi: "Tráng bột ngọc trai nhẹ", en: "Light pearl chrome rub" }, { vi: "Gắn hạt ngọc ở chân móng", en: "Set a pearl near the cuticle" }, { vi: "Bọc top quanh hạt", en: "Top coat around the pearl" }],
  },
  {
    occasion: "summer",
    title: { vi: "Sóng biển xanh ngọc", en: "Turquoise waves" },
    description: { vi: "Sóng biển vẽ tay xanh ngọc viền trắng — khách đi biển làm cả tay lẫn chân.", en: "Hand-painted turquoise waves with white crests — beachgoers do hands and feet." },
    skills: ["Design", "Chân tay nước"], difficulty: 3, minutes: 75, priceHint: "$55–75",
    palette: ["#0e7490", "#22d3ee", "#f0fdfa"], shape: "square", finish: "glossy",
    materials: [BASE_TOP, { vi: "Gel xanh ngọc", en: "Turquoise gel", qty: "1 lọ" }, { vi: "Gel xanh đậm", en: "Deep teal gel", qty: "1 lọ" }, { vi: "Gel trắng vẽ", en: "White art gel", qty: "1 lọ" }, { vi: "Cọ vẽ bản dẹt", en: "Flat art brush", qty: "1 cây" }],
    steps: [{ vi: "Ombre xanh đậm → xanh ngọc", en: "Deep teal to turquoise ombre" }, { vi: "Vẽ đường sóng trắng", en: "Paint white wave crests" }, { vi: "Thêm bọt sóng bằng cọ chấm", en: "Add foam with a dotting tool" }, { vi: "Top bóng", en: "Glossy top" }],
  },
  {
    occasion: null,
    title: { vi: "Nude bóng gương tối giản", en: "Minimal glossy nude" },
    description: { vi: "Nude hồng đất bóng gương, móng ngắn gọn — mẫu “quanh năm” cho khách công sở, giữ màu 3 tuần.", en: "Glossy dusty-rose nude on short nails — a year-round office favorite that lasts three weeks." },
    skills: ["Dip/SNS"], difficulty: 1, minutes: 40, priceHint: "$40–50",
    palette: ["#e7c4b5", "#d6a99a", "#f5e1d8"], shape: "square", finish: "glossy",
    materials: [{ vi: "Bột dip nude hồng đất", en: "Dusty-rose nude dip powder", qty: "1 hũ" }, { vi: "Bộ dung dịch dip", en: "Dip liquid set", qty: "1 bộ" }, { vi: "Dầu dưỡng viền móng", en: "Cuticle oil", qty: "1 lọ" }],
    steps: [{ vi: "Đẩy da, dũa form vuông bo góc", en: "Push cuticles, file squoval" }, { vi: "Nhúng 2 lớp nude", en: "Two nude dips" }, { vi: "Activator, dũa mịn", en: "Activator, buff" }, { vi: "2 lớp top, dưỡng viền", en: "Two top coats, cuticle oil" }],
  },
];
