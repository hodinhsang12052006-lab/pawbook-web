import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

// Cổng cho /api/admin/designs/flow/*: chỉ ADMIN (vai trò đọc lại từ DB, như /api/admin/designs), ai khác → 403.
// Giới hạn theo từng admin / giờ — đủ cho 1 lô ~220 ảnh + thử lại, chặn vòng lặp lỗi đốt chữ ký Cloudinary.
// (Bộ đếm nằm trong bộ nhớ từng máy chủ — xem lib/rateLimit; chỉ admin dùng nên chấp nhận được.)
// POST: chống CSRF ngoài cookie SameSite — bắt buộc Content-Type JSON và Origin đúng trang (thiếu Origin → chặn).
const HOUR = 3_600_000;
export const FLOW_LIMITS = { list: 240, sign: 600, import: 600, undo: 400 } as const;
export const noStore = { "Cache-Control": "no-store" };
const deny = (status: number, error: string) => ({ error: NextResponse.json({ error }, { status, headers: noStore }) });

/** Origin của 1 POST có phải chính trang này không (NEXTAUTH_URL, hoặc host mà trình duyệt đang gọi). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false;
  let o: URL;
  try { o = new URL(origin); } catch { return false; }
  const allowed = new Set<string>();
  try { if (process.env.NEXTAUTH_URL) allowed.add(new URL(process.env.NEXTAUTH_URL).origin); } catch { /* bỏ qua */ }
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  if (host) {
    const proto = (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")).split(",")[0].trim();
    allowed.add(`${proto}://${host}`);
  }
  return allowed.has(o.origin);
}

export async function flowAdmin(bucket: keyof typeof FLOW_LIMITS, req?: Request): Promise<{ id: string; error?: undefined } | { error: NextResponse }> {
  if (req && req.method !== "GET") {
    if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return deny(415, "Yêu cầu phải là JSON / JSON body required");
    if (!sameOrigin(req)) return deny(403, "Yêu cầu không đến từ trang PawNail / cross-site request blocked");
  }
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  const me = id ? await prisma.user.findUnique({ where: { id }, select: { role: true } }) : null;
  if (!id || me?.role !== "ADMIN") return deny(403, "Chỉ admin / admins only");
  const key = `flow-${bucket}:${id}`;
  if (isRateLimited(key, FLOW_LIMITS[bucket], HOUR)) return deny(429, "Quá nhiều yêu cầu, thử lại sau / too many requests");
  recordAttempt(key, HOUR);
  return { id };
}
