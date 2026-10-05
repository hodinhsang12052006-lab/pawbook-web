import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { isRateLimited, recordAttempt, clearAttempts } from "@/lib/rateLimit";
import { oauthProviders, appleEnabled } from "@/lib/authProviders";
import { findOrCreateOAuthUser, needsOnboarding } from "@/lib/oauthUsers";

// Sống ở đây (không phải trong app/api/auth/[...nextauth]/route.ts) vì Next.js
// typegen cho route handler chỉ chấp nhận export GET/POST/config/... — export
// thêm `authOptions` cùng file khiến `tsc`/route typegen báo lỗi
// "incompatible with index signature" (route.ts giờ chỉ re-export handler).
//
// A hardcoded fallback secret shipped in source is publicly known to anyone
// who can read this repo — it lets an attacker forge valid session JWTs for
// ANY user if NEXTAUTH_SECRET is ever unset in an environment. Falling back
// to a per-process random secret instead means a missing env var degrades to
// "everyone gets logged out on restart" (annoying but safe) rather than
// "sessions are forgeable" (a full auth bypass).
if (!process.env.NEXTAUTH_SECRET) {
  console.error(
    "❌ NEXTAUTH_SECRET is not set — falling back to a random per-process secret. " +
    "Sessions will not survive a restart/redeploy until this is configured."
  );
}
const authSecret = process.env.NEXTAUTH_SECRET || crypto.randomBytes(32).toString("hex");

// Không có bất kỳ giới hạn nào cho số lần đăng nhập sai trước đây — 1 kẻ tấn
// công có thể dò mật khẩu (brute-force) 1 tài khoản với tốc độ chỉ giới hạn
// bởi băng thông mạng. Khóa tạm 1 email sau nhiều lần sai liên tiếp (dùng
// chung bộ đếm với lib/rateLimit.ts — xem giới hạn về multi-instance ở đó).
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginKey = (email: string) => `login:${email}`;

export const authOptions: NextAuthOptions & { trustHost?: boolean } = {
  // Ép Vercel tin tưởng Domain để không đánh rơi Cookie
  trustHost: true as any,

  // KHÔNG dùng adapter: schema không có bảng Account/Session (JWT thuần).
  // Google/Apple tự tìm-hoặc-tạo User theo email trong callback signIn bên dưới.

  // BẮT BUỘC: Ép dùng JWT để Middleware (Edge) đọc được mà không cần chọc vào Database
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // Ép thời gian sống của thẻ VIP là 30 ngày
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Thông báo lỗi CHUNG cho cả 2 trường hợp "email không tồn tại" và
        // "sai mật khẩu" — trước đây 2 thông báo khác nhau để lộ email nào
        // đã đăng ký trên hệ thống hay chưa (user enumeration), giúp kẻ tấn
        // công xây danh sách mục tiêu để phishing/brute-force.
        const genericError = "Email hoặc mật khẩu không chính xác.";
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Vui lòng nhập đầy đủ email và mật khẩu.");
          }
          const email = credentials.email;

          if (isRateLimited(loginKey(email), FAILED_LOGIN_LIMIT, FAILED_LOGIN_WINDOW_MS)) {
            throw new Error("Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.");
          }

          const user = await prisma.user.findUnique({
            where: { email },
          });

          // Thêm check !user.password để chặn lỗi nếu acc đó đăng nhập bằng Google trước đây
          if (!user || !user.password) {
            recordAttempt(loginKey(email), FAILED_LOGIN_WINDOW_MS);
            throw new Error(genericError);
          }

          const isPasswordMatch = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordMatch) {
            recordAttempt(loginKey(email), FAILED_LOGIN_WINDOW_MS);
            throw new Error(genericError);
          }

          clearAttempts(loginKey(email));

          // Trả về đúng object để nhét vào JWT
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.avatarUrl,
          };
        } catch (err: any) {
          console.error("NextAuth Authorize error:", err);
          throw new Error(err.message || "Lỗi hệ thống xác thực thông tin đăng nhập.");
        }
      }
    }),
    ...oauthProviders(),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      // Google/Apple: chỉ nhận email ĐÃ XÁC MINH (chống chiếm tài khoản cùng email).
      const email = user.email || (profile as { email?: string } | undefined)?.email;
      const verified = (profile as { email_verified?: boolean | string } | undefined)?.email_verified;
      if (!email || verified === false || verified === "false") return "/auth/login?error=OAuthEmail";
      try {
        await findOrCreateOAuthUser({ email, name: user.name });
        return true;
      } catch (err) {
        console.error("OAuth signIn error:", err);
        return "/auth/login?error=OAuthSignin";
      }
    },
    async jwt({ token, user, account }) {
      // Lúc đăng nhập thành công, nhét id và role vào vé VIP (token)
      if (user && (!account || account.provider === "credentials")) {
        token.id = user.id;
        token.role = (user as any).role;
      } else if (user && account) {
        // Google/Apple: id/role lấy từ User THẬT trong DB (không phải id của Google).
        const db = await prisma.user.findUnique({ where: { email: String(user.email).toLowerCase() }, select: { id: true, role: true, password: true, state: true } });
        if (db) {
          token.id = db.id;
          token.role = db.role;
          token.onb = needsOnboarding(db);
        }
      } else if (token.onb && token.id) {
        // Đang hoàn tất hồ sơ (chọn vai trò/khu vực) → đọc lại vai trò mới cho tới khi xong.
        const db = await prisma.user.findUnique({ where: { id: String(token.id) }, select: { role: true, password: true, state: true } });
        if (db) {
          token.role = db.role;
          token.onb = needsOnboarding(db);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Truyền data từ token ra ngoài session để client dùng
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).needsOnboarding = !!token.onb;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
    // Lỗi đăng nhập Google/Apple quay về trang đăng nhập kèm ?error= (trước
    // đây trỏ /auth/error — trang không tồn tại → 404).
    error: "/auth/login",
    // KHÔNG khai `newUser` — trang đăng ký thật của app đi qua
    // /api/register (route riêng, không qua NextAuth adapter) TRƯỚC khi
    // signIn() được gọi, nên NextAuth không bao giờ cần tự "tạo user mới"
    // qua adapter. Nhưng vì `adapter: PrismaAdapter(prisma)` vẫn được khai
    // (dự phòng cho OAuth sau này) trong khi Credentials Provider không bao
    // giờ gọi `adapter.linkAccount()`, NextAuth luôn thấy "chưa có Account
    // nào link với user này" ở MỌI lần đăng nhập bằng mật khẩu — và hiểu
    // nhầm thành "user mới", đá thẳng về `pages.newUser` dù đây là tài
    // khoản cũ đăng nhập bình thường. Đây chính là lỗi "đăng nhập xong lại
    // bị đá về trang đăng ký" phát hiện khi test thật trên production.
  },
  ...(appleEnabled() && (process.env.NEXTAUTH_URL || "").startsWith("https")
    ? {
        cookies: {
          pkceCodeVerifier: { name: "__Secure-next-auth.pkce.code_verifier", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
          state: { name: "__Secure-next-auth.state", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
        },
      }
    : {}),
  // Tắt debug trên Production cho nhẹ server, chỉ bật khi ở máy tính
  debug: process.env.NODE_ENV === "development",
  secret: authSecret,
};
