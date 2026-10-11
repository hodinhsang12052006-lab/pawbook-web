import crypto from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { INGEST_SOURCE, ingestBatch, type IngestInput } from "@/lib/jobIngest/ingest";

// Cổng nhận tin từ tool lọc nhóm. Bảo vệ bằng INGEST_KEY (Vercel):  Authorization: Bearer <INGEST_KEY>
//   POST { posts: [{ text, sourceUrl?, postedAt?, phone?, salonName?, address?, city?, state?, zip?, market?, salary? }] }  (≤ 200 bài/lần)
//   GET  → thống kê tin tổng hợp
export const maxDuration = 60;

function authed(req: Request) {
  const key = process.env.INGEST_KEY;
  if (!key || key.length < 24) return false;
  const got = Buffer.from(String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(key);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { posts?: unknown } | null;
  const posts = Array.isArray(body?.posts) ? (body!.posts as IngestInput[]).filter((p) => p && typeof p === "object") : [];
  if (!posts.length) return NextResponse.json({ error: "posts: mảng bài đăng (≤ 200)" }, { status: 400 });
  if (posts.length > 200) return NextResponse.json({ error: "Tối đa 200 bài mỗi lần gửi" }, { status: 413 });
  return NextResponse.json(await ingestBatch(posts));
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const [active, expired, byState] = await Promise.all([
    prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { gt: now } } }),
    prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { lte: now } } }),
    prisma.job.groupBy({ by: ["market", "state"], where: { source: INGEST_SOURCE, expiresAt: { gt: now } }, _count: { _all: true } }),
  ]);
  return NextResponse.json({ active, expired, byState: byState.map((r) => ({ market: r.market, state: r.state, n: r._count._all })) });
}
