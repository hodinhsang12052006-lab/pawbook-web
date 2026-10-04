import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getJobHeat, isHot } from "@/lib/jobStats";
import { getResponseStats, describeResponse } from "@/lib/responseTime";

const FIRST_VIEWERS = 10;
const FRESH_MS = 48 * 60 * 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id },
      // KHÔNG select `phone` của owner — đây là endpoint công khai (không
      // yêu cầu đăng nhập). SĐT liên hệ thật cho tin này là `job.phone` (cột
      // riêng, chủ tiệm cố tình để công khai lúc đăng tin, dùng cho nút "Gọi
      // ngay"). `owner.phone` là SĐT TÀI KHOẢN — trang chi tiết tin
      // (app/jobs/[id]/page.tsx) không hề đọc field này, chỉ đọc job.phone —
      // để lọt qua đây chỉ là lộ thêm PII vô ích, không phục vụ chức năng gì.
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Tin tuyển dụng không tồn tại." },
        { status: 404 }
      );
    }

    const [heatMap, response, saveCount] = await Promise.all([
      getJobHeat([job.id]),
      getResponseStats(job.ownerId),
      prisma.savedJob.count({ where: { jobId: job.id } }),
    ]);
    const h = heatMap.get(job.id);
    const fresh = Date.now() - job.createdAt.getTime() < FRESH_MS;

    return NextResponse.json({
      ...job,
      saveCount,
      heat: {
        viewsToday: h?.viewsToday ?? 0,
        contacts7d: h?.contacts7d ?? 0,
        hot: isHot(h),
        // Tin mới < 48h và chưa tới 10 lượt xem (thiết bị/ngày) → người xem
        // này THẬT SỰ nằm trong nhóm đầu tiên thấy tin.
        firstViewers: fresh && (h?.viewsTotal ?? 0) < FIRST_VIEWERS ? FIRST_VIEWERS : null,
      },
      // Thời gian phản hồi THẬT của chủ tiệm (trung vị ≥3 lượt) — null khi chưa đủ dữ liệu.
      ownerResponse: response
        ? { label: describeResponse(response.medianMinutes), fast: response.medianMinutes <= 60, samples: response.samples }
        : null,
      skills: job.skills ? job.skills.split(",").filter(Boolean) : [],
      benefits: job.benefits ? job.benefits.split(",").filter(Boolean) : [],
      createdAt: job.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Fetch job detail API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy chi tiết tin tuyển dụng." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const job = await prisma.job.findUnique({ where: { id }, select: { ownerId: true } });
    const isOwner = job?.ownerId === (session.user as any).id;
    const isAdmin = (session.user as any).role === "ADMIN";

    if (!job) {
      return NextResponse.json({ error: "Tin tuyển dụng không tồn tại." }, { status: 404 });
    }
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Bạn không có quyền xóa tin này." }, { status: 403 });
    }

    await prisma.job.delete({ where: { id } });

    return NextResponse.json({ message: "Xóa tin tuyển dụng thành công!" });
  } catch (error: any) {
    console.error("Delete job API error:", error);
    return NextResponse.json(
      { error: "Không thể xóa tin. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
