import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";
import { ResetPasswordForm } from "@/components/auth/PasswordResetForms";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/reset", {
    title: ["Đặt mật khẩu mới", "Set a new password"],
    noindex: true,
  });
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
