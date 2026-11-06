import crypto from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { activeJobWhere, aggregatedIngestOn, INGEST_SOURCE, ingestBatch, type IngestInput } from "@/lib/jobIngest/ingest";

// Cổng nhận tin từ bot của chủ (đọc ~100 nhóm Facebook cộng đồng PawNail). Bảo vệ bằng INGEST_KEY (Vercel):
//   Authorization: Bearer <INGEST_KEY>
//   POST { posts: [{ text, sourceUrl?, postedAt?, phone?, salonName?, address?, city?, state?, zip?, market?, salary? }] }  (≤ 200 bài/lần)
//        → LUÔN NHẬN (không cần đặt biến nào). Công tắc khẩn cấp: INGEST_AGGREGATED=off → 410 INGEST_OFF.
//   GET  → thống kê tin từ nhóm (accepting = đang nhận hay không)
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
  // Công tắc KHẨN CẤP do chủ đặt (INGEST_AGGREGATED=off). Không đặt → nhận như bình thường.
  if (!aggregatedIngestOn()) return NextResponse.json({ error: "Đang tạm ngừng nhận tin từ nhóm (INGEST_AGGREGATED=off).", code: "INGEST_OFF" }, { status: 410 });
  const body = (await req.json().catch(() => null)) as { posts?: unknown } | null;
  const posts = Array.isArray(body?.posts) ? (body!.posts as IngestInput[]).filter((p) => p && typeof p === "object") : [];
  if (!posts.length) return NextResponse.json({ error: "posts: mảng bài đăng (≤ 200)" }, { status: 400 });
  if (posts.length > 200) return NextResponse.json({ error: "Tối đa 200 bài mỗi lần gửi" }, { status: 413 });
  return NextResponse.json(await ingestBatch(posts));
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  // active = ĐÚNG số đang hiện công khai (còn hạn + bộ lọc chữ + tài khoản thật); notExpired − active = bị bộ lọc ẩn
  const shown = { AND: [{ source: INGEST_SOURCE }, activeJobWhere(), { owner: realOnly() }] };
  const [active, notExpired, expired, byState] = await Promise.all([
    prisma.job.count({ where: shown }),
    prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { gt: now } } }),
    prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { lte: now } } }),
    prisma.job.groupBy({ by: ["market", "state"], where: shown, _count: { _all: true } }),
  ]);
  return NextResponse.json({ accepting: aggregatedIngestOn(), active, hiddenByFilter: Math.max(0, notExpired - active), expired, byState: byState.map((r) => ({ market: r.market, state: r.state, n: r._count._all })) });
}
