import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";
import { AuthedRedirect } from "@/components/auth/useAuthedRedirect";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/forgot", {
    title: ["Quên mật khẩu", "Forgot password"],
    noindex: true,
  });
}

// Đã đăng nhập → vào app (như /auth/register, /auth/login; .pn-authgate: không nháy form khách trước khi chuyển).
// /auth/reset KHÔNG chuyển: link trong email phải dùng được cả khi máy còn phiên đăng nhập.
export default function ForgotPasswordPage() {
  return (
    <div className="pn-authgate">
      <AuthedRedirect />
      <ForgotPasswordForm />
    </div>
  );
}
