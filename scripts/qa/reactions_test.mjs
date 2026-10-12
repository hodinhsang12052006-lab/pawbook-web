// Thả cảm xúc kiểu Messenger (lưu thật) + bảng Emoji / Sticker / GIF — 2 người trên 2 máy.
// CHỈ chạy với server local.   node scripts/qa/reactions_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, SEED_OWNER_2, Results, fakeIp } from "./lib.mjs";

const R = new Results("Cảm xúc & sticker");
const browser = await chromium.launch();
async function login(email, device) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, me, h, page, errors };
}
const owner = await login(SEED_OWNER, { viewport: { width: 1280, height: 860 } }); // máy tính: rê chuột
const tech = await login(SEED_TECH, devices["Pixel 7"]); // điện thoại: nhấn giữ
const stamp = Date.now().toString().slice(-6);
const sent = await owner.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: tech.me.id, content: `Mai ghé tiệm nha ${stamp}` }, headers: owner.h });
const msgId = (await sent.json()).message?.id;

// API: chặn emoji lạ, chặn người ngoài cuộc trò chuyện
const bad = await owner.ctx.request.post(BASE_URL + "/api/messages/react", { data: { messageId: msgId, emoji: "<script>" }, headers: owner.h });
const outsider = await login(SEED_OWNER_2, devices["Pixel 7"]);
const forb = await outsider.ctx.request.post(BASE_URL + "/api/messages/react", { data: { messageId: msgId, emoji: "❤️" }, headers: outsider.h });
R.check("R1", "API: emoji ngoài bộ cảm xúc → 400; người ngoài cuộc trò chuyện → 403", bad.status() === 400 && forb.status() === 403, `${bad.status()} ${forb.status()}`);

await owner.page.goto(BASE_URL + `/messages?to=${tech.me.id}`);
await tech.page.goto(BASE_URL + `/messages?to=${owner.me.id}`);
const tBubble = tech.page.getByText(`Mai ghé tiệm nha ${stamp}`).last();
await tBubble.waitFor({ timeout: 20000 });
await owner.page.getByText(`Mai ghé tiệm nha ${stamp}`).last().waitFor({ timeout: 20000 });
await tech.page.waitForTimeout(1500);

// Điện thoại: nhấn giữ tin → thanh cảm xúc 7 emoji + Sao chép
const pos = await tech.page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === "auto" && d.querySelectorAll("p").length > 5); return el ? { top: Math.round(el.scrollTop), max: el.scrollHeight - el.clientHeight } : null; });
R.check("R0", "Mở cuộc trò chuyện có ảnh / sticker → dừng đúng ở tin mới nhất (ảnh tải sau không đẩy lệch)", !pos || pos.max - pos.top <= 40, JSON.stringify(pos));
await tBubble.scrollIntoViewIfNeeded();
const box = await tBubble.boundingBox();
if (process.env.DEBUG) { console.log("box", JSON.stringify(box), "vp", JSON.stringify(tech.page.viewportSize())); await tech.page.screenshot({ path: process.env.TEMP + "/r2_before.png" }); }
await tech.page.mouse.move(box.x + 20, box.y + 10);
const cdp = await tech.page.context().newCDPSession(tech.page);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 20, y: box.y + 10 }] });
await tech.page.waitForTimeout(650);
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
const menu = tech.page.getByRole("menu", { name: "Chọn cảm xúc" });
const opened = await menu.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
const nEmoji = opened ? await menu.getByRole("menuitemradio").count() : 0;
const hasCopy = opened ? (await menu.getByRole("menuitem", { name: "Sao chép" }).count()) === 1 : false;
R.check("R2", "Điện thoại: nhấn giữ tin → thanh 7 cảm xúc + nút Sao chép", opened && nEmoji === 7 && hasCopy, JSON.stringify({ opened, nEmoji, hasCopy }));

// Chọn ❤️ → hiện huy hiệu ngay ở máy mình, và máy bên kia (realtime)
if (opened) await menu.getByRole("menuitemradio", { name: "❤️" }).click();
const badgeT = tech.page.getByTitle(/Bấm để gỡ cảm xúc của bạn/).first();
const mineShown = await badgeT.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
const otherSees = await owner.page.locator("button", { hasText: "❤️" }).filter({ hasNotText: "Sao chép" }).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
R.check("R3", "Thả ❤️ → huy hiệu hiện ở máy mình + máy bên kia thấy ngay", mineShown && otherSees, JSON.stringify({ mineShown, otherSees }));

