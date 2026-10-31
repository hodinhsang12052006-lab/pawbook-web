import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { isLocale } from "@/lib/i18n/config";
import { setUserLocale } from "@/lib/userLocale";

// POST { locale: "en" | "vi" } — nhớ ngôn ngữ của người dùng cho thông báo đẩy / email gửi khi họ
// không mở trang. Gọi từ SessionUserContext khi ngôn ngữ trang khác giá trị đã lưu.
export async function POST(req: Request) {
  const id = (await getServerSession(authOptions))?.user?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isLocale(body?.locale)) return NextResponse.json({ ok: false, error: "Ngôn ngữ không hợp lệ.", errorEn: "Invalid language." }, { status: 400 });
  await setUserLocale(id, body.locale);
  return NextResponse.json({ ok: true });
}
