// Helper dùng chung cho bộ QA (security_api / load_test / ui_audit).
// CHỈ chạy với server local trỏ vào prisma/dev.db — KHÔNG trỏ BASE_URL vào
// production: các script tạo/xóa tài khoản, đăng bài, nhắn tin thật.
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

if (/bitpawos\.com/.test(BASE_URL) && !process.env.QA_ALLOW_PROD) {
  console.error("❌ BASE_URL trỏ vào production — script QA ghi dữ liệu thật. Dừng.");
  process.exit(1);
}

export const DEMO_PASSWORD = "Demo@12345";
export const SEED_OWNER = "owner1.us@pawnailjobs.demo";
export const SEED_OWNER_2 = "owner2.us@pawnailjobs.demo";
export const SEED_TECH = "tech1.us@pawnailjobs.demo";

// Mỗi bộ test bắt đầu ở dải IP NGẪU NHIÊN — trước đây bộ nào cũng bắt đầu 10.99.0.1 nên các bộ chạy liền nhau
// dùng chung IP và cùng chạm giới hạn đăng ký 5 lần/5 phút (bộ chạy sau bị chặn oan).
const IP_BASE = Math.floor(Math.random() * 200) + 20;
let ipCounter = 1;
// Mỗi phiên đăng nhập giả lập 1 IP riêng (cf-connecting-ip) để bộ chống
// brute-force theo IP không chặn chính bộ test.
export const fakeIp = () => `10.${IP_BASE}.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function mergeCookies(jar, res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

export class Client {
  constructor(ip = fakeIp()) {
    this.jar = {};
    this.ip = ip;
    this.userId = null;
  }
  async req(path, { method = "GET", json, body, headers = {} } = {}) {
    const h = { "cf-connecting-ip": this.ip, ...headers };
    if (Object.keys(this.jar).length) h.cookie = cookieHeader(this.jar);
    if (json !== undefined) {
      h["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const res = await fetch(BASE_URL + path, { method, headers: h, body, redirect: "manual" });
    mergeCookies(this.jar, res);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  async login(email, password = DEMO_PASSWORD) {
    const csrf = await this.req("/api/auth/csrf");
    const form = new URLSearchParams({ csrfToken: csrf.data.csrfToken, email, password, json: "true" });
    const r = await this.req("/api/auth/callback/credentials", {
      method: "POST",
      body: form.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const s = await this.req("/api/auth/session");
    this.userId = s.data?.user?.id || null;
    return { status: r.status, ok: !!this.userId, session: s.data };
  }
}

export async function registerUser(overrides = {}) {
  const c = new Client();
  const stamp = Date.now() + Math.floor(Math.random() * 1e6);
  const body = {
    name: "QA Tester",
    email: `qa.${stamp}@qa.test`,
    password: "QaPass#2026",
    role: "TECHNICIAN",
    market: "US",
    phone: "+1 555 0100",
    state: "CA",
    city: "San Jose",
    specialties: ["Bột/Acrylic"],
    ...overrides,
  };
  const r = await c.req("/api/register", { method: "POST", json: body });
  return { client: c, body, res: r };
}

// Ghi nhận kết quả kiểm thử dạng bảng.
export class Results {
  constructor(name) {
    this.name = name;
    this.rows = [];
  }
  check(id, desc, pass, detail = "") {
    this.rows.push({ id, desc, pass: !!pass, detail: String(detail).slice(0, 300) });
    console.log(`${pass ? "✅" : "❌"} [${id}] ${desc}${pass ? "" : "  → " + detail}`);
  }
  /** Không chạy được vì MÔI TRƯỜNG (VD máy local không có khoá Pusher) — không tính là lỗi, nhưng in rõ lý do. */
  skip(id, desc, reason) {
    this.rows.push({ id, desc, pass: true, skipped: true, detail: String(reason).slice(0, 300) });
    console.log(`⏭️  [${id}] ${desc}  → SKIP (${reason})`);
  }
  summary() {
    const failed = this.rows.filter((r) => !r.pass);
    const skipped = this.rows.filter((r) => r.skipped).length;
    const ran = this.rows.length - skipped;
    console.log(`\n${this.name}: ${ran - failed.length}/${ran} PASS${skipped ? ` · ${skipped} SKIP` : ""}`);
    return { name: this.name, total: this.rows.length, failed: failed.length, skipped, rows: this.rows };
  }
}

/** Ô soạn tin nhắn (textarea [data-chat-input]): điện thoại (chạm) Enter = xuống dòng, gửi bằng nút "Gửi tin nhắn"
 *  (components/chat/MessagesContent.tsx). Máy tính: Enter vẫn gửi. Điền + bấm nút → đúng ở cả hai. */
export async function sendChat(page, text) {
  const input = page.locator("[data-chat-input]").filter({ visible: true }).first();
  await input.fill(text);
  await page.getByRole("button", { name: /^(Gửi tin nhắn|Send message)$/ }).first().click();
}

/** Realtime (Pusher) có cấu hình trên máy chủ này không? `request` = APIRequestContext ĐÃ đăng nhập
 *  (/api/pusher/auth trả 503 khi thiếu PUSHER_APP_ID/KEY/SECRET/CLUSTER). Máy local thường không có khoá → các bước
 *  cần realtime in "SKIP (no Pusher keys)" thay vì báo lỗi. */
export async function pusherConfigured(request) {
  const r = await request.post(BASE_URL + "/api/pusher/auth", { form: { socket_id: "1.1", channel_name: "private-qa-probe" } });
  return r.status() !== 503;
}
/** Trình duyệt báo thiếu khoá Pusher phía client (NEXT_PUBLIC_PUSHER_APP_KEY / CLUSTER lúc build). */
export const PUSHER_CLIENT_MISSING = /Thiếu cấu hình Pusher Client/;
