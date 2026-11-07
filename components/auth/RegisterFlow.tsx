"use client";

import React, { useEffect, useState } from "react";
import TechnicianRegisterForm from "@/components/auth/TechnicianRegisterForm";
import OwnerRegisterForm from "@/components/auth/OwnerRegisterForm";
import ClientRegisterForm from "@/components/auth/ClientRegisterForm";
import RolePicker, { type Role } from "@/components/auth/RolePicker";
import { useTr } from "@/lib/i18n/useTr";
import { useAuthedRedirect } from "@/components/auth/useAuthedRedirect";
import { isRegisterRole } from "@/lib/registerRoles";

// /auth/register: role picker, or one role's sign-up form. Both are in the static HTML (server-rendered per language):
//   /auth/register              → app/[lang]/auth/register/page.tsx          → initialRole null (picker)
//   /auth/register?role=client  → app/[lang]/auth/register/[role]/page.tsx   → initialRole "client" (edge rewrite on
//                                 ?role=, next.config.ts — the browser URL keeps ?role=)
// so the first paint already has the h1 + the list / form at its final height: no empty placeholder replaced after
// hydration (CLS 0.11–0.18 on role pages, LCP 6–8 s on a throttled phone). Picking a role / "All account types" stays
// client-side (history.replaceState keeps ?role= in step for a reload or a shared link).
// .pn-authgate: a device that was signed in before (html[data-authed]) keeps this content invisible until
// useAuthedRedirect either redirects or opens the gate — the guest form never flashes before the redirect (auth.css).
export default function RegisterFlow({ initialRole }: { initialRole: Role }) {
  useTr();
  const [role, setRole] = useState<Role>(initialRole);

  // Safety net: a ?role= that reached the plain page (no rewrite in front, e.g. an unusual proxy) — after mount.
  useEffect(() => {
    if (initialRole) return;
    const r = new URLSearchParams(window.location.search).get("role");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- static page: the URL is only readable after hydration
    if (isRegisterRole(r)) setRole(r);
  }, [initialRole]);

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

  return (
    <div className="pn-authgate">
      {role === "technician" ? (
        <TechnicianRegisterForm onBack={back} />
      ) : role === "owner" ? (
        <OwnerRegisterForm onBack={back} />
      ) : role === "client" ? (
        <ClientRegisterForm onBack={back} />
      ) : (
        <RolePicker onPick={pickRole} />
      )}
    </div>
  );
}
