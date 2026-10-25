// TRỢ LÝ PAWNAIL trong Messenger — chạy đều cho CẢ 2 PHÍA trên trình duyệt thật (iPhone):
//  • THỢ: khách hỏi giá → chip "Gửi bảng giá" có giá THẬT từ menu thợ → bấm thì câu điền sẵn vào ô (KHÔNG tự gửi) →
//    thợ bấm Gửi → khách nhận đúng giá + link menu. Khách gửi ảnh tay → chip Vẽ thử / Soi tay → Soi ảnh trong chat →
//    "Gửi tư vấn cho khách". Khách nhắn tiếng Anh → gợi ý tiếng Anh.
//  • KHÁCH: lối tắt Menu & đặt lịch / Thử mẫu trên tay & gửi tiệm / Gửi ảnh; ✨ Thử mẫu trên tay MÌNH → "Gửi cho tiệm";
//    chat trống → câu mở đầu hỏi lịch / giá (không phải hỏi tuyển thợ).
// CHỈ chạy với server local (tạo thợ + khách QA mới trong dev.db).
//   node scripts/qa/chat_assist_test.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, fakeIp, registerUser } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("chat_assist_test chỉ chạy với server local");
const OUT = process.env.TEMP || ".";
const R = new Results("Trợ lý PawNail trong Messenger (2 phía)");
const HAND = path.resolve("scripts/qa/fixtures/hand.jpg");
const handB64 = "data:image/jpeg;base64," + fs.readFileSync(HAND).toString("base64");
const bodyOf = (m) => m.body || m.content || "";

// ---- dữ liệu: 1 thợ mới có menu thật + 3 khách mới ----
const techReg = await registerUser({ name: "QA Thợ Trợ Lý", role: "TECHNICIAN" });
const tech = new Client();
await tech.login(techReg.body.email, techReg.body.password);
for (const it of [
  { category: "HAND", name: "Gel-X ombre", technique: "Gel-X", priceFrom: 55, priceTo: 70, minutes: 75 },
  { category: "HAND", name: "Sơn gel trơn", technique: "Gel", priceFrom: 35, minutes: 45 },
]) await tech.req("/api/menu", { method: "POST", json: it });
const hidden = await tech.req("/api/menu", { method: "POST", json: { category: "HAND", name: "Món đang ẩn QA", technique: "Gel", priceFrom: 99, minutes: 30 } });
const hiddenId = hidden.data?.item?.id;
if (hiddenId) await tech.req(`/api/menu/${hiddenId}`, { method: "PATCH", json: { active: false } });

const mkClient = async (name) => {
  const reg = await registerUser({ name, role: "CLIENT", specialties: undefined });
  const c = new Client();
  await c.login(reg.body.email, reg.body.password);
  return { reg, c };
};
const vi = await mkClient("QA Khách Hỏi Giá");
const en = await mkClient("QA Client English");
const fresh = await mkClient("QA Khách Mới");
// thợ CHƯA có menu giá
const bareReg = await registerUser({ name: "QA Thợ Chưa Menu", role: "TECHNICIAN" });
const bare = new Client();
await bare.login(bareReg.body.email, bareReg.body.password);
await fresh.c.req("/api/messages", { method: "POST", json: { receiverId: bare.userId, content: "Giá bao nhiêu ạ?" } });

const first = await vi.c.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: "Chào tiệm, giá bao nhiêu ạ?" } });
const convId = first.data?.conversationId || first.data?.message?.conversationId;
await en.c.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: "Hi! How much for a full set?" } });
const msgs = async () => (await tech.req(`/api/messages?conversationId=${convId}`)).data?.messages ?? [];

const browser = await chromium.launch();
async function ui(email, password) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password, json: "true" }, headers: h });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, errors };
}
const chips = (p) => p.locator('[data-testid="chat-assist"]');

