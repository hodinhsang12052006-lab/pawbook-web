import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { DEMO_EMAIL_SUFFIX, realUserWhere } from "@/lib/demo";
import { INGEST_OWNER_EMAIL, INGEST_SOURCE } from "@/lib/jobIngest/ingest";

// GET — "Sức khoẻ tăng trưởng" cho admin: chỉ SỐ ĐẾM tổng hợp, không lộ thông tin cá nhân.
// Người dùng thật = loại tài khoản mẫu (@pawnailjobs.demo) và admin.
export async function GET() {
  const id = (await getServerSession(authOptions))?.user?.id;
  if (!id) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (me?.role !== Role.ADMIN) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });

  const d7 = new Date(Date.now() - 7 * 86_400_000);
  const real = { ...realUserWhere, role: { not: Role.ADMIN }, email: { not: INGEST_OWNER_EMAIL } }; // bỏ tài khoản hệ thống "Tin tổng hợp"
  const demo = { email: { endsWith: DEMO_EMAIL_SUFFIX } };
  const n = (p: Promise<number>) => p.catch(() => 0);
  const [techs, owners, new7, msg7, senders7, posts7, jobs7, digestOn, digestSent7, invited, invited7, installed, demoUsers, demoJobs, demoPosts, drafts, published, noImage, ingestActive, ingestRequests] = await Promise.all([
    n(prisma.user.count({ where: { ...real, role: Role.TECHNICIAN } })),
    n(prisma.user.count({ where: { ...real, role: Role.OWNER } })),
    n(prisma.user.count({ where: { ...real, createdAt: { gte: d7 } } })),
    n(prisma.message.count({ where: { createdAt: { gte: d7 }, sender: real } })),
    prisma.message.findMany({ where: { createdAt: { gte: d7 }, sender: real }, distinct: ["senderId"], select: { senderId: true } }).then((r) => r.length).catch(() => 0),
    n(prisma.post.count({ where: { createdAt: { gte: d7 }, author: real } })),
    n(prisma.job.count({ where: { createdAt: { gte: d7 }, owner: real } })),
    n(prisma.user.count({ where: { ...real, emailDigest: true } })),
    n(prisma.user.count({ where: { ...real, lastDigestAt: { gte: d7 } } })),
    n(prisma.user.count({ where: { ...real, referredById: { not: null } } })),
    n(prisma.user.count({ where: { ...real, referredById: { not: null }, createdAt: { gte: d7 } } })),
    n(prisma.user.count({ where: { ...real, pwaInstalledAt: { not: null } } })),
    n(prisma.user.count({ where: demo })),
    n(prisma.job.count({ where: { owner: demo } })),
    n(prisma.post.count({ where: { author: demo } })),
    n(prisma.nailDesign.count({ where: { status: "draft" } })),
    n(prisma.nailDesign.count({ where: { status: "published" } })),
    n(prisma.nailDesign.count({ where: { status: "draft", OR: [{ imageUrl: null }, { imageUrl: "" }] } })),
    n(prisma.job.count({ where: { source: INGEST_SOURCE, expiresAt: { gt: new Date() } } })),
    n(prisma.jobRequest.count({ where: { handledAt: null } })),
  ]);
  const total = techs + owners;
  return NextResponse.json(
    {
      users: { total, techs, owners, new7 },
      active7: { senders: senders7, messages: msg7, posts: posts7, jobs: jobs7 },
      email: { digestOn, unsubscribed: total - digestOn, processed7: digestSent7 },
      referral: { invited, invited7 },
      install: { installed },
      demo: { users: demoUsers, jobs: demoJobs, posts: demoPosts },
      designs: { drafts, published, noImage },
      ingest: { active: ingestActive, pendingRequests: ingestRequests },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
