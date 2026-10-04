import prisma from "@/lib/prisma";
import { getTrends } from "@/lib/trends";
import type { Market } from "@prisma/client";

// "PawNail Studio" — bộ máy nội dung tự đổi theo THỜI ĐIỂM:
//   • Chủ đề tuần theo lịch mùa vụ ngành nail (Halloween, Giáng sinh, Tết,
//     Valentine, mùa cưới…) + gợi ý mẫu + mẹo kinh doanh cho chủ tiệm.
//   • Thử thách hashtag tuần — kéo NGƯỜI THẬT đăng bài, xếp hạng bằng lượt
//     thích thật. Đây là cách "bơm content" bền vững: app gợi đề tài, cộng
//     đồng tạo nội dung.
//   • Mẹo mỗi ngày (xoay vòng theo ngày) + tổng kết thị trường tuần từ số liệu thật.
// Mọi nội dung do app tạo đều gắn nhãn "PawNail Studio" — KHÔNG đăng thay hay
// giả làm thành viên nào.

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

const TIPS = {
  TECHNICIAN: [
    "Chụp ảnh móng dưới ánh sáng tự nhiên gần cửa sổ — màu thật, nhìn \"pro\" hơn hẳn đèn vàng.",
    "Đăng ít nhất 3 mẫu portfolio rõ nét — hồ sơ có ảnh được chủ tiệm nhắn nhiều hơn hẳn hồ sơ trống.",
    "Bật trạng thái \"Tìm việc gấp\" khi cần việc — hồ sơ của bạn được ưu tiên hiển thị cho chủ tiệm.",
    "Trước khi nhận việc, hỏi rõ cách chia turn và tip tiền mặt hay qua thẻ — ghi lại bằng tin nhắn.",
    "Không chuyển tiền đặt cọc cho bất kỳ ai để \"giữ chỗ làm\" — tiệm thật không bao giờ yêu cầu.",
    "Ghi turn + tip mỗi tối trong \"Thu nhập & Tip\" — cuối tuần đối chiếu phiếu lương trong 1 phút.",
    "Thêm hashtag kỹ năng (#GelX #Dip #Bot) khi đăng bài — chủ tiệm tìm thợ theo đúng kỹ năng đó.",
    "Trả lời tin nhắn tiệm trong 1 giờ — bạn sẽ nhận huy hiệu \"Phản hồi nhanh\" trên hồ sơ.",
    "Xem Nail Radar trước khi bay sang bang mới — biết mức bao lương để thương lượng tự tin.",
    "Video ngắn 10 giây quay tay đang làm mẫu giữ người xem lâu hơn ảnh tĩnh.",
  ],
  OWNER: [
    "Ghi rõ lương + chia turn ngay trong tin tuyển — tin có số lương cụ thể được thợ liên hệ nhiều hơn.",
    "Bật \"Cần gấp\" khi thiếu thợ — thợ cùng bang được báo ngay lập tức trên điện thoại.",
    "Trả lời thợ trong 1 giờ để có huy hiệu \"Phản hồi nhanh\" — thợ giỏi ưu tiên tiệm trả lời nhanh.",
    "Đăng 3–5 ảnh \"Khoe tiệm\" (không gian, ghế, đèn) — thợ chọn tiệm bằng mắt trước khi gọi.",
    "Điền \"Chính sách tiệm\" (chia turn, loại khách, chỗ ở) — trả lời trước câu hỏi thợ nào cũng hỏi.",
    "So mức lương với Nail Radar của bang trước khi đăng — trả thấp hơn thị trường là tin chìm nghỉm.",
    "Đánh giá thợ sau khi làm việc — hệ thống đánh giá 2 chiều giúp cả cộng đồng tin nhau hơn.",
    "Đăng tin vào sáng thứ 2–3 — đầu tuần thợ lên kế hoạch tìm chỗ mới nhiều nhất.",
    "Ghi quyền lợi cụ thể (bao ăn ở, đưa đón) — thợ ở xa quyết định dựa trên chỗ ở.",
    "Nhắn tin chào thợ mới bằng tên + 1 câu về tiệm — tỉ lệ được trả lời cao hơn tin nhắn chung chung.",
  ],
};

