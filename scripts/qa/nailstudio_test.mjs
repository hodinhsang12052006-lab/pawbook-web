// Thử mẫu PawNail (Try-On) — máy tạo mẫu trên tay khách (không gọi AI ngoài): trang /studio (chụp → chạm móng → 10 mẫu
// → tải ảnh) và trong Messenger (khách gửi ảnh tay → thợ bấm ✨ → chọn mẫu → gửi ảnh + giá cho khách).
// Ảnh tay thật: scripts/qa/fixtures/hand.jpg (900×900, 4 móng). CHỈ chạy với server local.
//   node scripts/qa/nailstudio_test.mjs [thư-mục-ảnh-chụp]
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, Results, SEED_TECH, DEMO_PASSWORD, fakeIp, registerUser } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("nailstudio_test chỉ chạy với server local");
const OUT = process.argv[2] || process.env.TEMP || ".";
const R = new Results("Thử mẫu PawNail (Try-On)");
const HAND = path.resolve("scripts/qa/fixtures/hand.jpg");
// [gốc móng, đầu móng] theo pixel ảnh 900×900
const NAILS = [[[272, 425], [272, 322]], [[385, 430], [380, 312]], [[505, 422], [500, 308]], [[618, 400], [615, 310]]];

const browser = await chromium.launch();
async function ui(email, password) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN", acceptDownloads: true });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password, json: "true" }, headers: h });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, errors };
}
async function markNails(page) {
  const img = page.getByRole("img", { name: "Ảnh tay khách" });
  await img.waitFor({ timeout: 20000 });
  const tapAt = async ([x, y]) => { const box = await img.boundingBox(); await page.mouse.click(box.x + (x / 900) * box.width, box.y + (y / 900) * box.height); };
  const y0 = (await img.boundingBox()).y;
  for (const [b, t] of NAILS) { await tapAt(b); await tapAt(t); }
  return Math.abs((await img.boundingBox()).y - y0); // ảnh có bị nhảy giữa các lần chạm không
}

