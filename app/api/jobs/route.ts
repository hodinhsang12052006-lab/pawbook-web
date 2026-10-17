import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { jobPostBlocked } from "@/lib/abuseGuard";
import { realOnly } from "@/lib/demo";
import { tidyIngestJob } from "@/lib/jobIngest/display";
import { activeJobWhere } from "@/lib/jobIngest/ingest";
import { Market, Role } from "@prisma/client";
import { getJobHeat, isHot } from "@/lib/jobStats";
import { notifyUrgentJob } from "@/lib/jobAlerts";
import { notifyJobAlerts } from "@/lib/jobAlertRules";
import { cleanJobMedia, getJobMedia, setJobMedia } from "@/lib/jobMedia";

// GET /api/jobs?market=US&state=CA&city=...&q=...  — danh sách tin tuyển thợ
//   q: tìm trong tiêu đề, tên tiệm, thành phố, kỹ năng, nội dung. Mới nhất / vừa được tiệm đăng lại lên đầu.
//   page=1&pageSize=12 (5–50): phân trang; tổng số trả trong header X-Total-Count / X-New-7d / X-Urgent-Count.
//     Không có page → như cũ (tối đa 100 tin, mảng JSON) để tool nhập tin + trang cũ không đổi.
//   ids=a,b,c (≤ 100): chỉ lấy đúng các tin này (mục "Đã lưu").
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const city = searchParams.get("city");
    const q = (searchParams.get("q") || "").trim().slice(0, 60);

    // Tin tổng hợp quá hạn tự ẩn; xem 1 danh sách id cụ thể (tin đã lưu) thì vẫn trả cả tin của tài khoản mẫu
    const where: any = { ...activeJobWhere() };
    if (!searchParams.get("ids")) where.owner = realOnly();
    if (market === "US" || market === "AU") where.market = market as Market;
    if (state) where.state = state;
    if (city) where.city = { contains: city };
    // (activeJobWhere đã dùng AND → nối thêm, không ghi đè)
    if (q) where.AND = [...(where.AND ?? []), { OR: ["title", "salonName", "city", "skills", "description"].map((f) => ({ [f]: { contains: q } })) }];
    const ids = (searchParams.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 100);
    if (ids.length) where.id = { in: ids };
    const paged = searchParams.has("page");
    const page = Math.min(1000, Math.max(1, Math.floor(Number(searchParams.get("page")) || 1)));
    const pageSize = Math.min(50, Math.max(5, Math.floor(Number(searchParams.get("pageSize")) || 12)));

    const jobs = await prisma.job.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
        // Số người THẬT đã lưu tin — tín hiệu "nhiều người quan tâm".
        _count: { select: { savedBy: true } },
      },
      // Tin đăng lại (bump) có createdAt = lúc đăng lại → tự lên đầu.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: paged ? (page - 1) * pageSize : 0,
      take: paged ? pageSize : 100,
    });
    // Tổng số cho thanh phân trang + dải "N tin đang tuyển · N mới · N gấp" (đếm cả các trang khác).
    const totals = paged
      ? await Promise.all([
          prisma.job.count({ where }),
          prisma.job.count({ where: { AND: [where, { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }] } }),
          prisma.job.count({ where: { AND: [where, { isUrgent: true }] } }),
        ])
      : null;

    const [heat, media] = await Promise.all([getJobHeat(jobs.map((j) => j.id)), getJobMedia(jobs.map((j) => j.id))]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safeJobs = jobs.map(({ _count, sourceUrl, sourceKey, sourceFbHash, ...job }) => {
      const h = heat.get(job.id);
      return {
      ...tidyIngestJob(job),
      saveCount: _count.savedBy,
      mediaUrls: media.get(job.id) ?? [],
      // Số liệu "nóng" thật — UI tự ẩn khi dưới ngưỡng (lib/jobStats HEAT_MIN).
      heat: { viewsToday: h?.viewsToday ?? 0, contacts7d: h?.contacts7d ?? 0, hot: isHot(h) },
      skills: job.skills ? job.skills.split(",").filter(Boolean) : [],
      benefits: job.benefits ? job.benefits.split(",").filter(Boolean) : [],
      createdAt: job.createdAt.toISOString(),
      };
    });

    // Danh sách CÔNG KHAI, giống nhau cho mọi người → CDN của Vercel giữ 20 giây
    // (phục vụ tiếp bản cũ tối đa 60 giây trong lúc làm mới). 1.000 người mở
    // bảng việc cùng lúc chỉ tốn ~1 lượt đọc DB thay vì 1.000. Tin vừa đăng có
    // thể chậm hiện trên bảng ≤ 20 giây; trang chi tiết tin không bị cache.
    const headers: Record<string, string> = { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" };
    if (totals) Object.assign(headers, { "X-Total-Count": String(totals[0]), "X-New-7d": String(totals[1]), "X-Urgent-Count": String(totals[2]), "X-Page": String(page), "X-Page-Size": String(pageSize) });
    return NextResponse.json(safeJobs, { headers });
  } catch (error: any) {
    console.error("Fetch jobs API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách tin tuyển dụng." },
      { status: 500 }
    );
  }
}

