import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { parseMenuItem, toPublicMenuItem } from "@/lib/menu";

// PATCH /api/menu/:id — sửa mẫu (cả bản đầy đủ, hoặc chỉ { active } để ẩn/hiện) · DELETE — xoá. Chỉ chủ menu.
async function mine(id: string) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  const row = await prisma.menuItem.findUnique({ where: { id } });
  if (!row) return { error: NextResponse.json({ error: "Không tìm thấy mẫu." }, { status: 404 }) };
  if (row.ownerId !== me) return { error: NextResponse.json({ error: "Không phải menu của bạn." }, { status: 403 }) };
  return { row };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await mine(id);
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Chỉ bật/tắt hiển thị
  if (Object.keys(body).length === 1 && typeof body.active === "boolean") {
    const row = await prisma.menuItem.update({ where: { id }, data: { active: body.active } });
    return NextResponse.json({ item: toPublicMenuItem(row, true) });
  }
  const parsed = parseMenuItem(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  const row = await prisma.menuItem.update({ where: { id }, data: { ...v, images: JSON.stringify(v.images), materials: JSON.stringify(v.materials) } });
  return NextResponse.json({ item: toPublicMenuItem(row, true) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await mine(id);
  if ("error" in r) return r.error;
  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