let techUi, clientUi;
try {
  // ---------- /tryon ----------
  techUi = await ui(SEED_TECH, DEMO_PASSWORD);
  const p = techUi.page;
  await p.goto(BASE_URL + "/tryon");
  await p.locator('input[type=file]').setInputFiles(HAND);
  const jump = await markNails(p);
  const tip = await p.getByText(/Móng 5: chạm vào GỐC móng/).count();
  // Vị trí vẽ khớp đúng chỗ chạm (móng 1: gốc 272,425 → đầu 272,322)
  const line = await p.locator("svg line").first().evaluate((l) => ["x1", "y1", "x2", "y2"].map((k) => Number(l.getAttribute(k))));
  R.check("S0", "Ảnh KHÔNG nhảy giữa các lần chạm; điểm gốc/đầu móng ghi nhận lệch < 6px so với chỗ chạm", jump < 1 && Math.abs(line[1] - 425) < 6 && Math.abs(line[3] - 322) < 6, JSON.stringify({ jump, line: line.map(Math.round) }));
  await p.getByRole("button", { name: /Tạo mẫu/ }).click();
  const looks = p.locator("button[aria-pressed]").filter({ has: p.locator("svg[role=img]") });
  await looks.first().waitFor({ timeout: 15000 });
  const n = await looks.count();
  // Mỗi mẫu vẽ đúng 4 móng lên ảnh
  const nailGroups = await looks.first().locator("svg[role=img] > g").count();
  R.check("S1", "Chọn ảnh tay → chạm gốc/đầu 4 móng (hướng dẫn chuyển sang móng 5) → Tạo mẫu ra 10 mẫu, mỗi mẫu vẽ đúng 4 móng lên ảnh", tip === 1 && n === 10 && nailGroups === 4, JSON.stringify({ tip, n, nailGroups }));
  await p.screenshot({ path: path.join(OUT, "studio_looks.png"), fullPage: true });
  const titles = await looks.locator("span.block.truncate").allInnerTexts();
  const prices = await looks.locator("span.text-emerald-300").allInnerTexts();
  R.check("S2", "Mỗi mẫu có tên (theo trend) + giá gợi ý; \"Bộ khác\" ra bộ mẫu mới", titles.length === 10 && prices.every((x) => /\$\d+/.test(x)) && (await (async () => { const before = titles.join("|"); await p.getByRole("button", { name: /Bộ khác/ }).click(); await p.waitForTimeout(400); return (await looks.locator("span.block.truncate").allInnerTexts()).join("|") !== before; })()),
    JSON.stringify({ titles: titles.slice(0, 3), prices: prices.slice(0, 3) }));
  await looks.nth(0).click();
  await looks.nth(3).click();
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.getByRole("button", { name: /Tải 2/ }).click()]);
  const file = path.join(OUT, "studio_export.jpg");
  await dl.saveAs(file);
  const size = fs.statSync(file).size;
  const head = fs.readFileSync(file).subarray(0, 3).toString("hex");
  R.check("S3", "Chọn 2 mẫu → \"Tải 2\" xuất ảnh JPEG thật (vẽ lại ảnh tay + lớp sơn, có nhãn PawNail)", head === "ffd8ff" && size > 30000, JSON.stringify({ size, head }));

  // ---------- Messenger: khách gửi ảnh tay → thợ ✨ → gửi mẫu ----------
  const reg = await registerUser({ name: "QA Khách Studio", role: "CLIENT", specialties: undefined });
  const client = new Client();
  await client.login(reg.body.email, reg.body.password);
  const tech = new Client();
  await tech.login(SEED_TECH);
  const handB64 = "data:image/jpeg;base64," + fs.readFileSync(HAND).toString("base64");
  const first = await client.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: "Hello tiệm, em muốn làm móng" } });
  const convId = first.data?.conversationId || first.data?.message?.conversationId;
  await client.req("/api/messages", { method: "POST", json: { conversationId: convId, content: handB64, type: "IMAGE" } });

  // Khách mở chat → thẻ menu của thợ; thợ mở chat → thẻ "đây là khách làm nail" + ✨
  clientUi = await ui(reg.body.email, reg.body.password);
  await clientUi.page.goto(BASE_URL + `/messages?to=${tech.userId}`);
  const clientCard = await clientUi.page.getByText(/Menu & mẫu của/).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  await p.goto(BASE_URL + `/messages?to=${reg.res.data.user.id}`);
  const proCard = await p.getByText(/Đây là khách làm nail/).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  R.check("S4", "Khách nhắn thợ → đầu chat hiện \"Menu & mẫu của …\" (giá + đặt lịch); thợ thấy \"Đây là khách làm nail\" + Tạo mẫu trên tay / Gửi menu", clientCard && proCard, JSON.stringify({ clientCard, proCard }));

  const before = (await tech.req(`/api/messages?conversationId=${convId}`)).data?.messages?.length ?? 0;
  await p.getByRole("button", { name: "Tạo mẫu" }).first().click();
  const dialog = p.getByRole("dialog", { name: /Thử mẫu PawNail/ });
  await dialog.waitFor({ timeout: 15000 });
  await dialog.locator("button img").first().click(); // ảnh tay khách vừa gửi
  await markNails(p);
  await dialog.getByRole("button", { name: /Tạo mẫu/ }).click();
  const dl2 = dialog.locator("button[aria-pressed]");
  await dl2.first().waitFor({ timeout: 15000 });
  await dl2.nth(1).click();
  await dl2.nth(2).click();
  await dialog.getByRole("button", { name: /Gửi cho khách/ }).click();
  await dialog.waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const after = (await tech.req(`/api/messages?conversationId=${convId}`)).data?.messages ?? [];
  const mine = after.filter((m) => m.senderId === tech.userId);
  const imgs = mine.filter((m) => m.type === "IMAGE").length;
  const summary = mine.find((m) => /mẫu thử trên tay chị\/anh/.test(m.body || m.content || ""));
  R.check("S5", "Thợ bấm ✨ Tạo mẫu trong chat → chọn ảnh tay khách → chạm móng → chọn 2 mẫu → \"Gửi cho khách\": khách nhận 2 ảnh mẫu + 1 tin tên mẫu & giá", after.length - before >= 3 && imgs >= 2 && !!summary,
    JSON.stringify({ before, after: after.length, imgs, summary: (summary?.body || summary?.content || "").slice(0, 120) }));
  R.check("S6", "Không có lỗi JavaScript", techUi.errors.length === 0 && clientUi.errors.length === 0, [...techUi.errors, ...clientUi.errors].join(" | "));
} finally {
  await browser.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
