import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";

export const metadata: Metadata = { title: "Quên mật khẩu — PawNail Jobs", robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
