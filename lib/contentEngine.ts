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

import { THEMES, type Theme } from "@/lib/studioThemes";
export { THEMES, type Theme };

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
