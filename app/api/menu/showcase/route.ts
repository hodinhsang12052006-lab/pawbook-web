import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toPublicMenuItem } from "@/lib/menu";

// GET /api/menu/showcase — mẫu có ẢNH THẬT trong menu của thợ / tiệm (trang Mẫu nail).
// Bỏ mẫu chép từ kho PawNail mà vẫn dùng ảnh AI (thư mục pawbook/designs): chỉ khoe tay nghề thật.
export async function GET(req: Request) {
  const limit = Math.min(24, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 12));
  try {
    const rows = await prisma.menuItem.findMany({
      where: { active: true, images: { not: "[]" }, NOT: { images: { contains: "/pawbook/designs/" } }, owner: { role: { in: ["TECHNICIAN", "OWNER"] } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { owner: { select: { id: true, name: true, avatarUrl: true, city: true } } },
    });
    const items = rows.map((r) => ({ ...toPublicMenuItem(r, false), owner: r.owner }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (err) {
    if (/no such table|P2021/i.test(String((err as Error)?.message))) return NextResponse.json({ items: [] });
    throw err;
  }
}
