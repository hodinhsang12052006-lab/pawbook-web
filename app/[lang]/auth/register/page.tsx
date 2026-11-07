import RegisterFlow from "@/components/auth/RegisterFlow";

// /auth/register — the role picker is in the static HTML of each language (h1 + list at first paint; LCP no longer
// waits for hydration). /auth/register?role=… is rewritten to ./[role] (next.config.ts) and prerenders that form.
// Signed-in redirect + gate: components/auth/RegisterFlow.tsx (useAuthedRedirect, .pn-authgate).
export default function RegisterPage() {
  return <RegisterFlow initialRole={null} />;
}
