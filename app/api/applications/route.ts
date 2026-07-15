import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem danh sách ứng tuyển." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    let whereClause = {};

    if (userRole === "EMPLOYER") {
      whereClause = {
        job: {
          employerId: userId,
        },
      };
    } else if (userRole === "USER") {
      whereClause = {
        applicantId: userId,
      };
    }

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
            skills: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            companyName: true,
            employerId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json(applications);
  } catch (error: any) {
    console.error("Fetch applications API error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách đơn ứng tuyển." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để nộp đơn ứng tuyển." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin ứng viên." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { jobId, cvUrl, applicantId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Thông tin công việc không được trống." },
        { status: 400 }
      );
    }

    // Employer-initiated match: swiping right on a candidate card (candidates
    // topic in /candidates) has no "self-apply" semantics — the employer is
    // choosing a candidate for one of THEIR jobs, not applying to their own
    // posting. This branch creates the Application on the candidate's behalf.
    // It intentionally skips the PawCoin anti-spam charge below (that fee
    // models a candidate paying to apply, not an employer's own action).
    if (applicantId) {
      const userRole = (session.user as any).role;
      if (userRole !== "EMPLOYER") {
        return NextResponse.json(
          { error: "Chỉ nhà tuyển dụng mới có thể chủ động match ứng viên." },
          { status: 403 }
        );
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        return NextResponse.json({ error: "Công việc không tồn tại." }, { status: 404 });
      }
      if (job.employerId !== userId) {
        return NextResponse.json({ error: "Bạn không sở hữu tin tuyển dụng này." }, { status: 403 });
      }

      const applicant = await prisma.user.findUnique({
        where: { id: applicantId },
        select: { cvUrl: true, cv_url: true },
      });
      if (!applicant) {
        return NextResponse.json({ error: "Ứng viên không tồn tại." }, { status: 404 });
      }

      const existingMatch = await prisma.application.findFirst({
        where: { applicantId, jobId },
      });
      if (existingMatch) {
        return NextResponse.json({ error: "Bạn đã match với ứng viên này cho vị trí đó rồi." }, { status: 400 });
      }

      const application = await prisma.application.create({
        data: {
          applicantId,
          jobId,
          cvUrl: applicant.cvUrl || applicant.cv_url || "Chưa cập nhật CV",
          status: "MATCHED",
        },
        include: {
          job: true,
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
              bio: true,
              skills: true,
            },
          },
        },
      });

      return NextResponse.json(application, { status: 201 });
    }

    if (!cvUrl) {
      return NextResponse.json(
        { error: "Thông tin CV không được trống." },
        { status: 400 }
      );
    }

    // 1. Fetch user to check coin balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pawCoin: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    if (user.pawCoin < 5) {
      return NextResponse.json(
        { error: `Số dư ví không đủ để ứng tuyển (Yêu cầu 5 PawCoin phí chống spam, hiện có ${user.pawCoin} PawCoin).` },
        { status: 400 }
      );
    }

    // 2. Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Công việc tuyển dụng này không tồn tại." },
        { status: 404 }
      );
    }

    // 3. Check for duplicate applications
    const existingApplication = await prisma.application.findFirst({
      where: {
        applicantId: userId,
        jobId,
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        { error: "Bạn đã nộp hồ sơ cho vị trí này rồi." },
        { status: 400 }
      );
    }

    // 4. Create Application and charge 5 PawCoins in a transaction with ledger and notification logs
    const [application] = await prisma.$transaction([
      prisma.application.create({
        data: {
          applicantId: userId,
          jobId,
          cvUrl,
          status: "PENDING",
        },
        include: {
          job: true,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pawCoin: { decrement: 5 } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: -5,
          type: "EXPENSE",
          description: `Phí nộp hồ sơ ứng tuyển: "${job.title.substring(0, 20)}..."`,
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          title: "Trừ PawCoin 💸",
          message: `Khấu trừ 5 PawCoin phí nộp hồ sơ ứng tuyển cho công việc "${job.title.substring(0, 25)}...".`,
          type: "WALLET",
          link: "/profile",
        },
      }),
    ]);

    return NextResponse.json(application, { status: 201 });
  } catch (error: any) {
    console.error("Create application API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi nộp đơn ứng tuyển." },
      { status: 500 }
    );
  }
}
