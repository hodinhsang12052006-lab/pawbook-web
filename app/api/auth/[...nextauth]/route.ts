import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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

export const authOptions: NextAuthOptions & { trustHost?: boolean } = {
  // Ép Vercel tin tưởng Domain để không đánh rơi Cookie
  trustHost: true as any,

  // Vẫn giữ Adapter dự phòng cho tương lai nếu ní tích hợp Login Google/Facebook
  adapter: PrismaAdapter(prisma) as any,

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
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Vui lòng nhập đầy đủ email và mật khẩu.");
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          // Thêm check !user.password để chặn lỗi nếu acc đó đăng nhập bằng Google trước đây
          if (!user || !user.password) {
            throw new Error("Tài khoản không tồn tại hoặc chưa cài mật khẩu. Vui lòng đăng ký.");
          }

          const isPasswordMatch = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordMatch) {
            throw new Error("Mật khẩu không chính xác.");
          }

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
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Lúc đăng nhập thành công, nhét id và role vào vé VIP (token)
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // Truyền data từ token ra ngoài session để client dùng
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
    newUser: "/auth/register",
    error: "/auth/error",
  },
  // Tắt debug trên Production cho nhẹ server, chỉ bật khi ở máy tính
  debug: process.env.NODE_ENV === "development",
  secret: authSecret,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };