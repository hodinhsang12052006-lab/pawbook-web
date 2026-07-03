import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem thông báo." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error("GET notifications API error:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải danh sách thông báo." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json().catch(() => ({}));
    const { id, markAll } = body;

    if (markAll) {
      // Mark all user notifications as read
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ message: "Đã đánh dấu đọc toàn bộ thông báo." });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Thiếu thông tin mã thông báo (id)." },
        { status: 400 }
      );
    }

    // Mark single notification as read
    const updated = await prisma.notification.update({
      where: { id, userId },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH notifications API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi cập nhật thông báo." },
      { status: 500 }
    );
  }
}
