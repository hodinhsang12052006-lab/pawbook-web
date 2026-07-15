import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json(
        { error: "Từ chối truy cập. Quyền Quản trị viên cấp cao yêu cầu." },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng." },
        { status: 404 }
      );
    }

    if (user.role === "ADMIN") {
      return NextResponse.json(
        { error: "Không thể khóa/ban một tài khoản Admin khác." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: false,
        trustScore: 0.0,
      },
    });

    // Create system notification for banned user
    await prisma.notification.create({
      data: {
        userId,
        title: "Tài khoản bị kỷ luật ⚠️",
        message: "Tài khoản của bạn đã bị khóa/hạ thấp mức tín nhiệm về 0 bởi Quản trị viên do vi phạm quy chế hoạt động.",
        type: "SYSTEM",
      },
    }).catch(() => {});

    return NextResponse.json({
      message: `Đã khóa/ban tài khoản ${updatedUser.name} thành công.`,
      user: {
        id: updatedUser.id,
        isVerified: updatedUser.isVerified,
        trustScore: updatedUser.trustScore,
      },
    });
  } catch (error: any) {
    console.error("Ban user API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi ban người dùng." },
      { status: 500 }
    );
  }
}
