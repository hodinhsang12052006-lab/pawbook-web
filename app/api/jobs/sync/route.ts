import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { blockedPhones, ingestBatch, ingestOne, type IngestInput } from "@/lib/jobIngest/ingest";
import { parseJobPost } from "@/lib/jobIngest/parse";

// POST /api/jobs/sync — tool lọc bài gửi tin TIỆM NHỜ ĐĂNG (định dạng của tool):
//   { title, salon_name, phone, facebook_url, location, state, salary, skills[], content, post_url, country }
// Gửi 1 bài (object), nhiều bài (mảng) hoặc { posts: [...] } (≤ 200).
// Bắt buộc khoá: header "Authorization: Bearer <INGEST_KEY>" (hoặc "x-api-key: <INGEST_KEY>").
// Chống trùng: cùng SĐT hoặc cùng Facebook người đăng → KHÔNG tạo tin mới: đẩy tin lên đầu,
// repost_count + 1, last_reposted_at = bây giờ, nội dung mới nhất (xem lib/jobIngest/ingest.ts).
export const maxDuration = 60;

function authed(req: Request) {
  const key = process.env.INGEST_KEY;
  if (!key || key.length < 24) return false;
  const raw = req.headers.get("x-api-key") || String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const got = Buffer.from(raw);
  const want = Buffer.from(key);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

interface SyncPost {
  title?: string; salon_name?: string; phone?: string; facebook_url?: string; location?: string; state?: string;
  salary?: string; skills?: string[]; content?: string; post_url?: string; country?: string; posted_at?: string;
}
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function toInput(p: SyncPost): IngestInput {
  const loc = str(p.location) ? parseJobPost(String(p.location)) : null; // "Houston, TX 77083" → thành phố / bang / ZIP
  const country = String(p.country || "");
  const market = /(úc|uc\b|australia|\bau\b)/i.test(country) ? "AU" : /(mỹ|my\b|usa|\bus\b|united states)/i.test(country) ? "US" : undefined;
  return {
    text: str(p.content) || [p.title, p.salon_name, p.location, p.salary].filter(Boolean).join("\n"),
    title: str(p.title),
    salonName: str(p.salon_name),
    phone: str(p.phone),
    fbUrl: str(p.facebook_url),
    city: loc?.city ?? undefined,
    state: str(p.state) || loc?.state || undefined,
    zip: loc?.zip ?? undefined,
    market: market ?? (loc?.market || undefined),
    salary: str(p.salary),
    skills: Array.isArray(p.skills) ? p.skills.filter((s): s is string => typeof s === "string").slice(0, 12) : undefined,
    sourceUrl: str(p.post_url),
    postedAt: str(p.posted_at),
  };
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized — thiếu hoặc sai INGEST_KEY" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as SyncPost | SyncPost[] | { posts?: SyncPost[] } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Body phải là JSON" }, { status: 400 });

  // 1 bài → trả kết quả của bài đó
  if (!Array.isArray(body) && !("posts" in body)) {
    const r = await ingestOne(toInput(body as SyncPost), await blockedPhones());
    const code = r.status === "created" ? 201 : r.status === "skipped" ? 422 : 200;
    return NextResponse.json({ status: r.status, job_id: r.jobId ?? null, repost_count: r.repostCount ?? null, reason: r.reason ?? null }, { status: code });
  }
  const list = (Array.isArray(body) ? body : body.posts) || [];
  if (!Array.isArray(list) || !list.length) return NextResponse.json({ error: "Chưa có bài nào" }, { status: 400 });
  if (list.length > 200) return NextResponse.json({ error: "Tối đa 200 bài mỗi lần gửi" }, { status: 413 });
  const out = await ingestBatch(list.filter((p) => p && typeof p === "object").map(toInput));
  return NextResponse.json({
    created: out.created, bumped: out.bumped, updated: out.updated, skipped: out.skipped,
    results: out.results.map((r) => ({ i: r.i, status: r.status, job_id: r.jobId ?? null, repost_count: r.repostCount ?? null, reason: r.reason ?? null })),
  });
}
