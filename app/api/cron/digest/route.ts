import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { emailEnabled, sendEmail } from "@/lib/email";
import { buildDigest, unsubUrl, type DigestUser } from "@/lib/digest";

// Vercel Cron mỗi ngày (vercel.json): gửi email tóm tắt cho người đã 7 ngày chưa nhận.
// Chia đều cả tuần → mỗi ngày tối đa DIGEST_CAP thư (gói Resend miễn phí 100 thư/ngày).
// Không có gì mới → không gửi, nhưng vẫn đánh dấu để tuần sau mới xét lại.
export const maxDuration = 60;
const DAY = 86_400_000;
const DIGEST_CAP = 80;

export async function GET(req: Request) {
  const deadline = Date.now() + 54_000;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailEnabled()) return NextResponse.json({ ok: false, error: "email disabled" });
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: {
      emailDigest: true,
      role: { in: ["TECHNICIAN", "OWNER"] },
      createdAt: { lt: new Date(now - 2 * DAY) },
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now - 7 * DAY + 3_600_000) } }],
    },
    orderBy: { lastDigestAt: { sort: "asc", nulls: "first" } },
    take: DIGEST_CAP,
    select: { id: true, name: true, email: true, role: true, market: true, state: true, city: true },
  });
  let sent = 0, skipped = 0;
  const errors: string[] = [];
  for (const u of users) {
    if (Date.now() > deadline) break;
    const email = (u.email || "").toLowerCase();
    const fake = !email.includes("@") || email.endsWith(".test") || email.endsWith("@pawnailjobs.demo");
    try {
      const d = fake ? null : await buildDigest(u as DigestUser);
      if (d) {
        await sendEmail(u.email, d.subject, d.html, d.text, {
          "List-Unsubscribe": `<${unsubUrl(u.id)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        });
        sent++;
      } else skipped++;
      await prisma.user.update({ where: { id: u.id }, data: { lastDigestAt: new Date() } });
    } catch (e) {
      errors.push(String((e as Error).message).slice(0, 120));
      if (/Resend 429|daily/i.test(String(e))) break; // hết hạn mức hôm nay → mai gửi tiếp
    }
  }
  return NextResponse.json({ ok: true, candidates: users.length, sent, skipped, errors: errors.slice(0, 5) });
}
