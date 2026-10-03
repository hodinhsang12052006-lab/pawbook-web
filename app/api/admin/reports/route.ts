import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

// GET /api/admin/reports — danh sách báo cáo vi phạm, chỉ ADMIN (xác minh
// trong DB, không tin role trong JWT). Trước đây báo cáo được lưu nhưng không
// có nơi nào xem — App Store yêu cầu app có nội dung người dùng phải xử lý
// được báo cáo.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    if (me?.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập trang này." }, { status: 403 });
    }

    const reports = await prisma.userReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        reporter: { select: { id: true, name: true, avatarUrl: true } },
        reportedUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            _count: { select: { reportsReceived: true } },
          },
        },
      },
    });

    return NextResponse.json(
      reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        reporter: r.reporter,
        reportedUser: {
          id: r.reportedUser.id,
          name: r.reportedUser.name,
          avatarUrl: r.reportedUser.avatarUrl,
          role: r.reportedUser.role,
          totalReports: r.reportedUser._count.reportsReceived,
        },
      }))
    );
  } catch (error) {
    console.error("GET /api/admin/reports error:", error);
    return NextResponse.json({ error: "Không thể tải danh sách báo cáo." }, { status: 500 });
  }
}
