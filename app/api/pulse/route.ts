import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { questionFor, weekKey } from "@/lib/painPulse";
import { pulseResult } from "@/lib/pulseResults";

// GET  /api/pulse            — câu hỏi tuần này cho vai trò của tôi + phiếu của tôi + kết quả
// POST /api/pulse { option } — trả lời (1 lần / tuần, không sửa được — tránh "lái" kết quả)
async function me() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, market: true, state: true } });
}

async function payload(user: { id: string; role: string; market: string | null; state: string | null }) {
  const week = weekKey();
  const q = questionFor(user.role, week);
  if (!q) return { question: null };
  let myVote: string | null = null;
  try {
    myVote = (await prisma.pulseVote.findUnique({ where: { userId_week: { userId: user.id, week } }, select: { option: true } }))?.option ?? null;
  } catch {}
  // Kết quả chỉ trả về SAU khi đã trả lời — không để số đông "lái" câu trả lời.
  const [all, local] = myVote
    ? await Promise.all([
        pulseResult(q.id, week, { market: user.market ?? undefined }),
        user.state ? pulseResult(q.id, week, { market: user.market ?? undefined, state: user.state }) : Promise.resolve(null),
      ])
    : [null, null];
  return {
    week,
    question: { id: q.id, text: q.question, options: q.options },
    myVote,
    results: all,
    localResults: local && local.published ? local : null,
  };
}

export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await payload(user));
}

export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const week = weekKey();
  const q = questionFor(user.role, week);
  if (!q) return NextResponse.json({ error: "Không có câu hỏi cho tài khoản này." }, { status: 400 });
  const { option } = await req.json().catch(() => ({}));
  if (typeof option !== "string" || !q.options.some((o) => o.id === option)) {
    return NextResponse.json({ error: "Lựa chọn không hợp lệ." }, { status: 400 });
  }
  try {
    await prisma.pulseVote.create({
      data: { userId: user.id, week, questionId: q.id, option, role: user.role, market: user.market, state: user.state },
    });
  } catch (err) {
    const msg = String((err as Error).message);
    if (/Unique constraint|P2002/.test(msg)) return NextResponse.json({ error: "Bạn đã trả lời câu hỏi tuần này rồi." }, { status: 409 });
    if (/no such table|P2021/.test(msg)) return NextResponse.json({ error: "Tính năng đang được bật, thử lại sau." }, { status: 503 });
    console.error("pulse vote error:", err);
    return NextResponse.json({ error: "Không ghi nhận được." }, { status: 500 });
  }
  return NextResponse.json(await payload(user));
}
