import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prismaCode, runExternalJobsSync } from "@/lib/jobFeeds/sync";

// Vercel Cron mỗi ngày (vercel.json) → lấy tin việc nail từ Adzuna (US + AU) vào bảng ExternalJob.
// Bảo vệ bằng CRON_SECRET: Vercel tự gửi "Authorization: Bearer <CRON_SECRET>"; không có CRON_SECRET → từ chối.
// EXTERNAL_JOBS_ADZUNA chưa bật / thiếu ADZUNA_APP_ID, ADZUNA_APP_KEY → không gọi mạng, không ghi DB (no-op).
// Phản hồi / log chỉ có số lượng + mã HTTP + mã lỗi Prisma — không bao giờ có khoá, URL gọi Adzuna hay nội dung tin.
// Ngân sách trong maxDuration 60 s: gọi Adzuna tới giây 30 (mỗi lượt gọi tự rút timeout), bắt đầu ghi DB tới giây 45,
// sau đó đối chiếu trùng + ghi tóm tắt admin LUÔN chạy.
export const maxDuration = 60;
const FETCH_BUDGET_MS = 30_000;
const WRITE_BUDGET_MS = 45_000;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(String(req.headers.get("authorization") || ""));
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const start = Date.now();
  try {
    const s = await runExternalJobsSync({ deadline: start + FETCH_BUDGET_MS, workDeadline: start + WRITE_BUDGET_MS });
    const a = s.adzuna;
    console.log(`[external-jobs] adzuna status=${a.status} licensed=${a.licensed ? "yes" : "no"} calls=${a.calls ?? 0} http=${a.httpStatus ?? "-"} active=${JSON.stringify(a.active ?? {})} purged=${a.purged ?? 0} ms=${Date.now() - start}`);
    return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Tên lỗi + mã Prisma (VD P2002) — không có thông điệp (có thể chứa dữ liệu) hay URL
    console.error(`[external-jobs] failed: ${String((e as Error)?.name || "Error")} code=${prismaCode(e) ?? "-"}`);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
