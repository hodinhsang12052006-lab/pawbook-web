"use client";

import React, { useEffect, useState } from "react";
import TechnicianRegisterForm from "@/components/auth/TechnicianRegisterForm";
import OwnerRegisterForm from "@/components/auth/OwnerRegisterForm";
import ClientRegisterForm from "@/components/auth/ClientRegisterForm";
import RolePicker, { type Role } from "@/components/auth/RolePicker";
import { useTr } from "@/lib/i18n/useTr";

export default function CustomRegisterPage() {
  useTr();
  const [role, setRole] = useState<Role>(null);
  const [ready, setReady] = useState(false);

  // Đọc ?role= trên URL phía client (tránh useSearchParams + Suspense —
  // từng gây double-render/kẹt loading trên Next 16 dev mode, xem app/page.tsx).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("role");
    if (r === "technician" || r === "owner" || r === "client") setRole(r);
    setReady(true);
  }, []);

  // Chặn đứng: phát hiện qua test thật trên production rằng người dùng ĐÃ
  // đăng nhập thành công (session hợp lệ) vẫn có thể bị điều hướng tới đây
  // (nguyên nhân sâu xa chưa xác định được — chỉ xảy ra trên hạ tầng
  // production/Vercel, không tái hiện được ở local `next start`, và chỉ xảy
  // ra với request dạng RSC soft-navigation chứ không phải document load
  // thường — đã thử: xoá pages.newUser, tắt service worker, context trình
  // duyệt hoàn toàn sạch, đều không hết). Vì fetch thẳng "/" bằng document
  // request LUÔN trả đúng nội dung (đã verify bằng curl + fetch trực tiếp),
  // chốt chặn này bắt đúng triệu chứng: nếu phát hiện có session hợp lệ mà
  // lại đang đứng ở trang đăng ký, buộc HARD RELOAD (không dùng router.push)
  // để né hẳn đường dẫn RSC bị lỗi, đưa thẳng người dùng về trang chủ.
  useEffect(() => {
    // Chặn vòng lặp: nếu "/" TỰ NÓ cũng đang bị đá về đây (nguyên nhân gốc
    // chưa xác định chắc chắn 100%, nghi do cold-start phía Vercel — có lúc
    // tái hiện, có lúc không), redirect thẳng lại "/" mà không kiểm tra gì
    // sẽ tạo vòng lặp vô hạn /→/auth/register→/→/auth/register... còn TỆ
    // HƠN bug gốc (trước chỉ là sai trang, giờ là treo hẳn không dùng được).
    // Chỉ bounce 1 lần trong mỗi 5 giây; nếu quay lại đây quá nhanh, dừng
    // hẳn và hiện trang đăng ký bình thường thay vì lặp mãi.
    const lastBounceAt = Number(sessionStorage.getItem("authBounceAt") || 0);
    if (Date.now() - lastBounceAt < 5000) return;

    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((session) => {
        if (session?.user?.id) {
          sessionStorage.setItem("authBounceAt", String(Date.now()));
          window.location.replace("/");
        }
      })
      .catch(() => {});
  }, []);

  const pickRole = (r: Role) => {
    setRole(r);
    const url = new URL(window.location.href);
    if (r) url.searchParams.set("role", r);
    else url.searchParams.delete("role");
    window.history.replaceState({}, "", url.toString());
    window.scrollTo({ top: 0 });
  };
  const back = () => pickRole(null);

  // ?role= is read after mount: hold the column's space (top-aligned column → no layout shift when it fills).
  if (!ready) return <div aria-hidden style={{ minHeight: 640 }} />;

  if (role === "technician") return <TechnicianRegisterForm onBack={back} />;
  if (role === "owner") return <OwnerRegisterForm onBack={back} />;
  if (role === "client") return <ClientRegisterForm onBack={back} />;
  return <RolePicker onPick={pickRole} />;
}
