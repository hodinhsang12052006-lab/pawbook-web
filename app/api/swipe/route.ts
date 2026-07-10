export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic") || "candidates";

    if (topic === "candidates") {
      // 1. Candidate CVs
      const cvFilePath = path.join(process.cwd(), "public", "data", "fomo_cvs.json");
      if (fs.existsSync(cvFilePath)) {
        const content = fs.readFileSync(cvFilePath, "utf-8");
        const data = JSON.parse(content);
        return NextResponse.json(data);
      }
      return NextResponse.json([]);
    } else if (topic === "jobs") {
      // 2. Job Posts
      const jobs = await prisma.job.findMany({
        include: {
          employer: {
            select: {
              avatarUrl: true,
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      const staticJobs: any[] = [];
      const tpHcmDir = path.join(process.cwd(), "data_crawled", "TP_HCM");
      const filesToRead = ["Spa_thu_cung.json", "Khach_san_thu_cung.json", "Cap_cuu_thu_y.json"];

      filesToRead.forEach((file) => {
        const filePath = path.join(tpHcmDir, file);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const items = JSON.parse(content);
            items.forEach((item: any, idx: number) => {
              staticJobs.push({
                id: `static-swipe-${file.replace(".json", "")}-${idx}`,
                title: `Cần tuyển nhân viên ${item.category || "dịch vụ"} tại ${item.name}`,
                companyName: item.name,
                description: `Địa chỉ: ${item.address}. Xếp hạng: ${item.rating || 5.0} sao (${item.reviewCount || 0} reviews). Liên hệ ứng tuyển phỏng vấn trực tiếp ngay.`,
                salary: "8.000.000đ - 15.000.000đ",
                location: item.address || "TP. Hồ Chí Minh",
                tags: ["Grooming", "Pet Care", "Spa", "Tuyển Dụng"],
                isBoosted: idx % 3 === 0,
              });
            });
          } catch (e) {
            console.error("Error reading static jobs for swipe", file, e);
          }
        }
      });

      const mergedJobs = [...jobs, ...staticJobs];
      const mappedJobs = mergedJobs.map((job: any, index: number) => {
        const compName = job.companyName || "Đối tác BitPaw";
        return {
          id: job.id || `job-${index}`,
          name: job.title || "Nhân viên Dịch vụ",
          title: compName,
          experience: job.workType || "Làm việc tự do",
          salary: job.salary || "Thỏa thuận",
          location: job.location || "TP. Hồ Chí Minh",
          distance: `${(1 + (index % 5) * 0.4).toFixed(1)} km`,
          avatarUrl: job.employer?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(compName)}&background=0284c7&color=ffffff&bold=true`,
          bio: job.description || "Mô tả công việc đang được cập nhật...",
          skills: job.tags || ["Grooming", "Pet care", "Local Service"],
          fomoTags: job.isBoosted ? ["Tin Gấp", "Hot Match"] : ["Tuyển dụng"]
        };
      });

      return NextResponse.json(mappedJobs);
    } else if (topic === "travel") {
      // 3. Travel & Tourism
      const nhaTrangDir = path.join(process.cwd(), "data_crawled", "Nha_Trang");
      const mappedTravel: any[] = [];

      if (fs.existsSync(nhaTrangDir)) {
        const files = fs.readdirSync(nhaTrangDir);
        files.forEach((file) => {
          if (file.endsWith(".json")) {
            try {
              const filenameClean = file.replace(".json", "").replace(/_/g, " ");
              const content = fs.readFileSync(path.join(nhaTrangDir, file), "utf-8");
              const items = JSON.parse(content);
              items.forEach((item: any, idx: number) => {
                let imgUrl = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&auto=format&fit=crop&q=80"; // Hotel default
                if (filenameClean.toLowerCase().includes("bida") || filenameClean.toLowerCase().includes("cyber")) {
                  imgUrl = "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&auto=format&fit=crop&q=80";
                } else if (filenameClean.toLowerCase().includes("spa") || filenameClean.toLowerCase().includes("nail")) {
                  imgUrl = "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&auto=format&fit=crop&q=80";
                } else if (filenameClean.toLowerCase().includes("resort")) {
                  imgUrl = "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&auto=format&fit=crop&q=80";
                } else if (filenameClean.toLowerCase().includes("homestay") || filenameClean.toLowerCase().includes("nha nghi")) {
                  imgUrl = "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400&auto=format&fit=crop&q=80";
                } else if (filenameClean.toLowerCase().includes("diem du lich") || filenameClean.toLowerCase().includes("quan an") || filenameClean.toLowerCase().includes("ca phe")) {
                  imgUrl = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80";
                }

                const rating = item.rating || parseFloat((4.2 + (idx % 9) / 10).toFixed(1));
                mappedTravel.push({
                  id: `travel-${filenameClean.replace(/\s+/g, "-")}-${idx}`,
                  name: item.name,
                  title: item.category || filenameClean,
                  experience: `Đánh giá: ${rating}⭐`,
                  salary: `Từ 350.000đ - 3.000.000đ / ngày`,
                  location: item.address || "Nha Trang, Khánh Hòa",
                  distance: `${(0.5 + (idx % 6) * 0.3).toFixed(1)} km`,
                  avatarUrl: imgUrl,
                  bio: `${item.name} là địa điểm nổi bật tại Nha Trang. Địa chỉ: ${item.address || "Liên hệ để biết thêm chi tiết"}. Phục vụ chu đáo, được đánh giá cao bởi khách du lịch.`,
                  skills: ["Nha Trang", "Du Lịch", "Khách Sạn", "Nghỉ Dưỡng"],
                  fomoTags: rating >= 4.5 ? ["Nổi Bật", "Đánh giá cao"] : ["Địa Điểm Hot"]
                });
              });
            } catch (err) {
              console.error("Error reading Nha Trang file in API:", file, err);
            }
          }
        });
      }

      return NextResponse.json(mappedTravel);
    }

    return NextResponse.json([]);
  } catch (error: any) {
    console.error("Fetch swipe API error:", error);
    return NextResponse.json(
      { error: "Không thể tải dữ liệu quẹt thẻ." },
      { status: 500 }
    );
  }
}
