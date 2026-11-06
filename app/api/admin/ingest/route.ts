import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { findPhone } from "@/lib/jobIngest/parse";
import { activeJobWhere, ASSISTED_SOURCE, blockedPhones, blockPhone, commitIngest, ingestBatch, ingestHeartbeat, INGEST_SOURCE, jobTtlDays, prepareIngest, removeJobPublicData, type IngestInput } from "@/lib/jobIngest/ingest";
import { externalJobsStatus } from "@/lib/jobFeeds/sync";

// Admin: "Đăng hộ tiệm" (tiệm NHỜ đăng — ghi nhận người yêu cầu) + xử lý yêu cầu "Nhận tin" / "Gỡ tin".
//   GET                                     → yêu cầu đang chờ + số tin THẬT đang hiện / bị bộ lọc ẩn / hết hạn
//                                              + lần cuối tool tổng hợp gửi tin + trạng thái nguồn đối tác (Adzuna)
//   POST { action: "dryrun"|"preview", text, overrides? } → quyết định THẬT của máy chủ (chưa lưu) + trường đã tách
//   POST { action: "post", posts: [{ text, sourceUrl?, ...overrides }], requester: { name, contact, requestedAt? } }
//        → đăng với source "assisted" (nhãn "Đăng hộ tiệm") + lưu người yêu cầu (JobRequest kind "assist")
//   POST { action: "resolve", requestId, decision: "remove"|"claim"|"dismiss" }
async function admin() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return me?.role === "ADMIN" ? id : null;
}

