import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { geminiEnabled } from "@/lib/gemini";
import { dailyLimit, generateDesigns, generateEngine } from "@/lib/aiDesigns";
import { sendPush } from "@/lib/push";

// Vercel Cron gọi mỗi sáng (vercel.json) → tạo loạt mẫu nháp, báo admin vào duyệt.
// Mặc định dùng MÁY TẠO MẪU PAWNAIL (0đ, không phụ thuộc AI ngoài). Muốn dùng
// Gemini: đặt DESIGNS_SOURCE=gemini (+ GEMINI_API_KEY) trên Vercel.
const CRON_ENGINE_COUNT = 4;
// Bảo vệ bằng CRON_SECRET: Vercel tự gửi "Authorization: Bearer <CRON_SECRET>".
// Không có CRON_SECRET → từ chối mọi lời gọi (không ai gọi ngoài được để đốt tiền AI).
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const useGemini = process.env.DESIGNS_SOURCE === "gemini" && geminiEnabled();
  try {
    const day = new Date().toISOString().slice(0, 10);
    // Chạy lại trong ngày không tạo thêm: đã đủ mẫu PawNail hôm nay thì thôi.
    const already = useGemini ? 0 : await prisma.nailDesign.count({ where: { day, provider: "pawnail" } });
    const r = useGemini
      ? await generateDesigns("US", Math.ceil(dailyLimit() / 2))
      : already >= CRON_ENGINE_COUNT
        ? { created: [] as string[], skipped: CRON_ENGINE_COUNT, errors: ["Hôm nay đã có mẫu mới."] }
        : await generateEngine("US", CRON_ENGINE_COUNT - already);
    if (r.created.length) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await sendPush(admins.map((a) => a.id), {
        title: useGemini ? "🎨 Mẫu nail AI mới chờ duyệt" : "🎨 Mẫu nail mới chờ duyệt",
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
