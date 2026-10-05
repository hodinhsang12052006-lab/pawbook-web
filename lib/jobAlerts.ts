import { getPusherServer } from "@/lib/pusherServer";
import { jobAlertChannelName } from "@/lib/pusherChannel";
import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";

interface UrgentJob {
  id: string;
  title: string;
  salonName: string;
  city: string;
  market: string;
  state: string;
  salaryAmount: string;
}

// Báo realtime cho mọi thợ đang mở app ở cùng bang khi có tin GẤP mới.
// Bản ghi lâu dài nằm ở /api/notifications (kind "job"), nên ai offline lúc
// đăng vẫn thấy trong chuông khi mở lại app.
/** Trả về id những người đã được đẩy thông báo (để kênh khác không báo trùng). */
export async function notifyUrgentJob(job: UrgentJob): Promise<string[]> {
  let pushed: string[] = [];
  const channel = jobAlertChannelName(job.market, job.state);
  if (!channel) return pushed;
  try {
    await getPusherServer()?.trigger(channel, "urgent-job", {
      id: job.id,
      text: `${job.salonName} tại ${job.city} cần thợ gấp: ${job.title} — ${job.salaryAmount}`.slice(0, 160),
    });
  } catch (err) {
    console.error("notifyUrgentJob error:", err);
  }
  // Thông báo đẩy cho thợ cùng bang đã bật thông báo (kể cả đang đóng app).
  try {
    const techs = await prisma.user.findMany({
      where: { role: "TECHNICIAN", market: job.market as "US" | "AU", state: job.state, pushSubscriptions: { some: {} } },
      select: { id: true },
      take: 1000,
    });
    if (techs.length) {
      pushed = techs.map((t) => t.id);
      await sendPush(techs.map((t) => t.id), {
        title: "🔥 Việc gấp gần bạn",
        body: `${job.salonName} tại ${job.city} cần thợ: ${job.title} — ${job.salaryAmount}`,
        url: `/jobs/${job.id}`,
        tag: `pn-job-${job.id}`,
      });
    }
  } catch (err) {
    if (!/no such table|P2021/i.test(String(err))) console.error("urgent job push error:", err);
  }
  return pushed;
}
