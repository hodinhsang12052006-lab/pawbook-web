import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/PasswordResetForms";

export const metadata: Metadata = { title: "Đặt mật khẩu mới — PawNail Jobs", robots: { index: false } };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