// Máy tính: rê vào tin → nút 🙂 → chọn 😂 → huy hiệu "❤️ 😂 2"
const oBubble = owner.page.getByText(`Mai ghé tiệm nha ${stamp}`).last();
await oBubble.hover();
await owner.page.getByRole("button", { name: "Thả cảm xúc" }).last().click();
await owner.page.getByRole("menu", { name: "Chọn cảm xúc" }).getByRole("menuitemradio", { name: "😂" }).click();
await owner.page.waitForTimeout(1500);
const both = await owner.page.locator("button").filter({ hasText: /2$/ }).filter({ hasText: "😂" }).count();
R.check("R4", "Máy tính: rê vào tin → nút 🙂 → chọn 😂 → huy hiệu gộp 2 cảm xúc, có số 2", both >= 1, String(both));

// Tải lại trang → vẫn còn (đã lưu thật)
await tech.page.reload();
await tech.page.getByText(`Mai ghé tiệm nha ${stamp}`).last().waitFor({ timeout: 20000 });
const persisted = await tech.page.getByTitle(/Bấm để gỡ cảm xúc của bạn/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
R.check("R5", "Tải lại trang → cảm xúc vẫn còn (lưu thật, không mất như trước)", persisted);

// Bấm huy hiệu của mình → gỡ ❤️ (chỉ của mình, 😂 của bên kia vẫn còn)
await tech.page.getByTitle(/Bấm để gỡ cảm xúc của bạn/).first().click();
await tech.page.waitForTimeout(1500);
const remaining = await tech.page.locator("button").filter({ hasText: "😂" }).count();
const mineGone = (await tech.page.getByTitle(/Bấm để gỡ cảm xúc của bạn/).count()) === 0;
R.check("R6", "Bấm huy hiệu của mình → gỡ cảm xúc của mình, cảm xúc người kia vẫn còn", mineGone && remaining >= 1, JSON.stringify({ mineGone, remaining }));

// Bảng biểu tượng: Emoji (nhiều nhóm) · Sticker (theo bộ, gửi được) · GIF
await owner.page.getByRole("button", { name: "Biểu tượng cảm xúc" }).click();
const tabs = owner.page.getByRole("tab");
const tabNames = await tabs.allInnerTexts();
const emojiCount = await owner.page.locator("[role=tablist] ~ *").count();
await owner.page.getByRole("tab", { name: "Sticker" }).click();
const panelStill = (await owner.page.getByRole("tab", { name: "Sticker" }).getAttribute("aria-selected")) === "true";
const panel = owner.page.getByRole("dialog", { name: "Chọn biểu tượng" });
await panel.getByRole("button", { name: "😂", exact: true }).first().click();
const stickerImg = owner.page.locator('img[src*="notoemoji/latest/1f602"]').last();
const stickerShown = await stickerImg.waitFor({ state: "attached", timeout: 15000 }).then(() => true).catch(() => false);
R.check("R7", "Bảng biểu tượng: đủ 3 tab; bấm tab Sticker KHÔNG đóng bảng (lỗi cũ); gửi sticker 😂 → hiện bản hoạt hình", tabNames.join(",") === "Emoji,Sticker,GIF" && panelStill && stickerShown, JSON.stringify({ tabNames, panelStill, stickerShown, emojiCount }));
// Gửi sticker xong bảng tự đóng → mở lại 1 lần, sang tab Emoji
await owner.page.getByRole("button", { name: "Biểu tượng cảm xúc" }).click();
await owner.page.getByRole("tab", { name: "Emoji" }).click();
await owner.page.getByRole("dialog", { name: "Chọn biểu tượng" }).locator("button[aria-label]").nth(20).waitFor({ timeout: 5000 }).catch(() => {});
const groupsN = await owner.page.locator('button[title]').filter({ hasText: /./ }).count();
const emojis = await owner.page.getByRole("dialog", { name: "Chọn biểu tượng" }).locator("button[aria-label]").count();
R.check("R8", "Tab Emoji: nhiều nhóm (mặt cười, cử chỉ, tim, nail & làm đẹp…) và ≥ 60 emoji mỗi nhóm đầu", emojis >= 60, JSON.stringify({ emojis, groupsN }));
await owner.page.screenshot({ path: process.env.TEMP + "/picker_emoji.png" });
await owner.page.getByRole("tab", { name: "GIF" }).click();
await owner.page.locator('img[alt="GIF"]').first().waitFor({ timeout: 8000 }).catch(() => {});
const gifs = await owner.page.locator('img[alt="GIF"]').count();
R.check("R9", "Tab GIF: có danh sách GIF (chưa có khoá GIPHY thì dùng bộ có sẵn)", gifs >= 6, String(gifs));
await owner.page.screenshot({ path: process.env.TEMP + "/picker_gif.png" });

R.check("R10", "Không có lỗi JS ở các máy", !owner.errors.length && !tech.errors.length, JSON.stringify([...owner.errors, ...tech.errors]).slice(0, 300));
await owner.page.keyboard.press("Escape");
await owner.page.screenshot({ path: process.env.TEMP + "/reactions_desktop.png" });
await tech.page.screenshot({ path: process.env.TEMP + "/reactions_phone.png" });
await browser.close();
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
