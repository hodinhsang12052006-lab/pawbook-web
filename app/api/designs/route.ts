import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { queryCatalog } from "@/lib/designCatalog";

// GET /api/designs?occasion=&skill=&market=&limit=&offset= — mẫu nail ĐÃ DUYỆT, theo mùa của người xem, ảnh Flow trước
// (quy tắc ở lib/designCatalog.ts). Đã đăng nhập → kèm "saved" (mình đã lưu mẫu nào).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  // ?market= — chỉ mẫu hợp với người xem: bỏ dịp không có / hết mùa ở thị trường đó và mẫu MÙA vẽ cho bán cầu kia.
  const market = sp.get("market") === "AU" ? "AU" : sp.get("market") === "US" ? "US" : null;
  const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 30));
  const offset = Math.min(5000, Math.max(0, Math.floor(Number(sp.get("offset")) || 0)));
  try {
    const { designs, hasMore } = await queryCatalog({ occasion: sp.get("occasion"), skill: sp.get("skill"), market, limit, offset });
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
