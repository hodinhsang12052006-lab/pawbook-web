import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện cập nhật ảnh đại diện." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { avatarUrl } = body;

    if (!avatarUrl) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đường dẫn ảnh đại diện mới." },
        { status: 400 }
      );
    }

    // Direct database write to user record
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: avatarUrl,
      },
    });

    return NextResponse.json({
      message: "Cập nhật ảnh đại diện vào cơ sở dữ liệu thành công! 🖼️",
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Update avatar API error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi cập nhật ảnh đại diện." },
      { status: 500 }
    );
  }
}
