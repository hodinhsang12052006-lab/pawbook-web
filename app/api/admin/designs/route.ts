import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { geminiEnabled } from "@/lib/gemini";
import { dailyLimit, generateDesigns, storageReady, toPublic } from "@/lib/aiDesigns";

// Mẫu nail AI — chỉ ADMIN (xác minh trong DB):
//   GET                         — nháp chờ duyệt + mẫu đã đăng gần đây + trạng thái cấu hình
//   POST  { count?, market? }   — tạo thêm mẫu nháp ngay (trong giới hạn/ngày)
//   PATCH { id, status }        — duyệt ("published") hoặc bỏ ("rejected")
export const maxDuration = 60; // vẽ ảnh mất 10–30 giây

const missing = (err: unknown) => /no such table|P2021/i.test(String((err as Error)?.message || err));

async function admin() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (me?.role !== "ADMIN") return { error: NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 }) };
  return { id };
}

export async function GET() {
  const a = await admin();
  if (a.error) return a.error;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const [drafts, published, madeToday] = await Promise.all([
      prisma.nailDesign.findMany({ where: { status: "draft" }, orderBy: { createdAt: "desc" }, take: 40, include: { _count: { select: { saves: true } } } }),
      prisma.nailDesign.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 12, include: { _count: { select: { saves: true } } } }),
      prisma.nailDesign.count({ where: { day } }),
    ]);
    return NextResponse.json({
      enabled: geminiEnabled(),
      storage: storageReady(),
      dailyLimit: dailyLimit(),
      madeToday,
      drafts: drafts.map(toPublic),
      published: published.map(toPublic),
    });
  } catch (err) {
    if (missing(err)) return NextResponse.json({ enabled: geminiEnabled(), storage: storageReady(), dailyLimit: dailyLimit(), madeToday: 0, drafts: [], published: [], needsSql: true });
    throw err;
  }
}

export async function POST(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  if (!geminiEnabled()) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên máy chủ." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { count?: number; market?: string };
  const count = Math.min(6, Math.max(1, Math.round(Number(body.count) || 3)));
  try {
    const r = await generateDesigns(body.market === "AU" ? "AU" : "US", count);
    return NextResponse.json(r, { status: r.created.length ? 201 : 200 });
  } catch (err) {
    if (missing(err)) return NextResponse.json({ error: "Chưa tạo bảng NailDesign — chạy prisma/sql/2026-10-09_nail_designs.sql." }, { status: 503 });
    return NextResponse.json({ error: (err as Error).message.slice(0, 300) }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!body.id || !["published", "rejected", "draft"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  const r = await prisma.nailDesign.updateMany({
    where: { id: body.id },
    data: { status: body.status, publishedAt: body.status === "published" ? new Date() : null },
  });
  return NextResponse.json({ ok: r.count > 0 }, { status: r.count ? 200 : 404 });
}
