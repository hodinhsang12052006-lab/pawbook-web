import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// Statuses the HR Dashboard Kanban board can move a card between. PENDING is
// intentionally not a drop target here — it's the legacy default set by a
// candidate's own self-apply flow; the board only manages the
// match-forward stages.
const VALID_STATUSES = ["MATCHED", "INTERVIEW", "HIRED", "REJECTED"];

// Drag-and-drop status update for the HR Dashboard Kanban board. The prior
// hr-management table page updated status in local React state only and
// never persisted it — this is the first real persistence for application
// status changes.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id;
    const { id } = await params;

    const body = await req.json();
    const { status } = body;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!application) {
      return NextResponse.json({ error: "Không tìm thấy đơn ứng tuyển." }, { status: 404 });
    }
    if (application.job.employerId !== userId) {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa đơn này." }, { status: 403 });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update application status error:", error);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống." }, { status: 500 });
  }
}
