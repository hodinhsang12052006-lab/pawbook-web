import crypto from "crypto";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import type { Provider } from "next-auth/providers/index";

// Đăng nhập Google / Apple — TỰ BẬT khi có biến môi trường, không có thì ẩn.
//   Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//     (Google Cloud Console → OAuth client "Web", Redirect URI:
//      https://www.bitpawos.com/api/auth/callback/google)
//   Apple:  APPLE_ID (Services ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (nội dung file .p8)
//     (Return URL: https://www.bitpawos.com/api/auth/callback/apple)
// Kiểm thử local: OAUTH_ALLOW_TEST=1 + OAUTH_TEST_SERVER=http://127.0.0.1:PORT
//   → bật provider giả "test-oauth" (KHÔNG BAO GIỜ đặt 2 biến này trên Vercel).

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Apple bắt "client secret" là JWT ES256 tự ký bằng khoá .p8 (hạn tối đa 6 tháng). */
function appleClientSecret(): string | null {
  const { APPLE_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) return null;
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "ES256", kid: APPLE_KEY_ID }));
    const payload = b64url(JSON.stringify({ iss: APPLE_TEAM_ID, iat: now, exp: now + 150 * 86400, aud: "https://appleid.apple.com", sub: APPLE_ID }));
    const key = crypto.createPrivateKey(APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"));
    const sig = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
    return `${header}.${payload}.${b64url(sig)}`;
  } catch (err) {
    console.error("Apple client secret error:", err);
    return null;
  }
}

export const appleEnabled = () => appleClientSecret() !== null;

export function oauthProviders(): Provider[] {
  const list: Provider[] = [];
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_ID } = process.env;
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    list.push(GoogleProvider({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }));
  }
  const appleSecret = appleClientSecret();
  if (APPLE_ID && appleSecret) {
    list.push(AppleProvider({ clientId: APPLE_ID, clientSecret: appleSecret }));
  }
  const testServer = process.env.OAUTH_TEST_SERVER;
  if (process.env.OAUTH_ALLOW_TEST === "1" && testServer) {
    list.push({
      id: "test-oauth",
      name: "Test OAuth",
      type: "oauth",
      clientId: "test-client",
      clientSecret: "test-secret",
      checks: ["state"],
      authorization: { url: `${testServer}/authorize`, params: { scope: "email profile" } },
      token: `${testServer}/token`,
      userinfo: `${testServer}/userinfo`,
      profile(p: { sub: string; email: string; name?: string; email_verified?: boolean }) {
        return { id: p.sub, email: p.email, name: p.name ?? null, image: null, email_verified: p.email_verified };
      },
    } as Provider);
  }
  return list;
}
