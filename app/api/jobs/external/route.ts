import { NextRequest, NextResponse } from "next/server";
import { adzunaPublic, careerjetEnabled, referralFeeDisclosed } from "@/lib/jobFeeds/config";
import { listExternalJobs } from "@/lib/jobFeeds/sync";

// GET /api/jobs/external?market=US|AU&state=&city=&q=&page=&pageSize=  — tin việc nail TỪ ĐỐI TÁC (Adzuna).
//   Tách hẳn khỏi /api/jobs: không bao giờ tính vào số "tin đang tuyển", thông báo việc, email, bài điểm tin.
//   Mỗi tin kèm attribution (chữ "Jobs by Adzuna" + link Adzuna đúng quốc gia) và url = link gốc của Adzuna.
//   Chỉ trả tin khi EXTERNAL_JOBS_ADZUNA bật VÀ có ADZUNA_LICENSE_REF (giấy phép thương mại) — khoá dùng thử chỉ để
//   admin kiểm tra độ phủ, không bao giờ hiện công khai. Không đủ điều kiện → trả rỗng ngay (không đọc DB).
//   webSearch = nút tìm Careerjet có bật không (cần CAREERJET_TERMS_CONFIRMED). referralFee = phải ghi "có thể nhận phí".
//   X-Robots-Tag noindex: nội dung đối tác không được lập chỉ mục như nội dung của PawNail.
//   CDN chỉ giữ 60 s (+60 s cũ) → tắt công tắc / hết giấy phép thì tin biến mất khỏi trang trong ~2 phút.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const market = sp.get("market") === "AU" ? "AU" : "US";
  const headers: Record<string, string> = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60", "X-Robots-Tag": "noindex, nofollow" };
  const base = { webSearch: careerjetEnabled(), referralFee: referralFeeDisclosed() };
  if (!adzunaPublic()) return NextResponse.json({ enabled: false, ...base, items: [], total: 0 }, { headers: { ...headers, "X-Total-Count": "0" } });
  try {
    const state = (sp.get("state") || "").trim().toUpperCase().slice(0, 3) || null;
    const city = (sp.get("city") || "").trim().slice(0, 60) || null;
    const q = (sp.get("q") || "").trim().slice(0, 60) || null;
    const r = await listExternalJobs({ market, state, city, q, page: Number(sp.get("page")) || 1, pageSize: Number(sp.get("pageSize")) || 12 });
    return NextResponse.json({ enabled: true, ...base, ...r }, { headers: { ...headers, "X-Total-Count": String(r.total) } });
  } catch {
    // Bảng chưa tạo (chưa chạy prisma/sql/2026-11-07_external_jobs.sql) → như đang tắt, không làm hỏng bảng việc
    return NextResponse.json({ enabled: false, ...base, items: [], total: 0 }, { headers: { ...headers, "X-Total-Count": "0" } });
  }
}
