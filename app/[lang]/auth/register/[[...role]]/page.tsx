import { notFound } from "next/navigation";
import RegisterFlow from "@/components/auth/RegisterFlow";
import { REGISTER_ROLES, isRegisterRole } from "@/lib/registerRoles";

// /auth/register (role picker) and /auth/register?role=client|technician|owner — the latter lands here through an edge
// rewrite to /auth/register/<role> (next.config.ts REG_ROLE; the browser keeps the ?role= URL). One prerendered page per
// role and language, so the h1 + list / role form are in the first paint: no empty 640 px placeholder replaced after
// hydration (CLS), no LCP wait for hydration. ONE route for the picker and the forms (optional catch-all) so the sign-up
// components stay in a single page bundle (a second route split them into new shared chunks that the landing loaded
// too). Metadata (title, canonical /auth/register) comes from ../layout.tsx; gate + redirect: RegisterFlow.
export function generateStaticParams() {
  return [{ role: [] as string[] }, ...REGISTER_ROLES.map((role) => ({ role: [role] }))];
}
export const dynamicParams = false;

export default async function RegisterPage({ params }: { params: Promise<{ role?: string[] }> }) {
  const { role } = await params;
  if (!role?.length) return <RegisterFlow initialRole={null} />;
  if (role.length !== 1 || !isRegisterRole(role[0])) notFound();
  return <RegisterFlow initialRole={role[0]} />;
}
