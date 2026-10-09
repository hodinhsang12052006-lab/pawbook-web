import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { geminiEnabled } from "@/lib/gemini";
import { dailyLimit, generateDesigns, storageReady } from "@/lib/aiDesigns";
import { sendPush } from "@/lib/push";

// Vercel Cron gọi mỗi sáng (vercel.json) → tạo loạt mẫu nháp, báo admin vào duyệt.
// Bảo vệ bằng CRON_SECRET: Vercel tự gửi "Authorization: Bearer <CRON_SECRET>".
// Không có CRON_SECRET → từ chối mọi lời gọi (không ai gọi ngoài được để đốt tiền AI).
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!geminiEnabled()) return NextResponse.json({ skipped: "GEMINI_API_KEY chưa cấu hình" });
  if (!storageReady()) return NextResponse.json({ skipped: "Chưa có Cloudinary để lưu ảnh" });
  try {
    const r = await generateDesigns("US", Math.ceil(dailyLimit() / 2));
    if (r.created.length) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await sendPush(admins.map((a) => a.id), {
        title: "🎨 Mẫu nail AI mới chờ duyệt",
        body: `${r.created.length} mẫu mới — vào Phòng nội dung để duyệt trước khi hiện cho mọi người.`,
        url: "/admin/studio#mau-ai",
        tag: "pn-ai-designs",
      });
    }
    return NextResponse.json(r);
  } catch (err) {
    console.error("cron designs error:", err);
    return NextResponse.json({ error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
