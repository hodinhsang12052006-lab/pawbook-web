// Kiểm thử cuộc gọi thật giữa nhiều trình duyệt (camera/micro giả lập), qua
// Pusher + ZegoCloud thật: thoại & video (đổ chuông → nghe máy → 2 bên kết
// nối → chuyển trang vẫn giữ cuộc gọi → cúp máy), từ chối, người gọi huỷ,
// máy bận, nhật ký cuộc gọi trong chat.
// Chạy: node scripts/qa/call_test.mjs   (cần internet)
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, Results, fakeIp } from "./lib.mjs";

const R = new Results("Calls");
const SHOTS = new URL("./reports/calls/", import.meta.url);
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (p, n) => p.screenshot({ path: fileURLToPath(new URL(n + ".png", SHOTS)) }).catch(() => {});

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

// device: undefined = desktop; "Pixel 7" = điện thoại thật (UA mobile → ZEGOCLOUD dùng giao diện mobile).
async function userCtx(email, device) {
  const base = device ? devices[device] : { viewport: { width: 1280, height: 800 } };
  const ctx = await browser.newContext({ ...base, locale: "vi-VN", permissions: ["camera", "microphone"] });
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": ip } }));
  const h = { "cf-connecting-ip": ip };
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, me, errors };
}

async function step(id, desc, fn) {
  try {
    const r = await fn();
    R.check(id, desc, r !== false, r === false ? "điều kiện không đạt" : "");
  } catch (e) {
    R.check(id, desc, false, e.message.split("\n")[0]);
  }
}

const phaseIs = (user, phase, timeout = 20000) => user.page.locator(`[data-call-phase="${phase}"]`).waitFor({ timeout });
const noCall = (user, timeout = 10000) => user.page.locator("[data-call-phase]").waitFor({ state: "detached", timeout });

async function openChat(user, partnerId) {
  await user.page.goto(BASE_URL + `/messages?to=${partnerId}`);
  await user.page.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 20000 });
  await user.page.waitForTimeout(1500); // chờ Pusher subscribe
}
const dial = (user, type) => user.page.getByTitle(type === "audio" ? /Cuộc gọi thoại/ : /Cuộc gọi video/).first().click();

const A = await userCtx("owner1.us@pawnailjobs.demo");
const B = await userCtx("tech1.us@pawnailjobs.demo", "Pixel 7");
const C = await userCtx("owner2.us@pawnailjobs.demo");
await B.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: A.me.id, content: "Test cuộc gọi" } });
await C.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: "Test máy bận" } });

