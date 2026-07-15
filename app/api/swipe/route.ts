export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import { generateFakeCandidates, generateFakeJobs, jitterCoords } from "@/lib/mockDataGenerator";

// Ho Chi Minh City center — used to place a Map Mode pin for any card that
// has no real geocoded coordinates (jittered, see mockDataGenerator).
const HCMC_CENTER: [number, number] = [10.7769, 106.7009];
// Below this many cards, top up from the DB / auto-seed real filler records
// so the deck never runs visibly dry ("chống rỗng").
const MIN_DECK_SIZE = 12;

// Non-blocking existence check (fs.promises has no direct existsSync equivalent).
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic") || "candidates";

    if (topic === "candidates") {
      // 1. Static hand-authored candidate CVs (existing fixture)
      let staticCards: any[] = [];
      const cvFilePath = path.join(process.cwd(), "public", "data", "fomo_cvs.json");
      if (await pathExists(cvFilePath)) {
        const content = await fs.readFile(cvFilePath, "utf-8");
        staticCards = JSON.parse(content);
      }

      // 2. Real candidate users already in the DB (role USER, has a bio/skills
      // set — i.e. actually opted into being discoverable).
      const realUsers = await prisma.user.findMany({
        where: { role: "USER", OR: [{ bio: { not: null } }, { skills: { not: null } }] },
        take: 40,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          skills: true,
          address: true,
          avatarUrl: true,
          bio: true,
        },
      });
      const realCards = realUsers.map((u, idx) => {
        const [lat, lng] = jitterCoords(HCMC_CENTER[0], HCMC_CENTER[1], idx);
        return {
          id: u.id,
          isRealUser: true, // lets the client know a "match" here can create a real Application
          name: u.name,
          title: (u.skills || "Ứng viên đa năng").split(",")[0].trim(),
          experience: "Đã cập nhật hồ sơ trên PawBook",
          salary: "Thỏa thuận",
          location: u.address || "TP. Hồ Chí Minh",
          distance: `${(0.5 + (idx % 8) * 0.5).toFixed(1)} km`,
          avatarUrl: u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2563eb&color=ffffff&bold=true`,
          bio: u.bio || "Ứng viên chưa cập nhật mô tả chi tiết.",
          skills: (u.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
          fomoTags: ["Hồ Sơ Thật"],
          latitude: lat,
          longitude: lng,
        };
      });

      let combined = [...realCards, ...staticCards];

      // 3. Auto-seed: still short of a full deck? Generate + persist real
      // filler candidates via faker so the deck never dead-ends, and so a
      // match on one of these can still create a genuine Application.
      if (combined.length < MIN_DECK_SIZE) {
        const seeded = await generateFakeCandidates(MIN_DECK_SIZE - combined.length);
        const seededCards = seeded.map((u, idx) => {
          const [lat, lng] = jitterCoords(HCMC_CENTER[0], HCMC_CENTER[1], realCards.length + idx);
          return {
            id: u.id,
            isRealUser: true,
            name: u.name,
            title: (u.skills || "Ứng viên đa năng").split(",")[0].trim(),
            experience: "Ứng viên mới tham gia BitPaw",
            salary: "Thỏa thuận",
            location: u.address || "TP. Hồ Chí Minh",
            distance: `${(0.5 + (idx % 8) * 0.5).toFixed(1)} km`,
            avatarUrl: u.avatarUrl,
            bio: u.bio,
            skills: (u.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
            fomoTags: ["Mới Tham Gia"],
            latitude: lat,
            longitude: lng,
          };
        });
        combined = [...combined, ...seededCards];
      }

      // Static fixture cards have no coordinates — jitter them too so Map
      // Mode always has a pin for every card.
      combined = combined.map((c, idx) => {
        if (typeof c.latitude === "number" && typeof c.longitude === "number") return c;
        const [lat, lng] = jitterCoords(HCMC_CENTER[0], HCMC_CENTER[1], idx + 100);
        return { ...c, latitude: lat, longitude: lng };
      });

      return NextResponse.json(combined);
    } else if (topic === "jobs") {
      // 2. Job Posts
      const jobs = await prisma.job.findMany({
        take: 100,
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

      for (const file of filesToRead) {
        const filePath = path.join(tpHcmDir, file);
        if (await pathExists(filePath)) {
          try {
            const content = await fs.readFile(filePath, "utf-8");
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
      }

      // Auto-seed: still short of a full deck after real + static jobs?
      // Generate + persist real filler Job rows (see mockDataGenerator) so a
      // swipe-right "apply" on one of these can create a genuine Application
      // instead of being a dead-end mock.
      let seededJobs: any[] = [];
      if (jobs.length + staticJobs.length < MIN_DECK_SIZE) {
        seededJobs = await generateFakeJobs(MIN_DECK_SIZE - (jobs.length + staticJobs.length));
      }

      const mergedJobs = [...jobs, ...seededJobs, ...staticJobs];
      const mappedJobs = mergedJobs.map((job: any, index: number) => {
        const compName = job.companyName || "Đối tác BitPaw";
        const [jLat, jLng] = typeof job.latitude === "number" && typeof job.longitude === "number"
          ? [job.latitude, job.longitude]
          : jitterCoords(HCMC_CENTER[0], HCMC_CENTER[1], index);
        return {
          id: job.id || `job-${index}`,
          isRealJob: Boolean(job.id), // real Prisma Job rows (DB or seeded) vs. static crawled fixtures
          name: job.title || "Nhân viên Dịch vụ",
          title: compName,
          experience: job.workType || "Làm việc tự do",
          salary: job.salary || "Thỏa thuận",
          location: job.location || "TP. Hồ Chí Minh",
          distance: `${(1 + (index % 5) * 0.4).toFixed(1)} km`,
          avatarUrl: job.employer?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(compName)}&background=0284c7&color=ffffff&bold=true`,
          bio: job.description || "Mô tả công việc đang được cập nhật...",
          skills: job.tags || ["Grooming", "Pet care", "Local Service"],
          fomoTags: job.isBoosted ? ["Tin Gấp", "Hot Match"] : ["Tuyển dụng"],
          latitude: jLat,
          longitude: jLng,
        };
      });

      return NextResponse.json(mappedJobs);
    } else if (topic === "travel") {
      // 3. Travel & Tourism
      const nhaTrangDir = path.join(process.cwd(), "data_crawled", "Nha_Trang");
      const mappedTravel: any[] = [];

      if (await pathExists(nhaTrangDir)) {
        const files = await fs.readdir(nhaTrangDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            try {
              const filenameClean = file.replace(".json", "").replace(/_/g, " ");
              const content = await fs.readFile(path.join(nhaTrangDir, file), "utf-8");
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
        }
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
