import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem thông tin cá nhân." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        bio: true,
        skills: true,
        cvUrl: true,
        pawCoin: true,
        reputation: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("GET user profile error:", error);
    return NextResponse.json(
      { error: "Không thể lấy thông tin người dùng." },
      { status: 500 }
    );
  }
}