const s = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : undefined);
/** Trường admin sửa tay (ghi đè bộ tách). */
function overrides(o: unknown): Partial<IngestInput> {
  const x = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
  const market = x.market === "US" || x.market === "AU" ? x.market : undefined;
  return { salonName: s(x.salonName, 60) || undefined, city: s(x.city, 60) || undefined, state: s(x.state, 3)?.toUpperCase() || undefined, market, salary: s(x.salary, 40) || undefined, phone: s(x.phone, 30) || undefined };
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const now = new Date();
  const sourced = { source: { in: [INGEST_SOURCE, ASSISTED_SOURCE] } };
  const [requests, active, notExpired, expired, hb, external] = await Promise.all([
    prisma.jobRequest.findMany({ where: { handledAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { job: { select: { id: true, salonName: true, city: true, state: true, phone: true } } } }),
    // Đếm ĐÚNG như bảng việc công khai (còn hạn + bộ lọc chữ + chỉ tài khoản thật)
    prisma.job.count({ where: { AND: [sourced, activeJobWhere(), { owner: realOnly() }] } }),
    prisma.job.count({ where: { ...sourced, expiresAt: { gt: now } } }),
    prisma.job.count({ where: { ...sourced, expiresAt: { lte: now } } }),
    ingestHeartbeat(now),
    externalJobsStatus().catch(() => null),
  ]);
  return NextResponse.json(
    { requests, active, hiddenByFilter: Math.max(0, notExpired - active), expired, ingestAccepting: hb.accepting, lastIngestAt: hb.lastAt, lastBatchAt: hb.lastBatchAt, ingestStale: hb.stale, staleHours: hb.staleHours, external },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const adminId = await admin();
  if (!adminId) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; text?: string; overrides?: unknown; posts?: unknown; requester?: { name?: unknown; contact?: unknown; requestedAt?: unknown }; requestId?: string; decision?: string };

  if (b.action === "dryrun" || b.action === "preview") {
    // Cùng đường xử lý với lúc đăng thật (bang theo mã vùng, chặn bài bán tiệm / thợ tìm việc / số bị chặn, trùng tin…)
    const input: IngestInput = { text: String(b.text || "").slice(0, 6000), ...overrides(b.overrides) };
    const prep = prepareIngest(input, await blockedPhones(), { assisted: true });
    const p = prep.parsed;
    const base = { isHiring: p.isHiring, phoneDisplay: p.phoneDisplay, salonName: p.salonName, address: p.address, city: p.city, state: p.state, zip: p.zip, salaryAmount: p.salaryAmount, salaryType: p.salaryType, skills: p.skills, benefits: p.benefits, isUrgent: p.isUrgent, title: p.title, market: p.market };
    if (prep.status === "skipped") return NextResponse.json({ ...base, decision: "skipped", reason: prep.reason });
    const d = prep.data;
    const r = await commitIngest(prep, { dryRun: true });
    return NextResponse.json({
      ...base,
      decision: r.status, reason: r.reason ?? null,
      // Giá trị SẼ lưu (sau khi áp mã vùng SĐT, bang đúng thị trường, chỉnh tay của admin)
      final: { title: d.title, salonName: d.salonName, phone: d.phone, market: d.market, state: d.state, city: d.city, salaryAmount: d.salaryAmount, salaryType: d.salaryType, skills: d.skills ? d.skills.split(",") : [], benefits: d.benefits ? d.benefits.split(",") : [], address: d.address },
    });
  }

  if (b.action === "post") {
    const posts = Array.isArray(b.posts) ? b.posts.slice(0, 50) : [];
    if (!posts.length) return NextResponse.json({ error: "Chưa có bài nào." }, { status: 400 });
    const name = s(b.requester?.name, 80);
    const contact = s(b.requester?.contact, 120);
    // "Đăng hộ theo yêu cầu của tiệm" phải ĐÚNG là có người yêu cầu → bắt buộc ghi lại ai yêu cầu, liên hệ thế nào.
    if (!name || !contact || contact.length < 6) return NextResponse.json({ error: "Nhập tên + SĐT/email người của tiệm đã nhờ đăng." }, { status: 400 });
    const reqAt = typeof b.requester?.requestedAt === "string" && Number.isFinite(Date.parse(b.requester.requestedAt)) ? new Date(b.requester.requestedAt) : new Date();
    const inputs = posts.map((p) => {
      const x = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      return { text: s(x.text, 6000), sourceUrl: s(x.sourceUrl, 300), ...overrides(x) } as IngestInput;
    });
    const out = await ingestBatch(inputs, { assisted: true });
    // Ghi người yêu cầu cho tin MỚI hoặc tiệm nhờ đăng LẠI bài mới; gửi lại đúng bài cũ ("updated") không thêm dòng trùng.
    const ids = [...new Set(out.results.filter((r) => (r.status === "created" || r.status === "bumped") && r.jobId).map((r) => r.jobId!))];
    if (ids.length) {
      await prisma.jobRequest.createMany({
        data: ids.map((jobId) => ({ jobId, kind: "assist", name, contact, note: `requestedAt=${reqAt.toISOString()} · admin=${adminId}`, userId: null, handledAt: new Date() })),
      }).catch(() => {});
    }
    return NextResponse.json(out);
  }

  if (b.action === "resolve" && b.requestId) {
    const r = await prisma.jobRequest.findUnique({ where: { id: b.requestId }, include: { job: { select: { id: true, phone: true } } } });
    if (!r) return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404 });
    if (b.decision === "remove") {
      const e164 = findPhone(r.job.phone)?.e164;
      if (e164) await blockPhone(e164); // không đăng lại số này
      await prisma.jobRequest.updateMany({ where: { jobId: r.jobId, handledAt: null }, data: { handledAt: new Date() } });
      // Giữ dòng tin (lịch sử JobRequest còn tham chiếu) nhưng XOÁ hết dữ liệu công khai của tiệm (SĐT, mô tả, địa chỉ,
      // tên tiệm, link bài gốc, ảnh) + đánh dấu "removed" → /jobs/:id trả 410, không còn trong bảng việc / thẻ chia sẻ.
      await removeJobPublicData(r.jobId);
      return NextResponse.json({ ok: true, removed: true });
    }
    if (b.decision === "claim") {
      if (!r.userId) return NextResponse.json({ error: "Người gửi chưa đăng nhập — nhờ họ đăng ký tài khoản chủ tiệm rồi gửi lại khi đã đăng nhập." }, { status: 400 });
      const u = await prisma.user.findUnique({ where: { id: r.userId }, select: { role: true } });
      if (u?.role !== "OWNER") return NextResponse.json({ error: "Tài khoản người gửi không phải chủ tiệm." }, { status: 400 });
      // Thành tin tự đăng của chủ tiệm: hạn 30 ngày như mọi tin tự đăng (gia hạn được)
      await prisma.job.update({ where: { id: r.jobId }, data: { ownerId: r.userId, source: null, sourceKey: null, expiresAt: new Date(Date.now() + jobTtlDays() * 86_400_000) } });
      await prisma.jobRequest.update({ where: { id: r.id }, data: { handledAt: new Date() } });
      return NextResponse.json({ ok: true, claimed: true });
    }
    await prisma.jobRequest.update({ where: { id: r.id }, data: { handledAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
}
