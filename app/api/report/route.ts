import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST /api/report — báo cáo 1 người dùng. Chỉ lưu lại cho đội ngũ vận
// hành xem xét thủ công (Apple Guideline 1.2 yêu cầu có cơ chế báo cáo cho
// UGC, không bắt buộc phải tự động xử lý).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const { userId, reason } = await req.json();
    if (!userId || !reason || !String(reason).trim()) {
      return NextResponse.json({ error: "Vui lòng nhập lý do báo cáo." }, { status: 400 });
    }
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Không thể tự báo cáo chính mình." }, { status: 400 });
    }

    await prisma.userReport.create({
      data: {
        reporterId: session.user.id,
        reportedUserId: userId,
        reason: String(reason).trim().slice(0, 1000),
      },
    });

    return NextResponse.json({ reported: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/report error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi gửi báo cáo." }, { status: 500 });
  }
}
