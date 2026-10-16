import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { REVIEW_DAYS, shortName } from "@/lib/booking";
import { sendPush } from "@/lib/push";

// Đánh giá của KHÁCH làm nail (không cần tài khoản, chỉ qua link riêng của lịch hẹn đã làm xong).
//   GET ?token=…   → thông tin để hiện trang đánh giá (tên thợ, mẫu, đã đánh giá chưa, hết hạn chưa)
//   GET ?techId=…  → công khai: điểm trung bình, số đánh giá, 20 đánh giá mới nhất
//   POST { token, rating 1–5, comment?, displayName? } → 1 lịch hẹn = 1 đánh giá
const DAY = 86_400_000;
const LINK = /(https?:\/\/|www\.|\.com\b|\.net\b)/i;

async function byToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  return prisma.bookingRequest.findUnique({
    where: { reviewToken: token },
    select: { id: true, techId: true, status: true, updatedAt: true, clientName: true, itemName: true, locale: true, tech: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const token = sp.get("token");
  if (token) {
    const b = await byToken(token);
    if (!b || b.status !== "done") return NextResponse.json({ error: "Link đánh giá không đúng hoặc đã bị xoá." }, { status: 404 });
    const done = await prisma.clientReview.findUnique({ where: { bookingId: b.id }, select: { rating: true } });
    return NextResponse.json(
      {
        tech: b.tech,
        itemName: b.itemName,
        suggestedName: shortName(b.clientName),
        locale: b.locale,
        reviewed: !!done,
        expired: Date.now() - b.updatedAt.getTime() > REVIEW_DAYS * DAY,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const techId = sp.get("techId");
  if (!techId) return NextResponse.json({ error: "Thiếu techId" }, { status: 400 });
  const where = { techId, hidden: false };
  const [agg, rows] = await Promise.all([
    prisma.clientReview.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    prisma.clientReview.findMany({ where, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, rating: true, comment: true, displayName: true, itemName: true, createdAt: true } }),
  ]);
  return NextResponse.json(
    { average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, count: agg._count._all, reviews: rows },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

export async function POST(req: Request) {
  const ipKey = `client-review:${getClientIp(req)}`;
  if (isRateLimited(ipKey, 10, 60 * 60 * 1000)) return NextResponse.json({ error: "Bạn gửi hơi nhiều, thử lại sau nhé." }, { status: 429 });
  recordAttempt(ipKey, 60 * 60 * 1000);
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; rating?: unknown; comment?: unknown; displayName?: unknown };
  const b = await byToken(String(body.token ?? ""));
  if (!b || b.status !== "done") return NextResponse.json({ error: "Link đánh giá không đúng hoặc đã bị xoá." }, { status: 404 });
  if (Date.now() - b.updatedAt.getTime() > REVIEW_DAYS * DAY) return NextResponse.json({ error: "Link đánh giá đã hết hạn." }, { status: 410 });
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: "Chọn số sao từ 1 đến 5." }, { status: 400 });
  const comment = typeof body.comment === "string" ? body.comment.replace(/\s+/g, " ").trim().slice(0, 500) || null : null;
  if (comment && LINK.test(comment)) return NextResponse.json({ error: "Nhận xét không được chứa đường link." }, { status: 400 });
  const displayName = (typeof body.displayName === "string" ? body.displayName.replace(/\s+/g, " ").trim().slice(0, 30) : "") || shortName(b.clientName);
  try {
    await prisma.clientReview.create({ data: { techId: b.techId, bookingId: b.id, rating, comment, displayName, itemName: b.itemName } });
  } catch (e) {
    if (/Unique constraint|P2002/i.test(String((e as Error)?.message))) return NextResponse.json({ error: "Lịch hẹn này đã được đánh giá — cảm ơn bạn!" }, { status: 409 });
    throw e;
  }
  await sendPush(b.techId, {
    title: `${"⭐".repeat(rating)} Khách vừa đánh giá bạn`,
    body: `${displayName}${comment ? `: “${comment.slice(0, 80)}”` : ""}`,
    url: `/profile/${b.techId}?tab=menu`,
    tag: "pn-client-review",
  }).catch(() => 0);
  return NextResponse.json({ ok: true }, { status: 201 });
}
