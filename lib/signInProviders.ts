import { smsEnabled } from "@/lib/sms";
import { oauthProviders } from "@/lib/authProviders";

/**
 * Sign-in buttons the server has switched on (same env gates as `providers` in lib/authOptions.ts; "credentials" is the
 * email form, not a button). Read by the /auth/login and /auth/register layouts while their static HTML is prerendered —
 * on Vercel the build env is the runtime env — so the buttons are in the first paint instead of being inserted above
 * the email form when getProviders() resolves (CLS 0.11–0.16 on phones). SocialLogin still calls getProviders() to
 * correct a server started with a different env than its build (local `next start` with the QA env).
 */
export function signInProviderIds(): string[] {
  return [...(smsEnabled() ? ["phone-otp"] : []), ...oauthProviders().map((p) => p.id)];
}
