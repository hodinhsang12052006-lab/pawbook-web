import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "@/lib/i18n/config";
import { setUserLocale } from "@/lib/userLocale";

// POST { locale: "en" | "vi", cookie?: boolean }
//   - cookie: true (nút VI/EN) → máy chủ đặt cookie bitpaw_locale 1 năm. Cookie do JavaScript ghi bị Safari /
//     WKWebView (ITP) cắt còn 7 ngày; cookie từ Set-Cookie của máy chủ cùng tên miền thì không. Không cần
//     đăng nhập.
//   - đã đăng nhập → nhớ ngôn ngữ của tài khoản cho thông báo đẩy / email gửi khi họ không mở trang
//     (SessionUserContext gọi khi ngôn ngữ trang khác giá trị đã lưu).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { locale?: unknown; cookie?: unknown } | null;
  if (!isLocale(body?.locale)) return NextResponse.json({ ok: false, error: "Ngôn ngữ không hợp lệ.", errorEn: "Invalid language." }, { status: 400 });
  const locale = body.locale;
  const id = (await getServerSession(authOptions))?.user?.id;
  if (!id && body.cookie !== true) return NextResponse.json({ ok: false }, { status: 401 });
  if (id) await setUserLocale(id, locale);
  const res = NextResponse.json({ ok: true, saved: !!id }, { headers: { "Cache-Control": "private, no-store" } });
  if (body.cookie === true) {
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: new URL(req.url).protocol === "https:",
    });
  }
  return res;
}
