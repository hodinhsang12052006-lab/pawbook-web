import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST { option } — bỏ phiếu thăm dò (mỗi người 1 phiếu, bấm lựa chọn khác = đổi phiếu).
// Trả kết quả mới: { options: [{ label, votes }], total, myVote }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Đăng nhập để bình chọn nhé." }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { option?: unknown } | null;
  const poll = await prisma.postPoll.findUnique({ where: { postId: id } });
  if (!poll) return NextResponse.json({ error: "Không có thăm dò." }, { status: 404 });
  let labels: string[] = [];
  try { labels = JSON.parse(poll.options); } catch {}
  const option = Number(b?.option);
  if (!Number.isInteger(option) || option < 0 || option >= labels.length) return NextResponse.json({ error: "Lựa chọn không hợp lệ." }, { status: 400 });
  await prisma.postPollVote.upsert({ where: { postId_userId: { postId: id, userId } }, update: { option }, create: { postId: id, userId, option } });
  const tally = await prisma.postPollVote.groupBy({ by: ["option"], where: { postId: id }, _count: { _all: true } });
  const options = labels.map((label, i) => ({ label, votes: tally.find((t) => t.option === i)?._count._all ?? 0 }));
  return NextResponse.json({ options, total: options.reduce((a, o) => a + o.votes, 0), myVote: option });
}
