import React from "react";
import LoginForm from "@/components/auth/LoginForm";
import { AuthedRedirect } from "@/components/auth/useAuthedRedirect";

// Trang tĩnh; người đã đăng nhập được đưa vào app phía client (giữ ?error= của OAuth, ?callbackUrl=).
export default function CustomLoginPage() {
  return (
    <>
      <AuthedRedirect />
      <LoginForm />
    </>
  );
}
