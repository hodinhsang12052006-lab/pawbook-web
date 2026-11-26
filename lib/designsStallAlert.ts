// Email cảnh báo khi trang Mẫu nail không có mẫu mới nào lộ ra trong 48 giờ (catalog chỉ hiện mẫu ĐÃ ĐĂNG + ĐÃ CÓ ẢNH).
// Production đứng từ 06/11 tới 26/11/2026 mà không ai biết. Thư nói thẳng nguyên nhân đoán được từ dữ liệu: công tắc
// duyệt đang bật (mẫu nằm ở bản nháp), máy vẽ ảnh đang tắt / chưa có kho ảnh (mẫu có nhưng chưa có ảnh), hay cron không
// tạo mẫu nào. Gọi từ cron hằng ngày (app/api/cron/external-jobs); tối đa 1 thư / ngày; không tự đổi công tắc của chủ.
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { emailEnabled, sendEmail } from "@/lib/email";
import { storageReady } from "@/lib/aiDesigns";

export const DESIGNS_ALERT_SENT_AT_KEY = "designs_stall_alert_at";
const WINDOW_MS = 48 * 3_600_000;
const RESEND_EVERY_MS = 23 * 3_600_000;
const alertTo = () => process.env.OPS_ALERT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawsoftware.com";

export type DesignsStall = { live: number; drafts: number; noImage: number; created: number; review: boolean; render: boolean; storage: boolean };

export async function designsStall(now = new Date()): Promise<DesignsStall> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const [live, drafts, noImage, created, review, render] = await Promise.all([
    prisma.nailDesign.count({ where: { status: "published", imageUrl: { not: null }, publishedAt: { gte: since } } }),
    prisma.nailDesign.count({ where: { status: "draft", createdAt: { gte: since } } }),
    prisma.nailDesign.count({ where: { status: "published", imageUrl: null, createdAt: { gte: since } } }),
    prisma.nailDesign.count({ where: { createdAt: { gte: since } } }),
    getSetting("designs_review").then((v) => v === "1").catch(() => false),
    getSetting("design_render").then((v) => v !== "0").catch(() => true),
  ]);
  return { live, drafts, noImage, created, review, render, storage: storageReady() };
}

/** Lý do + việc cần làm, theo thứ tự chắc chắn nhất. */
export function stallCause(s: DesignsStall): string[] {
  const out: string[] = [];
  if (s.review && s.drafts) out.push(`${s.drafts} mẫu đang chờ duyệt (công tắc "duyệt mẫu" đang BẬT): vào /admin/studio → tắt duyệt, hoặc duyệt các mẫu nháp.`);
  if (!s.render && s.noImage) out.push(`${s.noImage} mẫu chưa có ảnh vì máy vẽ ảnh đang TẮT (design_render = 0): vào /admin/studio → bật vẽ ảnh.`);
  if (!s.storage) out.push("Chưa có kho ảnh: thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET trên Vercel.");
  if (s.render && s.storage && s.noImage) out.push(`${s.noImage} mẫu chưa có ảnh dù máy vẽ đang bật: tải ảnh lên Cloudinary có thể đang lỗi (xem log cron /api/cron/designs).`);
  if (!s.created) out.push("Cron không tạo mẫu nào trong 48 giờ: kiểm tra Vercel Cron cho /api/cron/designs và CRON_SECRET.");
  return out.length ? out : ["Không rõ nguyên nhân từ dữ liệu: xem log cron /api/cron/designs."];
}

export async function alertIfDesignsStalled(now = new Date()): Promise<"fresh" | "already-sent" | "email-off" | "sent"> {
  const s = await designsStall(now);
  if (s.live > 0) return "fresh";
  const last = Date.parse((await getSetting(DESIGNS_ALERT_SENT_AT_KEY).catch(() => null)) || "");
  if (Number.isFinite(last) && now.getTime() - last < RESEND_EVERY_MS) return "already-sent";
  if (!emailEnabled()) return "email-off";
  const causes = stallCause(s);
  const text = [
    "Trang Mẫu nail (bitpawos.com/designs) không có mẫu mới nào trong 48 giờ qua.",
    `48 giờ qua: ${s.created} mẫu được tạo · ${s.drafts} bản nháp · ${s.noImage} mẫu chưa có ảnh.`,
    ...causes.map((c) => `• ${c}`),
    "(Thư này gửi tối đa 1 lần / ngày cho tới khi có mẫu mới lên trang.)",
  ].join("\n\n");
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = text.split("\n\n").map((p) => `<p style="margin:0 0 12px;font:14px/20px system-ui,sans-serif">${esc(p)}</p>`).join("");
  await sendEmail(alertTo(), "[PawNail] Trang Mẫu nail 48 giờ không có mẫu mới", html, text);
  await setSetting(DESIGNS_ALERT_SENT_AT_KEY, now.toISOString()).catch(() => {});
  return "sent";
}
