import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function DELETE(
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

    const { id: serviceId } = await params;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Không tìm thấy gian hàng/dịch vụ này." },
        { status: 404 }
      );
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    // Notify owner of deleted service if possible
    await prisma.notification.create({
      data: {
        userId: service.ownerId,
        title: "Gian hàng bị xóa 🚫",
        message: `Gian hàng "${service.name}" của bạn đã bị gỡ bỏ khỏi sàn bởi Ban Quản Trị do vi phạm nội quy.`,
        type: "SYSTEM",
      },
    }).catch(() => {});

    return NextResponse.json({
      message: `Đã xóa gian hàng "${service.name}" thành công.`,
    });
  } catch (error: any) {
    console.error("Delete service API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi xóa gian hàng." },
      { status: 500 }
    );
  }
}
