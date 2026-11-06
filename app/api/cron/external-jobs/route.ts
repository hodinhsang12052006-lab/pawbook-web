import { NextResponse } from "next/server";
import { runExternalJobsSync } from "@/lib/jobFeeds/sync";

// Vercel Cron mỗi ngày (vercel.json) → lấy tin việc nail từ Adzuna (US + AU) vào bảng ExternalJob.
// Bảo vệ bằng CRON_SECRET: Vercel tự gửi "Authorization: Bearer <CRON_SECRET>"; không có CRON_SECRET → từ chối.
// EXTERNAL_JOBS_ADZUNA chưa bật / thiếu ADZUNA_APP_ID, ADZUNA_APP_KEY → không gọi mạng, không ghi DB (no-op).
// Phản hồi / log chỉ có số lượng + mã HTTP — không bao giờ có khoá, URL gọi Adzuna hay nội dung tin.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const s = await runExternalJobsSync({ deadline: Date.now() + 45_000 });
    const a = s.adzuna;
    console.log(`[external-jobs] adzuna status=${a.status} calls=${a.calls ?? 0} http=${a.httpStatus ?? "-"} active=${JSON.stringify(a.active ?? {})} purged=${a.purged ?? 0}`);
    return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[external-jobs] failed:", String((e as Error)?.name || "Error"));
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