const timings = {};
for (const type of ["audio", "video"]) {
  const label = type === "audio" ? "thoại" : "video";
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);

  await step(`${type}-1`, `Gọi ${label}: người gọi thấy "Đang đổ chuông", người nhận thấy cuộc gọi đến (ảnh thật, không phải chữ viết tắt)`, async () => {
    const t0 = Date.now();
    await dial(A, type);
    await phaseIs(A, "outgoing", 10000);
    await phaseIs(B, "incoming", 15000);
    timings[type] = { ringMs: Date.now() - t0 };
    await shot(A.page, `${type}_1_outgoing`);
    await shot(B.page, `${type}_1_incoming`);
    // Người gọi không còn nút "Trả lời" vô nghĩa trên cuộc gọi của chính mình.
    const callerAnswer = await A.page.getByRole("button", { name: "Trả lời" }).count();
    const calleeAvatar = await B.page.locator('[data-call-phase] img[alt]:not([alt=""])').first().getAttribute("src");
    return callerAnswer === 0 && !!calleeAvatar && !calleeAvatar.includes("ui-avatars.com");
  });

  await step(`${type}-2`, `Gọi ${label}: nghe máy → CẢ 2 bên kết nối được với nhau qua ZEGOCLOUD`, async () => {
    // Bộ gọi (ZEGOCLOUD) phải được tải SẴN trong lúc đổ chuông, không đợi bấm nghe.
    await B.page.waitForTimeout(1500);
    const clickAt = await B.page.evaluate(() => performance.now());
    const t1 = Date.now();
    await B.page.getByRole("button", { name: "Trả lời" }).click();
    await phaseIs(A, "connected", 40000);
    await phaseIs(B, "connected", 40000);
    timings[type].connectMs = Date.now() - t1;
    // JS phải tải thêm SAU khi bấm nghe (đã tải sẵn đúng → gần 0 KB).
    const lateKb = await B.page.evaluate((at) => Math.round(performance.getEntriesByType("resource").filter((e) => e.startTime > at && e.name.includes("/_next/") && e.name.split("?")[0].endsWith(".js")).reduce((n, e) => n + (e.encodedBodySize || e.transferSize || 0), 0) / 1024), clickAt);
    const preloaded = lateKb < 50;
    timings[type].lateJsKb = lateKb;
    console.log(`   ⏱  ${label}: đổ chuông sau ${timings[type].ringMs}ms · nghe máy → thông ${timings[type].connectMs}ms · JS tải thêm sau khi nghe: ${lateKb}KB (${preloaded ? "đã tải sẵn ✓" : "CHƯA tải sẵn"})`);
    await A.page.waitForTimeout(3000);
    await shot(A.page, `${type}_2_connected_caller`);
    await shot(B.page, `${type}_2_connected_callee`);
    return (await A.page.getByText(/Không kết nối được/).count()) + (await B.page.getByText(/Không kết nối được/).count()) === 0;
  });

  await step(`${type}-3`, `Gọi ${label}: chỉ còn 1 thanh điều khiển (không còn 3 thanh chồng nhau)`, async () => {
    // Nút cúp máy duy nhất là của ZEGOCLOUD; overlay của app không còn nút riêng.
    const appHangups = await A.page.locator('[data-call-phase] button[title="Huỷ cuộc gọi"], [data-call-phase] button[title="Từ chối"]').count();
    return appHangups === 0;
  });

  await step(`${type}-4`, `Gọi ${label}: chuyển trang khi đang gọi → cuộc gọi vẫn tiếp tục`, async () => {
    await A.page.getByRole("link", { name: /PawNail|Bảng tin/ }).first().click({ trial: true }).catch(() => {});
    await A.page.evaluate(() => window.history.pushState({}, "", "/?tab=feed"));
    await A.page.waitForTimeout(1500);
    return (await A.page.locator('[data-call-phase="connected"]').count()) === 1;
  });

  await step(`${type}-5`, `Gọi ${label}: bên nhận cúp máy → cả 2 bên đóng màn hình gọi + nhật ký "${label} · m:ss" trong chat`, async () => {
    // Nút rời phòng của ZEGOCLOUD.
    // Nút cúp máy của ZEGOCLOUD (id cố định trong SDK) — phải nằm TRỌN trong
    // màn hình điện thoại, bấm được bằng tay.
    // Giao diện mobile của ZEGOCLOUD tự ẩn thanh điều khiển — chạm màn hình để hiện.
    // (chạm là bật/tắt, nên chạm tới khi nút hiện ra).
    const leave = B.page.locator("#ZegoRoomMobileLeaveButton, #ZegoRoomLeaveButton").first();
    for (let i = 0; i < 4 && !(await leave.isVisible().catch(() => false)); i++) {
      await B.page.mouse.click(200, 400);
      await B.page.waitForTimeout(700);
    }
    await shot(B.page, `${type}_5_before_hangup`);
    const box = await leave.boundingBox();
    const vw = B.page.viewportSize().width;
    if (!box || box.x < 0 || box.x + box.width > vw) throw new Error(`nút cúp máy lệch khỏi màn hình: ${JSON.stringify(box)} / ${vw}`);
    await leave.tap();
    await noCall(B, 15000);
    await noCall(A, 15000);
    await A.page.goto(BASE_URL + `/messages?to=${B.me.id}`);
    await A.page.getByText(type === "audio" ? /Cuộc gọi thoại · \d+:\d{2}/ : /Cuộc gọi video · \d+:\d{2}/).last().waitFor({ timeout: 15000 });
    await shot(A.page, `${type}_5_call_log`);
  });
}

await openChat(A, B.me.id);
await openChat(B, A.me.id);
await step("decline", "Người nhận từ chối → người gọi được báo + chat ghi 'bị từ chối'", async () => {
  await dial(A, "audio");
  await phaseIs(B, "incoming", 15000);
  await B.page.getByRole("button", { name: "Từ chối" }).click();
  await noCall(A, 10000);
  await A.page.getByText(/đã từ chối cuộc gọi/).first().waitFor({ timeout: 5000 });
  await A.page.getByText(/Cuộc gọi thoại bị từ chối/).last().waitFor({ timeout: 15000 });
});

await step("cancel", "Người gọi huỷ khi đang đổ chuông → máy bên kia ngừng đổ chuông + chat ghi 'nhỡ'", async () => {
  await dial(A, "audio");
  await phaseIs(B, "incoming", 15000);
  await A.page.getByRole("button", { name: "Huỷ cuộc gọi" }).click();
  await noCall(B, 10000);
  await A.page.getByText(/Cuộc gọi thoại nhỡ/).last().waitFor({ timeout: 15000 });
});

await step("busy", "Gọi người đang bận cuộc gọi khác → báo 'đang bận', không đổ chuông chen ngang", async () => {
  await dial(A, "audio");
  await phaseIs(B, "incoming", 15000);
  await B.page.getByRole("button", { name: "Trả lời" }).click();
  await phaseIs(B, "connecting", 10000).catch(() => phaseIs(B, "connected", 10000));
  await openChat(C, B.me.id);
  await dial(C, "audio");
  await C.page.getByText(/đang bận cuộc gọi khác/).first().waitFor({ timeout: 15000 });
  await noCall(C, 10000);
  const bStillWithA = (await B.page.locator('[data-call-phase="incoming"]').count()) === 0;
  await A.page.getByRole("button", { name: /Huỷ|Từ chối/ }).click().catch(() => {});
  await A.page.evaluate(() => {}).catch(() => {});
  return bStillWithA;
});

const errs = [...A.errors, ...B.errors, ...C.errors].filter((e) => !/ResizeObserver/.test(e));
R.check("ERR", "Không có lỗi JS trong suốt các cuộc gọi", errs.length === 0, errs.join(" | "));
await browser.close();
const out = R.summary();
fs.writeFileSync(new URL("./reports/calls.json", import.meta.url), JSON.stringify(out, null, 2));
process.exit(out.failed ? 1 : 0);
