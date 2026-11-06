import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localeFromRequest } from "@/lib/i18n/server";
import { getTranslations, translateEntries } from "@/lib/contentTranslations";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

// POST /api/messages/translate { ids: string[], to?: "en" | "vi", cacheOnly?: boolean }
//   → { translations: { [messageId]: string } }
// Dịch tin nhắn CHỮ sang ngôn ngữ của người xem (khách chỉ đọc tiếng Anh nhận tin tiếng Việt của thợ và
// ngược lại). Chỉ người TRONG cuộc trò chuyện mới dịch được tin của cuộc đó. Dịch trên máy chủ, lưu đệm
// theo tin + ngôn ngữ đích (lib/contentTranslations) — mỗi tin chỉ dịch 1 lần cho mọi lần mở sau.
// cacheOnly: chỉ trả bản đã có (xem trước ở danh sách hội thoại — không tốn lượt dịch).
export async function POST(req: Request) {
  const me = (await getServerSession(authOptions))?.user?.id;
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { ids?: unknown; to?: unknown; cacheOnly?: unknown } | null;
  const ids = [...new Set((Array.isArray(body?.ids) ? body!.ids : []).map((x) => String(x)).filter((x) => /^[a-z0-9]{8,40}$/i.test(x)))].slice(0, 40);
  const to: Locale = isLocale(body?.to) ? body!.to : localeFromRequest(req);
  if (!ids.length) return NextResponse.json({ translations: {} });

  const rows = await prisma.message.findMany({
    where: { id: { in: ids }, type: "TEXT", conversation: { participants: { some: { id: me } } } },
    select: { id: true, body: true },
  });
  const entries = rows.map((r) => ({ id: r.id, src: r.body }));
  let map;
  if (body?.cacheOnly === true) {
    map = await getTranslations("msg", entries, to);
  } else {
    // Dịch máy tốn tiền / hạn mức: tối đa 120 tin mới mỗi giờ mỗi người.
    const rk = `msg-translate:${me}`;
    if (isRateLimited(rk, 120, 60 * 60 * 1000)) map = await getTranslations("msg", entries, to);
    else {
      recordAttempt(rk, 60 * 60 * 1000);
      map = await translateEntries("msg", entries, to, { maxNew: 20 });
    }
  }
  const translations: Record<string, string> = {};
  for (const [id, t] of map) translations[id] = t.text;
  return NextResponse.json({ translations, to }, { headers: { "Cache-Control": "private, no-store" } });
}
