import crypto from "crypto";

// Thông báo đẩy cho APP NATIVE (Android/iOS qua Firebase Cloud Messaging HTTP v1).
// Web push (trình duyệt/PWA) vẫn đi đường VAPID trong lib/push.ts.
// Bật bằng FIREBASE_SERVICE_ACCOUNT = nội dung file JSON service account
// (Firebase Console → Project settings → Service accounts → Generate key).
// Kiểm thử local: FCM_ALLOW_TEST=1 + FCM_TEST_BASE=http://127.0.0.1:PORT
// (máy chủ giả đóng vai cả oauth2.googleapis.com lẫn fcm.googleapis.com).

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

let sa: ServiceAccount | null | undefined;
function account(): ServiceAccount | null {
  if (sa !== undefined) return sa;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const parsed = raw ? (JSON.parse(raw) as ServiceAccount) : null;
    sa = parsed?.project_id && parsed.client_email && parsed.private_key ? { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") } : null;
  } catch (err) {
    console.error("FIREBASE_SERVICE_ACCOUNT không đọc được:", err);
    sa = null;
  }
  return sa;
}

const testBase = () => (process.env.FCM_ALLOW_TEST === "1" && process.env.FCM_TEST_BASE ? process.env.FCM_TEST_BASE.replace(/\/$/, "") : null);
const tokenUrl = () => (testBase() ? `${testBase()}/token` : "https://oauth2.googleapis.com/token");
const sendUrl = (project: string) => `${testBase() ?? "https://fcm.googleapis.com"}/v1/projects/${project}/messages:send`;

export const fcmEnabled = () => account() !== null;

// Access token Google (hạn 1 giờ) — ký JWT RS256 bằng khoá service account.
let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string | null> {
  const a = account();
  if (!a) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), a.private_key).toString("base64url");
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(10_000),
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !d.access_token) {
    console.error("FCM token error:", res.status);
    return null;
  }
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export interface FcmPayload { title: string; body: string; url: string; tag?: string }

/** Gửi tới các token thiết bị. Trả về danh sách token đã hết hạn (để dọn khỏi DB). */
export async function sendFcm(tokens: string[], p: FcmPayload): Promise<{ sent: number; dead: string[] }> {
  const a = account();
  if (!a || !tokens.length) return { sent: 0, dead: [] };
  const token = await accessToken();
  if (!token) return { sent: 0, dead: [] };
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    tokens.map(async (t) => {
      try {
        const res = await fetch(sendUrl(a.project_id), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: t,
              notification: { title: p.title.slice(0, 80), body: p.body.slice(0, 180) },
              data: { url: p.url, tag: p.tag ?? "" },
              android: { priority: "high", notification: { tag: p.tag, sound: "default" } },
              apns: { payload: { aps: { sound: "default", "thread-id": p.tag ?? "pawnail" } } },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) sent++;
        else {
          const body = await res.text().catch(() => "");
          // Token hết hạn / app đã gỡ → dọn khỏi DB.
          if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(body)) dead.push(t);
          else console.error("FCM send error:", res.status, body.slice(0, 200));
        }
      } catch (err) {
        console.error("FCM send error:", (err as Error).message);
      }
    })
  );
  return { sent, dead };
}
