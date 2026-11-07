import React from "react";
import LoginForm from "@/components/auth/LoginForm";
import { AuthedRedirect } from "@/components/auth/useAuthedRedirect";

// Trang tĩnh; người đã đăng nhập được đưa vào app phía client (giữ ?error= của OAuth, ?callbackUrl=). .pn-authgate: máy
// từng đăng nhập không thấy form khách nháy lên trước khi chuyển (components/auth/useAuthedRedirect.ts, auth.css).
export default function CustomLoginPage() {
  return (
    <div className="pn-authgate">
      <AuthedRedirect />
      <LoginForm />
    </div>
  );
}
