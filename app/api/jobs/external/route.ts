import { NextRequest, NextResponse } from "next/server";
import { adzunaFlagOn, careerjetEnabled } from "@/lib/jobFeeds/config";
import { listExternalJobs } from "@/lib/jobFeeds/sync";

// GET /api/jobs/external?market=US|AU&state=&city=&q=&page=&pageSize=  — tin việc nail TỪ ĐỐI TÁC (Adzuna).
//   Tách hẳn khỏi /api/jobs: không bao giờ tính vào số "tin đang tuyển", thông báo việc, email, bài điểm tin.
//   Mỗi tin kèm attribution (chữ "Jobs by Adzuna" + link Adzuna đúng quốc gia) và url = link gốc của Adzuna.
//   Công tắc EXTERNAL_JOBS_ADZUNA tắt → trả rỗng ngay (không đọc DB). webSearch = nút tìm Careerjet có bật không.
//   X-Robots-Tag noindex: nội dung đối tác không được lập chỉ mục như nội dung của PawNail.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const market = sp.get("market") === "AU" ? "AU" : "US";
  const headers: Record<string, string> = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", "X-Robots-Tag": "noindex, nofollow" };
  const webSearch = careerjetEnabled();
  if (!adzunaFlagOn()) return NextResponse.json({ enabled: false, webSearch, items: [], total: 0 }, { headers: { ...headers, "X-Total-Count": "0" } });
  try {
    const state = (sp.get("state") || "").trim().toUpperCase().slice(0, 3) || null;
    const city = (sp.get("city") || "").trim().slice(0, 60) || null;
    const q = (sp.get("q") || "").trim().slice(0, 60) || null;
    const r = await listExternalJobs({ market, state, city, q, page: Number(sp.get("page")) || 1, pageSize: Number(sp.get("pageSize")) || 12 });
    return NextResponse.json({ enabled: true, webSearch, ...r }, { headers: { ...headers, "X-Total-Count": String(r.total) } });
  } catch {
    // Bảng chưa tạo (chưa chạy prisma/sql/2026-11-07_external_jobs.sql) → như đang tắt, không làm hỏng bảng việc
    return NextResponse.json({ enabled: false, webSearch, items: [], total: 0 }, { headers: { ...headers, "X-Total-Count": "0" } });
  }
}
