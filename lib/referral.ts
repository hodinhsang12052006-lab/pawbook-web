// MỜI BẠN BÈ — link bitpawos.com/?ref=<id người mời>. Trang nào có ?ref= cũng ghi cookie
// (components/RefCapture.tsx, 30 ngày) → lúc đăng ký API đọc cookie / body.ref và gắn
// referredById. Người mời nhận thông báo; mời được AMBASSADOR_MIN người → huy hiệu "Đại sứ PawNail".
import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";

export const REF_COOKIE = "pn_ref";
export const AMBASSADOR_MIN = 3;
const ID_RE = /^[a-z0-9]{10,40}$/i;

export function readRef(req: Request, body: { ref?: unknown } | null): string | null {
  const fromBody = typeof body?.ref === "string" ? body.ref.trim() : "";
  if (ID_RE.test(fromBody)) return fromBody;
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${REF_COOKIE}=([^;]+)`));
  const fromCookie = m ? decodeURIComponent(m[1]).trim() : "";
  return ID_RE.test(fromCookie) ? fromCookie : null;
}

/** Gắn người mời cho tài khoản vừa tạo + báo người mời. Lỗi không làm hỏng đăng ký. */
export async function attachReferral(newUserId: string, newUserName: string, ref: string | null) {
  if (!ref || ref === newUserId) return;
  try {
    const inviter = await prisma.user.findUnique({ where: { id: ref }, select: { id: true } });
    if (!inviter) return;
    await prisma.user.update({ where: { id: newUserId }, data: { referredById: inviter.id } });
    const text = `${newUserName} vừa tham gia PawNail nhờ lời mời của bạn`;
    try {
      await getPusherServer()?.trigger(chatChannelName(inviter.id), "notification", { text, textEn: `${newUserName} just joined PawNail from your invite` });
    } catch {}
    await sendPush(inviter.id, { title: "🎉 Bạn bè đã tham gia", body: text, url: "/profile#moi-ban-be", tag: "referral" });
  } catch (e) {
    console.error("attachReferral error:", e);
  }
}
