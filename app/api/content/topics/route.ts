import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { recordTopicSignals, TOPIC_BANK } from "@/lib/hotTopics";

// POST /api/content/topics — tool gửi TÍN HIỆU chủ đề đang được bàn nhiều (KHÔNG gửi nội dung bài / tên người):
//   { topics: [{ topic: "chia turn bất công", likes: 120, comments: 85 }, …] }   (≤ 500)
// Khoá như /api/jobs/sync: "x-api-key: <INGEST_KEY>" hoặc "Authorization: Bearer <INGEST_KEY>".
function authed(req: Request) {
  const key = process.env.INGEST_KEY;
  if (!key || key.length < 24) return false;
  const raw = req.headers.get("x-api-key") || String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const got = Buffer.from(raw), want = Buffer.from(key);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized — thiếu hoặc sai INGEST_KEY" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { topics?: unknown } | null;
  const list = Array.isArray(b?.topics) ? (b!.topics as { topic?: unknown; likes?: unknown; comments?: unknown }[]) : [];
  if (!list.length) return NextResponse.json({ error: "topics: mảng [{ topic, likes, comments }]" }, { status: 400 });
  const r = await recordTopicSignals(list);
  const ranking = TOPIC_BANK.map((t) => ({ key: t.key, question: t.question, score: r.scores[t.key]?.score ?? 0 })).sort((a, b) => b.score - a.score);
  return NextResponse.json({ matched: r.matched, ranking });
}
