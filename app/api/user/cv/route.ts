import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem thông tin." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        cvUrl: true,
      },
    });

    return NextResponse.json({ cvUrl: user?.cvUrl || null });
  } catch (error: any) {
    console.error("GET user CV error:", error);
    return NextResponse.json(
      { error: "Không thể lấy thông tin CV của người dùng." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện tác vụ này." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin định danh người dùng." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { cvUrl } = body;

    if (!cvUrl) {
      return NextResponse.json(
        { error: "Đường dẫn CV không được để trống." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        cvUrl,
      },
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    return NextResponse.json({
      message: "Cập nhật CV thành công!",
      user: userWithoutPassword,
    });
  } catch (error: any) {
    console.error("Update user CV error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi cập nhật CV." },
      { status: 500 }
    );
  }
}
