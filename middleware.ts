import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  // Tự tay móc thẻ VIP (Token) ra từ Cookie, dùng đúng cái chìa khóa bí mật để giải mã
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "pawbook_super_secret_key_2026_fixed_hardcode"
  });

  const isAuth = !!token;
  const pathname = req.nextUrl.pathname;

  const isAuthPage = pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/register') ||
    pathname === '/login' ||
    pathname === '/register';

  // 1. Đã đăng nhập mà cố tình mò vào trang Login/Register -> Đá thẳng vô Profile
  if (isAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/profile', req.url));
  }

  // 2. CHƯA đăng nhập mà vào các trang cần bảo vệ (như /profile, /admin) -> Mời ra Login
  if (!isAuth && !isAuthPage) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Kiểm tra quyền Admin (nếu vào đường dẫn /admin)
  if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Cho phép đi tiếp nếu thỏa mãn mọi điều kiện
  return NextResponse.next();
}

// Chặn cực kỳ chi tiết, không bỏ sót đường dẫn nào
export const config = {
  matcher: [
    "/profile",
    "/profile/:path*",
    "/admin",
    "/admin/:path*",
    "/auth/login",
    "/auth/register",
    "/login",
    "/register"
  ],
};