"use client";

import React, { useEffect, useState } from "react";
import TechnicianRegisterForm from "@/components/auth/TechnicianRegisterForm";
import OwnerRegisterForm from "@/components/auth/OwnerRegisterForm";
import ClientRegisterForm from "@/components/auth/ClientRegisterForm";
import RolePicker, { type Role } from "@/components/auth/RolePicker";
import { useTr } from "@/lib/i18n/useTr";
import { useAuthedRedirect } from "@/components/auth/useAuthedRedirect";

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

  // Đã đăng nhập → vào app (dùng chung với /auth/login, /auth/forgot — xem components/auth/useAuthedRedirect.ts).
  useAuthedRedirect();

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
