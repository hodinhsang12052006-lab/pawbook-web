// Email cảnh báo khi bot đọc nhóm Facebook ngừng gửi tin quá INGEST_STALE_HOURS giờ (thường do cookie Facebook hết hạn).
// Trước đây chỉ có banner trong trang admin → 12/11–26/11/2026 bot bị đăng xuất 14 ngày, tin hết hạn dần (TTL 14 ngày)
// tới khi bảng việc còn 1 tin mà không ai biết. Gọi từ cron hằng ngày (app/api/cron/external-jobs); tối đa 1 thư / ngày.
// Người nhận: OPS_ALERT_EMAIL, rồi NEXT_PUBLIC_SUPPORT_EMAIL, mặc định support@bitpawsoftware.com.
import { getSetting, setSetting } from "@/lib/settings";
import { emailEnabled, sendEmail } from "@/lib/email";
import { ingestHeartbeat } from "@/lib/jobIngest/ingest";

export const INGEST_ALERT_SENT_AT_KEY = "ingest_stale_alert_at";
const RESEND_EVERY_MS = 23 * 3_600_000; // cron mỗi ngày lệch vài phút → vẫn gửi đúng 1 thư / ngày

const alertTo = () => process.env.OPS_ALERT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawsoftware.com";

export type StaleAlertResult = "fresh" | "intake-off" | "rejected-only" | "already-sent" | "email-off" | "sent";

export async function alertIfIngestStale(now = new Date()): Promise<StaleAlertResult> {
  const hb = await ingestHeartbeat(now);
  if (!hb.accepting) return "intake-off"; // chủ tự tắt nhận tin (INGEST_AGGREGATED=off) — không phải sự cố
  if (!hb.stale) return "fresh";
  const last = Date.parse((await getSetting(INGEST_ALERT_SENT_AT_KEY).catch(() => null)) || "");
  if (Number.isFinite(last) && now.getTime() - last < RESEND_EVERY_MS) return "already-sent";
  if (!emailEnabled()) return "email-off";

  const since = hb.lastAt ? new Date(hb.lastAt) : null;
  const days = since ? Math.floor((now.getTime() - since.getTime()) / 86_400_000) : null;
  const sinceText = since ? `${since.toISOString().slice(0, 16).replace("T", " ")} UTC (${days} ngày trước)` : "chưa từng nhận";
  // Bot vẫn gửi lô nhưng mọi bài bị loại → không phải cookie; nói đúng nguyên nhân để chủ không đi đổi cookie vô ích.
  const cause = hb.rejectedOnly
    ? "Bot VẪN gửi lô lên web nhưng mọi bài đều bị loại (định dạng / bộ lọc). Xem log máy chủ [ingest] trên Vercel."
    : "Bot không gửi lô nào lên web. Thường do Facebook đăng xuất cookie của bot: mở daemon_activity.log trong thư mục \"tool cào data\"; nếu thấy \"FACEBOOK ĐÃ ĐĂNG XUẤT\" thì chạy CAP_NHAT_COOKIE.bat rồi khởi động lại tool.";
  const text = [
    `Bot đọc nhóm Facebook chưa gửi tin mới lên PawNail từ ${sinceText}.`,
    cause,
    `Tin từ nhóm hết hạn sau 14 ngày, nên bảng việc làm sẽ trống dần nếu bot không chạy lại.`,
    `(Thư này gửi tối đa 1 lần / ngày cho tới khi bot gửi tin trở lại.)`,
  ].join("\n\n");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = text.split("\n\n").map((p) => `<p style="margin:0 0 12px;font:14px/20px system-ui,sans-serif">${esc(p)}</p>`).join("");
  await sendEmail(alertTo(), `[PawNail] Bot nhóm Facebook ngừng gửi tin${days != null ? ` ${days} ngày` : ""}`, html, text);
  await setSetting(INGEST_ALERT_SENT_AT_KEY, now.toISOString()).catch(() => {});
  return "sent";
}
