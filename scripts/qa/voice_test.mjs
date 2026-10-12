// Tin nhắn thoại + gửi ảnh/video + nhật ký cuộc gọi gọn — 2 người, micro giả lập của Chromium.
// Tải lên Cloudinary được CHẶN & giả lập (không đụng kho Cloudinary thật). Chỉ chạy server local.
//   node scripts/qa/voice_test.mjs
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

const R = new Results("Tin nhắn thoại & đính kèm");
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const FAKE_URL = "https://res.cloudinary.com/demo/video/upload/v1/pawbook/video/voice-qa.webm";
async function login(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "vi-VN", permissions: ["microphone"] });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  // Giả lập kho Cloudinary: chữ ký + tải lên trả URL mẫu
  await ctx.route(BASE_URL + "/api/upload/sign", (r) => r.fulfill({ json: { cloudName: "demo", apiKey: "qa", signature: "qa", timestamp: 1, folder: "pawbook/video", allowed_formats: "webm,m4a,mp4" } }));
  await ctx.route("https://api.cloudinary.com/**", (r) => r.fulfill({ json: { secure_url: FAKE_URL } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, me, h, page, errors };
}
const A = await login(SEED_OWNER);
const B = await login(SEED_TECH);
await A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: "Chào em" }, headers: A.h });
await A.page.goto(BASE_URL + `/messages?to=${B.me.id}`);
await B.page.goto(BASE_URL + `/messages?to=${A.me.id}`);
await A.page.getByPlaceholder(/Viết tin nhắn/).first().waitFor({ timeout: 20000 });
await B.page.getByPlaceholder(/Viết tin nhắn/).first().waitFor({ timeout: 20000 });
await A.page.waitForTimeout(1500);

// V1: bấm 🎤 → thanh ghi âm (đồng hồ chạy, sóng âm)
const nVoiceBefore = await B.page.getByRole("button", { name: "Phát tin nhắn thoại" }).count();
await A.page.getByRole("button", { name: "Ghi âm" }).click();
const bar = A.page.getByRole("group", { name: "Đang ghi âm" });
const shown = await bar.waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
// Đồng hồ chỉ chạy khi micro đã bật thật (xin quyền mất ~1 giây) → chờ đủ
await A.page.waitForTimeout(3300);
const clock = shown ? await bar.innerText() : "";
R.check("V1", "Bấm 🎤 → thanh ghi âm: chấm đỏ, đồng hồ chạy (≥ 0:02), nút huỷ + gửi", shown && /0:0[2-9]/.test(clock) && (await A.page.getByRole("button", { name: "Huỷ ghi âm" }).count()) === 1, JSON.stringify({ shown, clock }));

// V2: huỷ → không gửi gì
await A.page.getByRole("button", { name: "Huỷ ghi âm" }).click();
await A.page.waitForTimeout(800);
const backToInput = await A.page.getByPlaceholder(/Viết tin nhắn/).first().isVisible();
R.check("V2", "Bấm 🗑 → huỷ, quay về ô nhập, không gửi tin", backToInput && (await B.page.getByRole("button", { name: "Phát tin nhắn thoại" }).count()) === nVoiceBefore);

// V3: ghi 2 giây → gửi → 2 bên thấy bong bóng thoại có nút phát + thời lượng
await A.page.getByRole("button", { name: "Ghi âm" }).click();
await A.page.getByRole("group", { name: "Đang ghi âm" }).waitFor({ timeout: 6000 });
await A.page.waitForTimeout(2300);
await A.page.getByRole("button", { name: "Gửi tin nhắn thoại" }).click();
const bSees = await B.page.getByRole("button", { name: "Phát tin nhắn thoại" }).nth(nVoiceBefore).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
const aSees = (await A.page.getByRole("button", { name: "Phát tin nhắn thoại" }).count()) > 0;
const dur = bSees ? await B.page.getByRole("button", { name: "Phát tin nhắn thoại" }).last().locator("xpath=..").innerText() : "";
R.check("V3", "Ghi 2 giây → gửi → cả 2 máy thấy bong bóng thoại (nút phát + thời lượng 0:02)", bSees && aSees && /0:0[2-3]/.test(dur), JSON.stringify({ aSees, bSees, dur }));

// V4: máy chủ chặn link âm thanh ngoài Cloudinary
const bad = await A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: "https://evil.example.com/x.webm", type: "AUDIO" }, headers: A.h });
R.check("V4", "Máy chủ chặn tin thoại trỏ ra ngoài Cloudinary (chống theo dõi IP)", bad.status() === 400, String(bad.status()));

// V5: hộp thư hiện "🎤 Tin nhắn thoại"
await B.page.goto(BASE_URL + "/messages");
const preview = await B.page.getByText(/🎤 Tin nhắn thoại/).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
R.check("V5", "Hộp thư: xem trước ghi '🎤 Tin nhắn thoại'", preview);

// V6: nhật ký cuộc gọi là bong bóng gọn phía người gọi + "Gọi lại"
await A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: "missed:audio", type: "CALL" }, headers: A.h });
await B.page.goto(BASE_URL + `/messages?to=${A.me.id}`);
await B.page.getByRole("button", { name: "Gọi lại" }).first().waitFor({ timeout: 15000 }).catch(() => {});
const missed = B.page.locator("p", { hasText: /^Cuộc gọi thoại nhỡ$/ }).last();
const okMissed = await missed.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
const card = okMissed ? await missed.evaluate((e) => { let n = e; while (n && !(n.className || "").toString().includes("rounded-[20px]")) n = n.parentElement; const r = n?.getBoundingClientRect(); return r ? { w: Math.round(r.width), left: Math.round(r.left) } : null; }) : null;
const callBack = await B.page.getByRole("button", { name: "Gọi lại" }).count();
R.check("V6", "Cuộc gọi nhỡ: bong bóng gọn (≤ 240px) nằm phía người gọi, có 'Gọi lại'", okMissed && card && card.w <= 240 && callBack > 0, JSON.stringify({ card, callBack }));

// V7: nút đính kèm nhận cả ảnh lẫn video
const [chooser] = await Promise.all([B.page.waitForEvent("filechooser", { timeout: 8000 }).catch(() => null), B.page.getByRole("button", { name: "Gửi ảnh hoặc video" }).click()]);
const accept = chooser ? await chooser.element().getAttribute("accept") : null;
R.check("V7", "Nút đính kèm chọn được cả ảnh và video", accept === "image/*,video/*", String(accept));

await A.page.screenshot({ path: process.env.TEMP + "/voice_desktop.png" });
await B.page.screenshot({ path: process.env.TEMP + "/voice_b.png" });
R.check("V8", "Không có lỗi JS", !A.errors.length && !B.errors.length, JSON.stringify([...A.errors, ...B.errors]).slice(0, 300));
await browser.close();
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
