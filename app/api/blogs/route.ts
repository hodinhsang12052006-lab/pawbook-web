import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    let posts = await prisma.blogPost.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            isVerified: true,
            trustScore: true,
          },
        },
        linkedJob: {
          select: {
            id: true,
            title: true,
            companyName: true,
            salary: true,
          },
        },
        linkedService: {
          select: {
            id: true,
            name: true,
            category: true,
            contactInfo: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (posts.length === 0) {
      const crawlerEmail = "crawler@pawbook.vn";
      let crawlerUser = await prisma.user.findUnique({
        where: { email: crawlerEmail },
      });

      if (crawlerUser) {
        const job = await prisma.job.findFirst();
        const service = await prisma.service.findFirst();

        await prisma.blogPost.create({
          data: {
            title: "Kinh nghiệm mở tiệm Spa và thu hút 500 khách hàng đầu tiên",
            content: "Mở tiệm spa tại các khu đô thị lớn đòi hỏi sự chuẩn bị kĩ lưỡng về tay nghề massage trị liệu và phác đồ dịch vụ. Bài viết này chia sẻ cách tối ưu hóa chi phí mặt bằng và chạy quảng cáo Facebook hiệu quả. Đặc biệt, khách hàng có thể tham khảo dịch vụ uy tín ngay bên dưới.",
            authorId: crawlerUser.id,
            linkedServiceId: service ? service.id : null,
            upvotes: 24,
          },
        });

        await prisma.blogPost.create({
          data: {
            title: "Làm thế nào để trở thành Automation Specialist lương cao?",
            content: "Các dự án MMO ngày nay yêu cầu tự động hóa cực kỳ lớn để tăng hiệu quả. Nếu bạn thành thạo Python, Puppeteer hoặc Selenium, cơ hội nhận job thầu rất cao. Hãy xem chi tiết việc làm tuyển dụng mà dự án chúng tôi đang triển khai ngay bên dưới.",
            authorId: crawlerUser.id,
            linkedJobId: job ? job.id : null,
            upvotes: 18,
          },
        });

        posts = await prisma.blogPost.findMany({
          include: {
            author: {
              select: { id: true, name: true, avatarUrl: true, role: true, isVerified: true, trustScore: true },
            },
            linkedJob: {
              select: { id: true, title: true, companyName: true, salary: true },
            },
            linkedService: {
              select: { id: true, name: true, category: true, contactInfo: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error("GET blogs API error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách bài viết blog." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng bài viết." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { title, content, linkedJobId, linkedServiceId } = body;

    if (!title || !content || !content.trim()) {
      return NextResponse.json(
        { error: "Tiêu đề và nội dung bài viết không được để trống." },
        { status: 400 }
      );
    }

    const newPost = await prisma.blogPost.create({
      data: {
        title,
        content,
        authorId: userId,
        linkedJobId: linkedJobId || null,
        linkedServiceId: linkedServiceId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            isVerified: true,
            trustScore: true,
          },
        },
        linkedJob: {
          select: { id: true, title: true, companyName: true },
        },
        linkedService: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    return NextResponse.json(newPost, { status: 201 });
  } catch (error: any) {
    console.error("POST blog API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi thêm bài viết mới." },
      { status: 500 }
    );
  }
}
