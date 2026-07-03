import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem thông tin bảng lương." },
        { status: 401 }
      );
    }

    let payrolls = await prisma.payroll.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Auto-seed payrolls if DB is empty
    if (payrolls.length === 0) {
      const users = await prisma.user.findMany({
        take: 4,
      });

      if (users.length > 0) {
        const baseSalaries = [45000000, 20000000, 18000000, 25000000];
        const bonuses = [12500000, 5000000, 24000000, 8000000];

        const seedPromises = users.map((u, i) => {
          const base = baseSalaries[i % baseSalaries.length];
          const bon = bonuses[i % bonuses.length];
          return prisma.payroll.create({
            data: {
              userId: u.id,
              baseSalary: base,
              bonus: bon,
              total: base + bon,
              status: "UNPAID",
            },
          });
        });

        await Promise.all(seedPromises);

        // Fetch again with seeded data
        payrolls = await prisma.payroll.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      }
    }

    return NextResponse.json(payrolls);
  } catch (error: any) {
    console.error("GET payrolls error:", error);
    return NextResponse.json(
      { error: "Không thể lấy thông tin bảng lương." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện thanh toán lương." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { payrollId, all } = body;

    if (all) {
      // Approve all unpaid payrolls
      const updated = await prisma.payroll.updateMany({
        where: {
          status: "UNPAID",
        },
        data: {
          status: "PAID",
          paymentDate: new Date(),
        },
      });
      return NextResponse.json({ message: "Duyệt chi toàn bộ bảng lương thành công!", count: updated.count });
    }

    if (!payrollId) {
      return NextResponse.json(
        { error: "Mã bảng lương không hợp lệ." },
        { status: 400 }
      );
    }

    const updatedPayroll = await prisma.payroll.update({
      where: {
        id: payrollId,
      },
      data: {
        status: "PAID",
        paymentDate: new Date(),
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: `Duyệt chi lương thành công cho nhân viên ${updatedPayroll.user.name}!`,
      payroll: updatedPayroll,
    });
  } catch (error: any) {
    console.error("POST payroll error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi duyệt chi lương." },
      { status: 500 }
    );
  }
}
