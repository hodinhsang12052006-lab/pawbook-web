import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { MAX_JOB_ALERTS, cleanAlert } from "@/lib/jobAlertRules";

// /api/job-alerts — bộ lọc "Báo tôi khi có việc như thế này" của chính mình.
async function me() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}
const missing = (err: unknown) => /no such table|P2021/i.test(String((err as Error)?.message || err));
const unavailable = () => NextResponse.json({ error: "Tính năng đang được bật, thử lại sau ít phút." }, { status: 503 });

export async function GET() {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  try {
    const alerts = await prisma.jobAlert.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, market: true, state: true, skill: true, createdAt: true } });
    return NextResponse.json({ alerts, max: MAX_JOB_ALERTS });
  } catch (err) {
    if (missing(err)) return NextResponse.json({ alerts: [], max: MAX_JOB_ALERTS });
    throw err;
  }
}

export async function POST(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const data = cleanAlert(await req.json().catch(() => null));
  if (!data) return NextResponse.json({ error: "Tiêu chí không hợp lệ." }, { status: 400 });
  try {
    const existing = await prisma.jobAlert.findMany({ where: { userId }, select: { market: true, state: true, skill: true } });
    if (existing.some((a) => a.market === data.market && a.state === data.state && a.skill === data.skill)) {
      return NextResponse.json({ error: "Bạn đã có thông báo này rồi." }, { status: 409 });
    }
    if (existing.length >= MAX_JOB_ALERTS) {
      return NextResponse.json({ error: `Tối đa ${MAX_JOB_ALERTS} thông báo việc — xoá bớt 1 cái trong Hồ sơ.` }, { status: 409 });
    }
    const alert = await prisma.jobAlert.create({ data: { userId, ...data }, select: { id: true, market: true, state: true, skill: true, createdAt: true } });
    return NextResponse.json({ alert }, { status: 201 });
  } catch (err) {
    if (missing(err)) return unavailable();
    throw err;
  }
}

export async function DELETE(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  try {
    // deleteMany + userId: không xoá được thông báo của người khác.
    const r = await prisma.jobAlert.deleteMany({ where: { id, userId } });
    return NextResponse.json({ ok: r.count > 0 }, { status: r.count ? 200 : 404 });
  } catch (err) {
    if (missing(err)) return unavailable();
    throw err;
  }
}
