import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const pathname = req.nextUrl.pathname;

    const isAuthPage = pathname.startsWith('/auth/login') || 
                       pathname.startsWith('/auth/register') || 
                       pathname === '/login' || 
                       pathname === '/register';

    // 1. Nếu đã đăng nhập thành công mà cố tình vào lại trang Login/Register -> Đá ra Profile
    if (isAuth && isAuthPage) {
      return NextResponse.redirect(new URL('/profile', req.url));
    }

    // 2. Nếu CHƯA đăng nhập mà cố tình vào trang Profile hoặc Admin -> Đá ra trang Login kèm callbackUrl
    if (!isAuth && !isAuthPage) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin role check
    const role = token?.role;
    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    "/profile/:path*",
    "/admin/:path*",
    "/auth/login",
    "/auth/register",
    "/login",
    "/register"
  ],
};
