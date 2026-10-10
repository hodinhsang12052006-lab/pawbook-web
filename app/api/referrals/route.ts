import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { SITE_URL } from "@/lib/siteUrl";
import { AMBASSADOR_MIN } from "@/lib/referral";

// GET /api/referrals — link mời của mình + những ai đã tham gia nhờ link đó.
export async function GET() {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [count, recent] = await Promise.all([
    prisma.user.count({ where: { referredById: me } }),
    prisma.user.findMany({
      where: { referredById: me },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, avatarUrl: true, role: true, createdAt: true },
    }),
  ]);
  return NextResponse.json(
    { link: `${SITE_URL}/?ref=${me}`, count, ambassadorAt: AMBASSADOR_MIN, recent },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
