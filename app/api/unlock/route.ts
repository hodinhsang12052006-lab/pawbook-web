import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

// GET /api/unlock?technicianUserId=xxx — chủ tiệm kiểm tra đã mở khóa liên
// hệ với thợ này chưa, để quyết định hiện thẳng nút "Nhắn tin" hay bật
// UnlockChatModal trước.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const technicianUserId = req.nextUrl.searchParams.get("technicianUserId");
    if (!technicianUserId) {
      return NextResponse.json({ error: "Thiếu technicianUserId." }, { status: 400 });
    }

    const unlock = await prisma.unlockContact.findUnique({
      where: {
        ownerId_technicianUserId: {
          ownerId: session.user.id,
          technicianUserId,
        },
      },
    });

    return NextResponse.json({ unlocked: !!unlock, unlockedAt: unlock?.unlockedAt ?? null });
  } catch (err) {
    console.error("GET /api/unlock error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi kiểm tra trạng thái mở khóa." }, { status: 500 });
  }
}

// POST /api/unlock — chủ tiệm hoàn tất khảo sát chuyên sâu trong
// UnlockChatModal, lưu bản ghi mở khóa vĩnh viễn cho cặp (owner, thợ) này.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    if (session.user.role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Chỉ tài khoản Chủ tiệm mới có thể mở khóa liên hệ thợ." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { technicianUserId, deepSurveyAnswers, hiringTimeline } = body;

    if (!technicianUserId) {
      return NextResponse.json({ error: "Thiếu technicianUserId." }, { status: 400 });
    }
    if (technicianUserId === session.user.id) {
      return NextResponse.json({ error: "Không thể tự mở khóa liên hệ với chính mình." }, { status: 400 });
    }

    const technician = await prisma.user.findUnique({
      where: { id: technicianUserId },
      select: { id: true, role: true },
    });
    if (!technician || technician.role !== Role.TECHNICIAN) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ thợ này." }, { status: 404 });
    }

    // Idempotent theo đúng yêu cầu "không bắt họ làm lại lần thứ 2 với cùng
    // một thợ" — nếu đã mở khóa rồi thì trả về bản ghi cũ luôn, không tạo
    // trùng (và không ghi đè khảo sát lần đầu bằng dữ liệu rỗng nếu lỡ gọi
    // lại API mà không qua UI).
    const unlock = await prisma.unlockContact.upsert({
      where: {
        ownerId_technicianUserId: {
          ownerId: session.user.id,
          technicianUserId,
        },
      },
      update: {},
      create: {
        ownerId: session.user.id,
        technicianUserId,
        deepSurveyAnswers: Array.isArray(deepSurveyAnswers) ? JSON.stringify(deepSurveyAnswers) : null,
        hiringTimeline: hiringTimeline || null,
      },
    });

    return NextResponse.json({ unlocked: true, unlockedAt: unlock.unlockedAt }, { status: 201 });
  } catch (err) {
    console.error("POST /api/unlock error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi mở khóa liên hệ." }, { status: 500 });
  }
}
