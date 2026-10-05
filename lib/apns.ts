import crypto from "crypto";
import http2 from "http2";

// Thông báo đẩy cho iPhone (app native) gửi THẲNG qua Apple APNs bằng khoá
// .p8 (token-based) — plugin Capacitor trên iOS trả token APNs, không phải
// token Firebase. Android vẫn đi qua FCM (lib/fcm.ts).
// Biến môi trường:
//   APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (nội dung .p8), APNS_BUNDLE_ID (com.bitpawos.app)
//   APNS_PRODUCTION=1 cho bản App Store/TestFlight (bỏ trống = sandbox khi chạy từ Xcode)
// Kiểm thử local: APNS_ALLOW_TEST=1 + APNS_TEST_BASE=https://127.0.0.1:PORT

function cfg() {
  const { APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID } = process.env;
  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_PRIVATE_KEY || !APNS_BUNDLE_ID) return null;
  const test = process.env.APNS_ALLOW_TEST === "1" ? process.env.APNS_TEST_BASE : undefined;
  const base = test || (process.env.APNS_PRODUCTION === "1" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com");
  return { team: APNS_TEAM_ID, keyId: APNS_KEY_ID, key: APNS_PRIVATE_KEY.replace(/\\n/g, "\n"), topic: APNS_BUNDLE_ID, base };
}

export const apnsEnabled = () => cfg() !== null;

// JWT ES256 cho APNs — Apple cho dùng lại tối đa 1 giờ, làm mới mỗi 50 phút.
let jwtCache: { token: string; at: number } | null = null;
function providerToken(c: NonNullable<ReturnType<typeof cfg>>): string {
  if (jwtCache && Date.now() - jwtCache.at < 50 * 60_000) return jwtCache.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: c.keyId })}.${b64({ iss: c.team, iat: Math.floor(Date.now() / 1000) })}`;
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: crypto.createPrivateKey(c.key), dsaEncoding: "ieee-p1363" }).toString("base64url");
  jwtCache = { token: `${unsigned}.${sig}`, at: Date.now() };
  return jwtCache.token;
}

export interface ApnsPayload { title: string; body: string; url: string; tag?: string }

/** Gửi tới các token iPhone. Trả về token đã hết hạn (410/BadDeviceToken) để dọn khỏi DB. */
export async function sendApns(tokens: string[], p: ApnsPayload): Promise<{ sent: number; dead: string[] }> {
  const c = cfg();
  if (!c || !tokens.length) return { sent: 0, dead: [] };
  let jwt: string;
  try {
    jwt = providerToken(c);
  } catch (err) {
    console.error("APNs key error:", (err as Error).message);
    return { sent: 0, dead: [] };
  }
  const body = JSON.stringify({
    aps: { alert: { title: p.title.slice(0, 80), body: p.body.slice(0, 180) }, sound: "default", "thread-id": p.tag || "pawnail" },
    url: p.url,
  });
  return new Promise((resolve) => {
    let sent = 0;
    const dead: string[] = [];
    let pending = tokens.length;
    const client = http2.connect(c.base);
    const finish = () => {
      if (--pending === 0) {
        client.close();
        resolve({ sent, dead });
      }
    };
    client.on("error", (err) => {
      console.error("APNs connect error:", err.message);
      client.destroy();
      resolve({ sent, dead });
    });
    client.setTimeout(15_000, () => client.destroy());
    for (const t of tokens) {
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${t}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": c.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        ...(p.tag ? { "apns-collapse-id": p.tag.slice(0, 64) } : {}),
        "content-type": "application/json",
      });
      let status = 0;
      let resp = "";
      req.on("response", (h) => (status = Number(h[":status"])));
      req.on("data", (d) => (resp += d));
      req.on("end", () => {
        if (status === 200) sent++;
        else if (status === 410 || /BadDeviceToken|Unregistered/.test(resp)) dead.push(t);
        else console.error("APNs send error:", status, resp.slice(0, 200));
        finish();
      });
      req.on("error", () => finish());
      req.end(body);
    }
  });
}
