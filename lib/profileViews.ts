import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { stateName } from "@/lib/stateNames";

// "Ai đã xem hồ sơ bạn" — số liệu THẬT, mỗi người xem 1 hồ sơ tính tối đa
// 1 lần/ngày. Danh tính chỉ hiện với người xem là CHỦ TIỆM (tiệm là doanh
// nghiệp, thợ cần biết tiệm nào quan tâm để nhắn lại); thợ xem hồ sơ người
// khác thì chỉ được đếm, không lộ tên. Bảng chưa tạo → bỏ qua êm.

const DAY_MS = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);

function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

export interface ViewStats {
  week: number; // lượt xem 7 ngày (mỗi người/ngày tính 1)
  viewers: number; // số người khác nhau
  salons: number; // trong đó là chủ tiệm
  topState: string | null; // bang có nhiều người xem nhất
  recentSalons: { id: string; name: string; avatarUrl: string | null; market: "US" | "AU"; city: string | null; state: string | null; at: string }[];
}

/** Ghi 1 lượt xem. Trả true nếu là lượt MỚI trong ngày. Không bao giờ ném lỗi. */
export async function recordProfileView(viewerId: string, profileId: string): Promise<boolean> {
  if (!viewerId || !profileId || viewerId === profileId) return false;
  try {
    const [viewer, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: viewerId }, select: { role: true, market: true, state: true, city: true } }),
      prisma.user.findUnique({ where: { id: profileId }, select: { id: true, role: true } }),
    ]);
    if (!viewer || !profile || profile.role === "ADMIN") return false;
    try {
      await prisma.profileView.create({ data: { viewerId, profileId, day: today() } });
    } catch (err) {
      if (/Unique constraint|P2002|UNIQUE/i.test(String((err as Error)?.message))) return false; // đã đếm hôm nay
      throw err;
    }
    // Tiệm xem hồ sơ thợ → báo thợ, tối đa 1 lần/ngày (lượt tiệm đầu tiên trong ngày).
    if (viewer.role === "OWNER" && profile.role === "TECHNICIAN") {
      const ownerViewsToday = await prisma.profileView.count({ where: { profileId, day: today(), viewer: { role: "OWNER" } } });
      if (ownerViewsToday === 1) {
        const where = viewer.city || stateName(viewer.market, viewer.state) || "";
        await sendPush(profileId, {
          title: "👀 Có tiệm vừa xem hồ sơ bạn",
          body: where ? `Một tiệm ở ${where} vừa xem portfolio của bạn — mở app xem là tiệm nào.` : "Một tiệm vừa xem portfolio của bạn — mở app xem là tiệm nào.",
          url: "/profile#ai-da-xem",
          tag: "pn-profile-views",
        });
      }
    }
    return true;
  } catch (err) {
    if (!isMissingTable(err)) console.error("recordProfileView error:", err);
    return false;
  }
}

export async function getViewStats(profileId: string): Promise<ViewStats> {
  const empty: ViewStats = { week: 0, viewers: 0, salons: 0, topState: null, recentSalons: [] };
  try {
    const rows = await prisma.profileView.findMany({
      where: { profileId, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { viewerId: true, createdAt: true, viewer: { select: { id: true, name: true, avatarUrl: true, role: true, market: true, city: true, state: true } } },
    });
    if (!rows.length) return empty;
    const distinct = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!distinct.has(r.viewerId)) distinct.set(r.viewerId, r); // giữ lượt mới nhất
    const byState = new Map<string, number>();
    for (const r of distinct.values()) {
      const label = r.viewer.state ? stateName(r.viewer.market, r.viewer.state) || r.viewer.state : null;
      if (label) byState.set(label, (byState.get(label) ?? 0) + 1);
    }
    const salons = [...distinct.values()].filter((r) => r.viewer.role === "OWNER");
    return {
      week: rows.length,
      viewers: distinct.size,
      salons: salons.length,
      topState: [...byState.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      recentSalons: salons.slice(0, 5).map((r) => ({
        id: r.viewer.id,
        name: r.viewer.name,
        avatarUrl: r.viewer.avatarUrl,
        market: r.viewer.market,
        city: r.viewer.city,
        state: r.viewer.state,
        at: r.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    if (!isMissingTable(err)) console.error("getViewStats error:", err);
    return empty;
  }
}
