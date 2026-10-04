import prisma from "@/lib/prisma";
import { getProfileCompleteness } from "@/lib/profileCompleteness";
import { getResponseStats, describeResponse } from "@/lib/responseTime";

// Huy hiệu hồ sơ — mỗi huy hiệu gắn với 1 điều kiện ĐO ĐƯỢC từ dữ liệu thật,
// không cấp tay, không mua được. Đây là động lực để người dùng hoàn thiện hồ
// sơ, trả lời nhanh và làm tốt (có đánh giá cao) — cũng là tín hiệu tin cậy
// cho phía bên kia khi chọn tiệm / chọn thợ.

export interface Badge {
  key: "founding" | "fast_reply" | "top_rated" | "complete" | "loved";
  label: string;
  hint: string;
}

// Thành viên đăng ký trước mốc này nhận huy hiệu "Thành viên sáng lập" vĩnh
// viễn. Sau mốc này KHÔNG cấp nữa — khan hiếm thật, có hạn chót công khai.
export const FOUNDING_UNTIL = new Date("2027-01-01T00:00:00Z");

const LOVED_MIN_LIKES = 20;

export async function getBadges(userId: string): Promise<Badge[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, role: true, avatarUrl: true, phone: true, city: true, state: true,
      turnSplitPolicy: true, clientTypePolicy: true, createdAt: true,
      jobs: { select: { id: true }, take: 1 },
      technicianProfile: { select: { specialties: true, bio: true, yearsOfExperience: true, portfolioImages: true } },
    },
  });
  if (!user || user.role === "ADMIN") return [];

  const since = new Date(Date.now() - 30 * 86_400_000);
  const [reviewAgg, response, likes] = await Promise.all([
    prisma.review.aggregate({ where: { targetUserId: userId }, _avg: { overall: true }, _count: { _all: true } }),
    getResponseStats(userId),
    prisma.postLike.count({ where: { post: { authorId: userId }, userId: { not: userId }, createdAt: { gte: since } } }),
  ]);

  const badges: Badge[] = [];
  if (user.createdAt < FOUNDING_UNTIL) {
    badges.push({ key: "founding", label: "Thành viên sáng lập", hint: "Tham gia PawNail trước 01/01/2027" });
  }
  if (response && response.medianMinutes <= 60) {
    badges.push({ key: "fast_reply", label: "Phản hồi nhanh", hint: `Thường trả lời tin nhắn ${describeResponse(response.medianMinutes)}` });
  }
  const avg = reviewAgg._avg.overall;
  if (avg !== null && avg >= 4.5 && reviewAgg._count._all >= 3) {
    badges.push({ key: "top_rated", label: `Uy tín ${avg.toFixed(1)}★`, hint: `Trung bình ${avg.toFixed(1)}★ từ ${reviewAgg._count._all} đánh giá thật` });
  }
  if (getProfileCompleteness(user)?.percent === 100) {
    badges.push({ key: "complete", label: "Hồ sơ đầy đủ", hint: "Đã hoàn thiện 100% thông tin hồ sơ" });
  }
  if (likes >= LOVED_MIN_LIKES) {
    badges.push({ key: "loved", label: "Được yêu thích", hint: `${likes} lượt thích bài đăng trong 30 ngày` });
  }
  return badges;
}