const md = (d: Date) => (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
function inWindow(t: Theme, d: Date) {
  const v = md(d);
  const a = t.from[0] * 100 + t.from[1];
  const b = t.to[0] * 100 + t.to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b; // vắt qua năm mới
}

export function activeThemes(date: Date, market: Market): Theme[] {
  return THEMES.filter((t) => inWindow(t, date) && (!t.markets || t.markets.includes(market))).sort((a, b) => b.priority - a.priority);
}

export function tipOfDay(date: Date, role: "OWNER" | "TECHNICIAN") {
  const list = TIPS[role];
  const day = Math.floor(date.getTime() / 86_400_000);
  return list[day % list.length];
}

export interface StudioData {
  theme: Omit<Theme, "from" | "to" | "priority" | "markets"> | null;
  secondary: { title: string; emoji: string; hashtag: string } | null;
  challenge: {
    hashtag: string;
    posts: number;
    entries: { id: string; image: string | null; likes: number; author: { id: string; name: string; avatarUrl: string | null } }[];
  } | null;
  recap: { newJobs: number; topState: string | null; topStateJobs: number; medianPay: number | null; payState: string | null } | null;
  trendingTags: string[];
}

const cache = new Map<string, { at: number; data: StudioData }>();
const CACHE_MS = 10 * 60 * 1000;

const firstImage = (raw: string) => {
  try {
    const arr = JSON.parse(raw || "[]");
    return (Array.isArray(arr) ? arr : []).find((u: unknown) => typeof u === "string" && !/\.(mp4|webm|mov)/i.test(u)) ?? null;
  } catch {
    return null;
  }
};

export async function getStudio(market: Market, now = new Date()): Promise<StudioData> {
  const key = `${market}:${now.toISOString().slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const themes = activeThemes(now, market);
  const primary = themes[0] ?? null;
  const secondary = themes[1] ?? null;

  let challenge: StudioData["challenge"] = null;
  if (primary) {
    // SQLite LIKE không phân biệt hoa/thường với chữ ASCII — đủ cho hashtag không dấu.
    const posts = await prisma.post.findMany({
      where: { content: { contains: `#${primary.hashtag}` }, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      select: { id: true, mediaUrls: true, author: { select: { id: true, name: true, avatarUrl: true } }, _count: { select: { likes: true } } },
      take: 200,
    });
    challenge = {
      hashtag: primary.hashtag,
      posts: posts.length,
      entries: posts
        .map((p) => ({ id: p.id, image: firstImage(p.mediaUrls), likes: p._count.likes, author: p.author }))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 3),
    };
  }

  let recap: StudioData["recap"] = null;
  let trendingTags: string[] = [];
  try {
    const t = await getTrends(market);
    const newJobs = t.pulse.reduce((s, p) => s + p.newJobs, 0);
    const pay = t.salaries[0] ?? null;
    if (newJobs > 0 || pay) {
      recap = { newJobs, topState: t.pulse[0]?.label ?? null, topStateJobs: t.pulse[0]?.newJobs ?? 0, medianPay: pay?.median ?? null, payState: pay?.label ?? null };
    }
    trendingTags = t.hashtags.map((h) => h.tag).slice(0, 5);
  } catch (err) {
    console.error("getStudio trends error:", err);
  }

  const data: StudioData = {
    theme: primary
      ? { id: primary.id, title: primary.title, emoji: primary.emoji, hashtag: primary.hashtag, blurb: primary.blurb, ideas: primary.ideas, ownerTip: primary.ownerTip, colors: primary.colors }
      : null,
    secondary: secondary ? { title: secondary.title, emoji: secondary.emoji, hashtag: secondary.hashtag } : null,
    challenge,
    recap,
    trendingTags,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
