import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

// Cổng cho /api/admin/designs/flow/*: chỉ ADMIN (vai trò đọc lại từ DB, như /api/admin/designs), ai khác → 403.
// Giới hạn theo từng admin / giờ — đủ cho 1 lô ~220 ảnh + thử lại, chặn vòng lặp lỗi đốt chữ ký Cloudinary.
const HOUR = 3_600_000;
export const FLOW_LIMITS = { list: 240, sign: 600, import: 600, undo: 200 } as const;

export async function flowAdmin(bucket: keyof typeof FLOW_LIMITS): Promise<{ id: string; error?: undefined } | { error: NextResponse }> {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  const me = id ? await prisma.user.findUnique({ where: { id }, select: { role: true } }) : null;
  if (!id || me?.role !== "ADMIN") return { error: NextResponse.json({ error: "Chỉ admin / admins only" }, { status: 403 }) };
  const key = `flow-${bucket}:${id}`;
  if (isRateLimited(key, FLOW_LIMITS[bucket], HOUR)) {
    return { error: NextResponse.json({ error: "Quá nhiều yêu cầu, thử lại sau / too many requests" }, { status: 429 }) };
  }
  recordAttempt(key, HOUR);
  return { id };
}

export const noStore = { "Cache-Control": "no-store" };