try {
  // ================= PHÍA THỢ =================
  const T = await ui(techReg.body.email, techReg.body.password);
  const p = T.page;
  await p.goto(BASE_URL + `/messages?to=${vi.c.userId}`);
  const bar = chips(p);
  const shown = await bar.waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  const priceChip = bar.getByRole("button", { name: /Gửi bảng giá/ });
  const priceTitle = shown && (await priceChip.count()) ? await priceChip.first().getAttribute("title") : "";
  R.check("P1", "Thợ mở chat khách vừa hỏi giá → thanh Gợi ý hiện, chip đầu \"💲 Gửi bảng giá\" có giá THẬT từ menu (Gel-X ombre $55–70, Sơn gel trơn $35), KHÔNG lộ món đang ẩn",
    shown && /Gel-X ombre \$55–70/.test(priceTitle) && /Sơn gel trơn \$35/.test(priceTitle) && !/Món đang ẩn|\$99/.test(priceTitle), priceTitle);
  await p.screenshot({ path: `${OUT}/ca_pro_suggest.png` });

  const n0 = (await msgs()).length;
  await priceChip.first().click();
  const input = p.locator(".pn-composer input[type=text]");
  const filled = await input.inputValue();
  const sendOn = await p.getByRole("button", { name: "Gửi tin nhắn" }).isEnabled();
  await p.waitForTimeout(800);
  const n1 = (await msgs()).length;
  R.check("P2", "Bấm gợi ý → câu ĐIỀN SẴN vào ô nhập để thợ sửa (nút Gửi bật), KHÔNG tự gửi thay thợ", filled.startsWith("Dạ giá bên em:") && sendOn && n1 === n0, JSON.stringify({ filled: filled.slice(0, 80), sendOn, n0, n1 }));
  await input.press("Enter");
  await p.waitForTimeout(1500);
  const sent = (await msgs()).find((m) => m.senderId === tech.userId && /Gel-X ombre \$55–70/.test(bodyOf(m)));
  R.check("P3", "Thợ bấm Gửi → khách nhận đúng bảng giá + link menu đặt lịch của thợ", !!sent && bodyOf(sent).includes(`/menu/${tech.userId}`), bodyOf(sent || {}).slice(0, 140));
  const afterReply = await bar.getByRole("button").allInnerTexts().catch(() => []);
  R.check("P4", "Đã trả lời → gợi ý chuyển sang bước tiếp: chip đầu là \"Mời gửi ảnh mẫu\", có link đặt lịch", /Mời gửi ảnh mẫu/.test(afterReply[0] || "") && afterReply.some((t) => /đặt lịch/i.test(t)), JSON.stringify(afterReply));

  // khách gửi ảnh tay → thợ thấy Vẽ thử / Soi tay → Soi ảnh này → Gửi tư vấn
  await vi.c.req("/api/messages", { method: "POST", json: { conversationId: convId, content: handB64, type: "IMAGE" } });
  await p.reload();
  await bar.waitFor({ timeout: 25000 }).catch(() => {});
  const imgChips = await bar.getByRole("button").allInnerTexts().catch(() => []);
  R.check("P5", "Khách gửi ảnh tay → gợi ý \"✨ Vẽ thử mẫu lên tay khách\" + \"🔍 Soi tay tư vấn\" + báo giá theo menu", imgChips.some((t) => /Vẽ thử mẫu/.test(t)) && imgChips.some((t) => /Soi tay/.test(t)) && imgChips.some((t) => /Báo giá/.test(t)), JSON.stringify(imgChips));
  await bar.getByRole("button", { name: /Soi tay/ }).click();
  const dlg = p.locator('[data-testid="chat-consult"]');
  const dlgOpen = await dlg.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  const chatImgBtn = dlg.getByRole("button", { name: /Soi ảnh này/ });
  const hasChatImg = dlgOpen && (await chatImgBtn.waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  R.check("P6", "Bấm Soi tay → hộp Soi tay mở NGAY TRONG CHAT với chính ảnh khách vừa gửi (\"Soi ảnh này\"), không phải rời cuộc trò chuyện", dlgOpen && hasChatImg, JSON.stringify({ dlgOpen, hasChatImg }));
  if (hasChatImg) {
    await dlg.locator('[data-testid="consult-consent"]').click();
    await chatImgBtn.click();
    const shareBtn = dlg.getByRole("button", { name: /Gửi tư vấn cho khách/ });
    const got = await shareBtn.waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
    await p.screenshot({ path: `${OUT}/ca_pro_consult.png` });
    if (got) {
      const before = (await msgs()).length;
      await shareBtn.click();
      await dlg.waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(1200);
      const all = await msgs();
      const advice = all.slice(before).find((m) => m.senderId === tech.userId);
      R.check("P7", "\"Gửi tư vấn cho khách\" → khách nhận 1 tin tư vấn gọn (dáng / màu / dịch vụ + giá menu), hộp tự đóng", !!advice && bodyOf(advice).split("\n").length >= 3 && (await dlg.count()) === 0, bodyOf(advice || {}).slice(0, 200));
    } else R.check("P7", "Soi ảnh trong chat ra kết quả", false, "không thấy nút Gửi tư vấn sau 90s");
  } else R.check("P7", "Soi ảnh trong chat ra kết quả", false, "hộp Soi tay không mở");

  // khách nhắn tiếng Anh → gợi ý tiếng Anh
  await p.goto(BASE_URL + `/messages?to=${en.c.userId}`);
  await bar.waitFor({ timeout: 25000 }).catch(() => {});
  const enTitle = await bar.getByRole("button").first().getAttribute("title").catch(() => "");
  R.check("P8", "Khách nhắn tiếng Anh (\"How much for a full set?\") → gợi ý trả lời bằng tiếng Anh, cùng giá menu", /^Our prices: Gel-X ombre \$55–70/.test(enTitle || ""), enTitle);

  // thợ chưa có menu: KHÔNG bịa giá, mời thêm menu giá
  const B = await ui(bareReg.body.email, bareReg.body.password);
  await B.page.goto(BASE_URL + `/messages?to=${fresh.c.userId}`);
  const bbar = chips(B.page);
  await bbar.waitFor({ timeout: 25000 }).catch(() => {});
  const bTitles = await bbar.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("title") || ""));
  const addMenu = await bbar.locator('[data-testid="chat-assist-add-menu"]').getAttribute("href").catch(() => null);
  R.check("P9", "Thợ CHƯA có menu giá, khách hỏi giá → gợi ý KHÔNG bịa giá (mời gửi ảnh để báo giá) + chip \"＋ Thêm menu giá\" mở đúng trang menu của thợ",
    bTitles.length >= 1 && !bTitles.some((t) => /\$\d/.test(t)) && /gửi em ảnh/.test(bTitles[0]) && /\/profile\/.+\?tab=menu$/.test(addMenu || ""), JSON.stringify({ bTitles, addMenu }));
  await B.ctx.close();

  // ================= PHÍA KHÁCH =================
  const C = await ui(vi.reg.body.email, vi.reg.body.password);
  const q = C.page;
  await q.goto(BASE_URL + `/messages?to=${tech.userId}`);
  const cbar = chips(q);
  const cShown = await cbar.waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  const menuHref = cShown ? await cbar.getByRole("link", { name: /Menu & đặt lịch/ }).getAttribute("href") : null;
  const cBtns = cShown ? await cbar.getByRole("button").allInnerTexts() : [];
  R.check("K1", "Khách mở chat với thợ → lối tắt: \"Menu & đặt lịch\" (đúng menu thợ) · \"Thử mẫu trên tay & gửi tiệm\" · \"Gửi ảnh tay để tư vấn\"; KHÔNG thấy gợi ý trả lời của thợ",
    menuHref === `/menu/${tech.userId}` && cBtns.some((t) => /Thử mẫu trên tay/.test(t)) && cBtns.some((t) => /Gửi ảnh tay/.test(t)) && !cBtns.some((t) => /Gửi bảng giá|Soi tay/.test(t)), JSON.stringify({ menuHref, cBtns }));
  await q.screenshot({ path: `${OUT}/ca_client_bar.png` });

  const nBefore = (await msgs()).length;
  await cbar.getByRole("button", { name: /Thử mẫu trên tay/ }).click();
  const sd = q.getByRole("dialog", { name: /Thử mẫu PawNail — thử mẫu trên tay bạn/ });
  const sdOpen = await sd.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  if (sdOpen) await sd.locator("button img").first().waitFor({ timeout: 20000 }).catch(() => {}); // Studio tải động
  const ownPhoto = sdOpen ? await sd.locator("button img").count() : 0;
  R.check("K2", "Khách bấm Thử mẫu → hộp \"Thử mẫu trên tay bạn\" mở với ảnh tay CHÍNH KHÁCH đã gửi (không lẫn ảnh của tiệm)", sdOpen && ownPhoto >= 1, JSON.stringify({ sdOpen, ownPhoto }));
  if (sdOpen && ownPhoto) {
    await sd.locator("button img").first().click();
    await sd.getByRole("img", { name: "Ảnh tay khách" }).waitFor({ timeout: 20000 });
    await q.waitForFunction(() => !document.body.innerText.includes("Đang tìm móng trên ảnh"), null, { timeout: 30000 }).catch(() => {});
    // móng sót → chạm 1 lần vào giữa từng móng (như khách làm)
    const img = sd.getByRole("img", { name: "Ảnh tay khách" });
    for (const [x, y] of [[276, 375], [381, 370], [500, 368], [618, 362]]) {
      const n = await q.evaluate(() => document.querySelectorAll('[role=dialog] svg[data-testid="nail-overlay"] polygon[data-nail]').length);
      if (n >= 4) break;
      const has = await q.evaluate(([cx, cy]) => [...document.querySelectorAll('[role=dialog] svg[data-testid="nail-overlay"] polygon[data-nail]')].some((e) => {
        const pts = (e.getAttribute("points") || "").trim().split(/\s+/).map((s) => s.split(",").map(Number));
        const mx = pts.reduce((a, v) => a + v[0], 0) / pts.length, my = pts.reduce((a, v) => a + v[1], 0) / pts.length;
        return Math.hypot(mx - cx, my - cy) < 40;
      }), [x, y]);
      if (has) continue;
      const box = await img.boundingBox();
      await q.mouse.click(box.x + (x / 900) * box.width, box.y + (y / 900) * box.height);
      await q.waitForFunction((n0) => document.querySelectorAll('[role=dialog] svg[data-testid="nail-overlay"] polygon[data-nail]').length > n0, n, { timeout: 15000 }).catch(() => {});
    }
    await sd.getByRole("button", { name: /Tạo mẫu/ }).click();
    const looks = sd.locator("button[aria-pressed]");
    await looks.first().waitFor({ timeout: 20000 });
    await q.waitForTimeout(2500);
    await looks.nth(0).click();
    const sendBtn = sd.getByRole("button", { name: /Gửi cho tiệm/ });
    const hasSend = await sendBtn.count();
    await sendBtn.click();
    await sd.waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
    await q.waitForTimeout(1500);
    const mine = (await msgs()).slice(nBefore).filter((m) => m.senderId === vi.c.userId);
    const ask = mine.find((m) => /Em thử \d+ mẫu trên tay mình/.test(bodyOf(m)));
    R.check("K3", "Khách chọn mẫu → \"Gửi cho tiệm\": tiệm nhận ảnh mẫu trên tay khách + câu hỏi \"làm được không, giá bao nhiêu, khi nào còn lịch\" (khách KHÔNG tự báo giá)",
      hasSend > 0 && mine.filter((m) => m.type === "IMAGE").length >= 1 && !!ask && /còn lịch/.test(bodyOf(ask)) && !/\$\d/.test(bodyOf(ask)), JSON.stringify({ hasSend, n: mine.length, ask: bodyOf(ask || {}).slice(0, 160) }));
  } else R.check("K3", "Khách gửi mẫu thử cho tiệm", false, "hộp Thử mẫu không mở");

  // chat trống → câu mở đầu đúng vai khách
  const F = await ui(fresh.reg.body.email, fresh.reg.body.password);
  await F.page.goto(BASE_URL + `/messages?to=${tech.userId}`);
  const starter = F.page.getByRole("button", { name: /tuần này còn lịch không/ });
  const stShown = await starter.first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  const jobStarter = await F.page.getByRole("button", { name: /tuyển thợ|lương/ }).count();
  R.check("K4", "Khách mới mở chat trống với thợ → câu mở đầu hỏi lịch / giá, KHÔNG có câu hỏi tuyển thợ / lương", stShown && jobStarter === 0, JSON.stringify({ stShown, jobStarter }));

  // ================= CHAT TUYỂN THỢ: chủ tiệm ↔ thợ =================
  const owner = new Client();
  await owner.login(SEED_OWNER, DEMO_PASSWORD);
  const ownerJob = ((await owner.req(`/api/profile?id=${owner.userId}`)).data?.jobs ?? [])[0];
  const h1 = await tech.req("/api/messages", { method: "POST", json: { receiverId: owner.userId, content: "Chào anh, tiệm còn tuyển thợ không ạ? Lương sao ạ?" } });
  const hireConv = h1.data?.conversationId || h1.data?.message?.conversationId;
  const O = await ui(SEED_OWNER, DEMO_PASSWORD);
  await O.page.goto(BASE_URL + `/messages?to=${tech.userId}`);
  const obar = chips(O.page);
  await obar.waitFor({ timeout: 25000 }).catch(() => {});
  const oTitles = await obar.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("title") || "")).catch(() => []);
  const payShown = ownerJob?.salaryAmount ? oTitles.some((t) => t.includes(ownerJob.salaryAmount)) : oTitles.some((t) => /ảnh tay nghề/.test(t));
  R.check("H1", "Thợ hỏi chủ tiệm \"còn tuyển không, lương sao\" → chủ tiệm có gợi ý trả lời với lương THẬT từ tin tuyển mới nhất của tiệm", oTitles.length >= 1 && payShown && !oTitles.some((t) => /bảng giá|menu/i.test(t)), JSON.stringify({ pay: ownerJob?.salaryAmount, oTitles }));
  await O.page.screenshot({ path: `${OUT}/ca_owner_hire.png` });
  await owner.req("/api/messages", { method: "POST", json: { conversationId: hireConv, content: "Bạn làm được bột với dip không?" } });
  await p.goto(BASE_URL + `/messages?to=${owner.userId}`);
  await bar.waitFor({ timeout: 25000 }).catch(() => {});
  const skillChip = bar.getByRole("button", { name: /Trả lời tay nghề/ });
  const skillTitle = (await skillChip.count()) ? await skillChip.first().getAttribute("title") : "";
  R.check("H2", "Chủ tiệm hỏi \"làm được bột/dip không\" → thợ có gợi ý trả lời bằng kỹ năng THẬT trong hồ sơ + link ảnh tay nghề", /Bột\/Acrylic/.test(skillTitle || "") && (skillTitle || "").includes(`/profile/${tech.userId}`), skillTitle);
  if (await skillChip.count()) {
    await skillChip.first().click();
    const v = await p.locator(".pn-composer input[type=text]").inputValue();
    R.check("H3", "Thợ bấm gợi ý → câu điền sẵn vào ô nhập (không tự gửi)", v === skillTitle, v.slice(0, 80));
  } else R.check("H3", "Thợ bấm gợi ý tay nghề", false, "không có chip");

  const errs = [...T.errors, ...B.errors, ...C.errors, ...F.errors, ...O.errors];
  R.check("K5", "Không có lỗi JavaScript ở cả 2 phía", errs.length === 0, errs.join(" | "));
} finally {
  await browser.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