// POST /api/jobs — đăng tin tuyển thợ (chỉ chủ tiệm - role OWNER)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng tin tuyển dụng." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    if (userRole !== Role.OWNER) {
      return NextResponse.json(
        { error: "Chỉ tài khoản Chủ tiệm mới có thể đăng tin tuyển thợ." },
        { status: 403 }
      );
    }

    // Chống tin rác / lừa đảo hàng loạt: tối đa vài tin / tiệm / ngày (lib/abuseGuard).
    const capped = await jobPostBlocked(userId);
    if (capped) return NextResponse.json({ error: capped, code: "JOB_LIMIT" }, { status: 429 });

    const body = await req.json();
    const {
      title, salonName, description, market, state, city,
      salaryType, salaryAmount, skills, benefits, phone, isUrgent, mediaUrls,
    } = body;
    const media = cleanJobMedia(mediaUrls);

    if (!title || !salonName || !market || !state || !city || !salaryType || !salaryAmount || !phone) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin bắt buộc." },
        { status: 400 }
      );
    }
    // Tin tuyển dụng hiển thị công khai trong danh sách 100 tin/request —
    // chặn kiểu dữ liệu lạ (object/array làm Prisma ném lỗi 500) và chuỗi
    // khổng lồ làm phình mọi response của job board.
    const shortFields = { title, salonName, state, city, salaryType, salaryAmount, phone };
    for (const [key, value] of Object.entries(shortFields)) {
      if (typeof value !== "string" || value.length > 200) {
        return NextResponse.json({ error: `Trường "${key}" không hợp lệ.` }, { status: 400 });
      }
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 5000)) {
      return NextResponse.json({ error: "Mô tả quá dài (tối đa 5000 ký tự)." }, { status: 400 });
    }

    const newJob = await prisma.job.create({
      data: {
        title,
        salonName,
        description: description || "",
        ownerId: userId,
        market: market === "AU" ? Market.AU : Market.US,
        state,
        city,
        salaryType,
        salaryAmount,
        skills: Array.isArray(skills) ? skills.join(",") : (skills || ""),
        benefits: Array.isArray(benefits) ? benefits.join(",") : (benefits || ""),
        phone,
        isUrgent: isUrgent !== undefined ? !!isUrgent : true,
      },
    });

    // Ảnh/video tiệm (bảng riêng — lỗi ở đây không làm hỏng tin đã đăng).
    await setJobMedia(newJob.id, media);

    // Tin gấp → báo thợ cùng bang; rồi báo người có "thông báo việc" khớp tiêu chí
    // (bỏ qua ai vừa nhận tin gấp). Chạy SAU khi trả lời — after() giữ hàm
    // serverless sống tới khi gửi xong (fire-and-forget có thể bị Vercel cắt).
    after(async () => {
      const urgentIds = newJob.isUrgent ? await notifyUrgentJob(newJob).catch(() => [] as string[]) : [];
      await notifyJobAlerts(newJob, new Set(urgentIds));
    });

    return NextResponse.json(newJob, { status: 201 });
  } catch (error: any) {
    console.error("Create job API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi đăng tin tuyển dụng." },
      { status: 500 }
    );
  }
}
