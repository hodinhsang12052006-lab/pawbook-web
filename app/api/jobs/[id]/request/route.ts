import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { emailEnabled, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/siteUrl";

// POST { kind: "claim"|"remove", name, contact, note? } — tiệm xin NHẬN hoặc GỠ tin PawNail đăng hộ.
// Lưu yêu cầu (admin xử lý ở Studio) + báo email hỗ trợ. Không đổi gì trên tin ngay (tránh người lạ gỡ bậy).
const HOUR = 3_600_000;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ipKey = `job-req:${getClientIp(req)}`;
  if (isRateLimited(ipKey, 5, HOUR)) return NextResponse.json({ error: "Bạn đã gửi nhiều yêu cầu — thử lại sau 1 giờ." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { kind?: unknown; name?: unknown; contact?: unknown; note?: unknown } | null;
  const kind = b?.kind === "claim" || b?.kind === "remove" ? b.kind : null;
  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 80) : "";
  const contact = typeof b?.contact === "string" ? b.contact.trim().slice(0, 120) : "";
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 500) : "";
  if (!kind || !name || contact.length < 6) return NextResponse.json({ error: "Nhập tên và SĐT/email để PawNail liên hệ lại." }, { status: 400 });
  const job = await prisma.job.findUnique({ where: { id }, select: { id: true, source: true, salonName: true, city: true, state: true, phone: true } });
  if (!job || !job.source) return NextResponse.json({ error: "Không tìm thấy tin." }, { status: 404 });
  recordAttempt(ipKey, HOUR);
  const userId = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id ?? null;
  await prisma.jobRequest.create({ data: { jobId: job.id, kind, name, contact, note: note || null, userId } });
  const to = process.env.SUPPORT_INBOX || "support@bitpawos.com";
  if (emailEnabled()) {
    const what = kind === "remove" ? "GỠ TIN" : "NHẬN TIN";
    await sendEmail(
      to,
      `[PawNail] Yêu cầu ${what}: ${job.salonName} (${job.city}, ${job.state})`,
      `<p><b>${what}</b> — ${esc(job.salonName)}, ${esc(job.city)} ${esc(job.state)} · SĐT trên tin: ${esc(job.phone)}</p><p>Người gửi: ${esc(name)} · Liên hệ: ${esc(contact)}${userId ? ` · tài khoản ${esc(userId)}` : ""}</p>${note ? `<p>Ghi chú: ${esc(note)}</p>` : ""}<p><a href="${SITE_URL}/jobs/${job.id}">Xem tin</a> · xử lý ở Admin → Studio</p>`,
      `${what} — ${job.salonName}, ${job.city} ${job.state} · SĐT tin: ${job.phone}\nNgười gửi: ${name} · ${contact}\n${note}\n${SITE_URL}/jobs/${job.id}`,
    ).catch((e) => console.error("job request email:", e));
  }
  return NextResponse.json({ ok: true });
}
