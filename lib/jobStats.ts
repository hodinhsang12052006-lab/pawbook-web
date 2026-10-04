import prisma from "@/lib/prisma";

// Độ "nóng" THẬT của tin tuyển — bảng JobDaily (prisma/sql/2026-10-04_job_daily.sql).
// Giống lib/postStats: bảng chưa tồn tại thì trả rỗng / bỏ qua, không làm hỏng job board.

export interface JobHeat {
  viewsToday: number;
  views7d: number;
  viewsTotal: number;
  contacts7d: number;
}

// Ngưỡng hiển thị — số nhỏ quá nhìn "vắng" và phản tác dụng, nên ẩn đi.
// Dùng chung cho UI (components/jobs/*) để ẩn/hiện nhất quán.
export const HEAT_MIN = {
  viewsToday: 3, // "N người xem hôm nay"
  contacts7d: 2, // "N người đã liên hệ tuần này"
  saves: 2, // "N người đã lưu tin này"
};

/** "Đang hot": nhiều người xem trong ngày, hoặc nhiều người liên hệ trong tuần. */
export function isHot(h: JobHeat | null | undefined): boolean {
  if (!h) return false;
  return h.viewsToday >= 8 || h.contacts7d >= 4;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => dayKey(new Date());

function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

export async function getJobHeat(jobIds: string[]): Promise<Map<string, JobHeat>> {
  const out = new Map<string, JobHeat>();
  if (jobIds.length === 0) return out;
  try {
    const rows = await prisma.jobDaily.findMany({
      where: { jobId: { in: jobIds } },
      select: { jobId: true, day: true, views: true, contacts: true },
    });
    const t = today();
    const weekAgo = dayKey(new Date(Date.now() - 6 * 86_400_000));
    for (const r of rows) {
      const h = out.get(r.jobId) || { viewsToday: 0, views7d: 0, viewsTotal: 0, contacts7d: 0 };
      h.viewsTotal += r.views;
      if (r.day === t) h.viewsToday += r.views;
      if (r.day >= weekAgo) {
        h.views7d += r.views;
        h.contacts7d += r.contacts;
      }
      out.set(r.jobId, h);
    }
  } catch (err) {
    if (!isMissingTable(err)) console.error("getJobHeat error:", err);
  }
  return out;
}

async function bump(jobIds: string[], field: "views" | "contacts") {
  const day = today();
  try {
    await Promise.all(
      jobIds.map((jobId) =>
        prisma.jobDaily.upsert({
          where: { jobId_day: { jobId, day } },
          update: { [field]: { increment: 1 } },
          create: { jobId, day, [field]: 1 },
        })
      )
    );
  } catch (err) {
    if (!isMissingTable(err)) console.error(`bump ${field} error:`, err);
  }
}

export const addJobViews = (jobIds: string[]) => bump(jobIds, "views");
export const addJobContact = (jobId: string) => bump([jobId], "contacts");
