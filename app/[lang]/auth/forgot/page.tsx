import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/forgot", {
    title: ["Quên mật khẩu", "Forgot password"],
    noindex: true,
  });
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
