import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { toPublic } from "@/lib/aiDesigns";

// GET /api/designs?occasion=&skill=&limit= — mẫu nail AI ĐÃ DUYỆT, mới nhất trước.
// Đã đăng nhập → kèm "saved" (mình đã lưu mẫu nào).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const occasion = sp.get("occasion");
  const skill = sp.get("skill");
  const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 30));
  try {
    const rows = await prisma.nailDesign.findMany({
      where: {
        status: "published",
        ...(occasion ? { occasion } : {}),
        ...(skill ? { skills: { contains: skill } } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: { _count: { select: { saves: true } } },
    });
    const designs = rows.map(toPublic);
    const userId = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
    if (userId && designs.length) {
      const mine = await prisma.nailDesignSave.findMany({ where: { userId, designId: { in: designs.map((d) => d.id) } }, select: { designId: true } });
      const set = new Set(mine.map((m) => m.designId));
      for (const d of designs) d.saved = set.has(d.id);
    }
    return NextResponse.json({ designs }, { headers: { "Cache-Control": userId ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    if (/no such table|P2021/i.test(String((err as Error)?.message))) return NextResponse.json({ designs: [] });
    throw err;
  }
}
