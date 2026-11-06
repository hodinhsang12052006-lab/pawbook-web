import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { toPublic } from "@/lib/aiDesigns";
import { SEASONAL_THEMES, THEMES } from "@/lib/studioThemes";

// GET /api/designs?occasion=&skill=&market=&limit=&offset= — mẫu nail ĐÃ DUYỆT, mới nhất trước.
// Đã đăng nhập → kèm "saved" (mình đã lưu mẫu nào).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const occasion = sp.get("occasion");
  const skill = sp.get("skill");
  // ?market= — chỉ mẫu hợp với người xem: bỏ dịp không có ở thị trường đó (Lễ Tạ Ơn với khách Úc) và mẫu MÙA
  // vẽ cho bán cầu kia (mẫu "mùa thu" của Mỹ trong tháng 11 ở Sydney). Xem designFitsMarket (lib/studioThemes).
  const market = sp.get("market") === "AU" ? "AU" : sp.get("market") === "US" ? "US" : null;
  const notInMarket = market ? THEMES.filter((t) => t.markets && !t.markets.includes(market)).map((t) => t.id) : [];
  const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 30));
  const offset = Math.min(5000, Math.max(0, Math.floor(Number(sp.get("offset")) || 0)));
  try {
    const rows = await prisma.nailDesign.findMany({
      where: {
        status: "published",
        // Chỉ hiện mẫu ĐÃ có ảnh thật — mẫu mới vẫn tự đăng (không chờ duyệt) nhưng chờ vẽ ảnh xong
        // mới lộ ra; trước đó hiện hình minh hoạ hoạt hình nhìn rẻ tiền ở đầu trang.
        imageUrl: { not: null },
        ...(occasion ? { occasion } : {}),
        ...(skill ? { skills: { contains: skill } } : {}),
        ...(market
          ? {
              AND: [
                ...(notInMarket.length ? [{ OR: [{ occasion: null }, { occasion: { notIn: notInMarket } }] }] : []),
                { OR: [{ market }, { occasion: null }, { occasion: { notIn: [...SEASONAL_THEMES] } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: offset,
      take: limit + 1, // +1 để biết còn trang sau
      include: { _count: { select: { saves: true } } },
    });
    const hasMore = rows.length > limit;
    const designs = rows.slice(0, limit).map(toPublic);
    const userId = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
    if (userId && designs.length) {
      const mine = await prisma.nailDesignSave.findMany({ where: { userId, designId: { in: designs.map((d) => d.id) } }, select: { designId: true } });
      const set = new Set(mine.map((m) => m.designId));
      for (const d of designs) d.saved = set.has(d.id);
    }
    return NextResponse.json({ designs, hasMore }, { headers: { "Cache-Control": userId ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    if (/no such table|P2021/i.test(String((err as Error)?.message))) return NextResponse.json({ designs: [] });
    throw err;
  }
}
