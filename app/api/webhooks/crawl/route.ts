import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    // 1. Verify crawler security key
    const crawlerKey = req.headers.get("x-crawler-key");
    const configuredKey = process.env.CRAWLER_KEY || "pawbook-crawler-secret-key-123";

    if (!crawlerKey || crawlerKey !== configuredKey) {
      return NextResponse.json(
        { error: "Khóa bảo mật crawler không chính xác hoặc bị từ chối truy cập." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { services, jobs } = body;

    if ((!services || !Array.isArray(services)) && (!jobs || !Array.isArray(jobs))) {
      return NextResponse.json(
        { error: "Payload không hợp lệ. Vui lòng cung cấp danh sách services hoặc jobs dưới dạng mảng." },
        { status: 400 }
      );
    }

    // 2. Resolve default system crawler user owner
    const crawlerEmail = "crawler@pawbook.vn";
    let crawlerUser = await prisma.user.findUnique({
      where: { email: crawlerEmail },
      select: { id: true },
    });

    if (!crawlerUser) {
      const dummyPassword = await bcrypt.hash("pawbook-crawler-bot-internal-pass-123456", 10);
      crawlerUser = await prisma.user.create({
        data: {
          name: "PawBook Crawler Engine",
          email: crawlerEmail,
          password: dummyPassword,
          role: "EMPLOYER",
          isVerified: true,
          trustScore: 4.9,
          avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&auto=format&fit=crop&q=80",
          bio: "Hệ thống Crawler Bot tự động thu thập và đồng bộ hóa các việc làm, dịch vụ spa, địa điểm nổi bật toàn quốc.",
          pawCoin: 9999,
          reputation: 99,
        },
      });
    }

    let createdServicesCount = 0;
    let createdJobsCount = 0;

    // 3. Batch inject services
    if (services && Array.isArray(services)) {
      for (const service of services) {
        if (!service.name) continue;
        await prisma.service.create({
          data: {
            name: service.name,
            category: service.category || "Spa & Làm đẹp",
            description: service.description || "Gian hàng được đồng bộ tự động từ hệ thống.",
            location: service.location || "Chưa cập nhật địa chỉ",
            contactInfo: service.contactInfo || "Chưa cập nhật SĐT",
            priceRange: service.priceRange || "Thỏa thuận",
            rating: service.rating ? parseFloat(service.rating) : 5.0,
            imageUrl: service.imageUrl || "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=500&auto=format&fit=crop&q=80",
            ownerId: crawlerUser.id,
          },
        });
        createdServicesCount++;
      }
    }

    // 4. Batch inject jobs
    if (jobs && Array.isArray(jobs)) {
      for (const job of jobs) {
        if (!job.title || !job.companyName) continue;
        await prisma.job.create({
          data: {
            title: job.title,
            description: job.description || "Công việc được thu thập tự động.",
            salary: job.salary || "Thỏa thuận",
            companyName: job.companyName,
            employerId: crawlerUser.id,
          },
        });
        createdJobsCount++;
      }
    }

    return NextResponse.json({
      message: "Đồng bộ hóa dữ liệu cào hoàn tất thành công!",
      servicesImported: createdServicesCount,
      jobsImported: createdJobsCount,
      ownerEmail: crawlerEmail,
    });
  } catch (error: any) {
    console.error("Crawler Webhook error:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống xảy ra khi xử lý cổng webhook crawler." },
      { status: 500 }
    );
  }
}
