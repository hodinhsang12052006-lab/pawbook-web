import { notFound } from "next/navigation";
import RegisterFlow from "@/components/auth/RegisterFlow";
import { REGISTER_ROLES, isRegisterRole } from "@/lib/registerRoles";

// /auth/register?role=client|technician|owner lands here through an edge rewrite (next.config.ts, the browser keeps
// the ?role= URL): one prerendered page per role and language, so the role form — not an empty 640 px placeholder — is
// in the first paint (no layout shift when it would have replaced the placeholder, no LCP wait for hydration).
// Metadata (title, canonical /auth/register) comes from ../layout.tsx.
export function generateStaticParams() {
  return REGISTER_ROLES.map((role) => ({ role }));
}
export const dynamicParams = false;

export default async function RegisterRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRegisterRole(role)) notFound();
  return <RegisterFlow initialRole={role} />;
}
