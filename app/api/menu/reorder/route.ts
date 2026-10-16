import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST /api/menu/reorder { ids: [...] } — xếp lại thứ tự menu (chỉ các mẫu của chính mình).
export async function POST(req: Request) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === "string").slice(0, 200);
  if (!ids.length) return NextResponse.json({ error: "Thiếu danh sách" }, { status: 400 });
  const own = await prisma.menuItem.findMany({ where: { id: { in: ids }, ownerId: me }, select: { id: true } });
  if (own.length !== new Set(ids).size) return NextResponse.json({ error: "Có mẫu không thuộc menu của bạn." }, { status: 403 });
  await prisma.$transaction(ids.map((id, i) => prisma.menuItem.update({ where: { id }, data: { sortOrder: i } })));
  return NextResponse.json({ ok: true });
}
