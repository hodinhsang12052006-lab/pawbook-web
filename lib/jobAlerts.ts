import { getPusherServer } from "@/lib/pusherServer";
import { jobAlertChannelName } from "@/lib/pusherChannel";

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
export async function notifyUrgentJob(job: UrgentJob) {
  const channel = jobAlertChannelName(job.market, job.state);
  if (!channel) return;
  try {
    await getPusherServer()?.trigger(channel, "urgent-job", {
      id: job.id,
      text: `${job.salonName} tại ${job.city} cần thợ gấp: ${job.title} — ${job.salaryAmount}`.slice(0, 160),
    });
  } catch (err) {
    console.error("notifyUrgentJob error:", err);
  }
}
