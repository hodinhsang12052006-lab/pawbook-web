// Tự dịch tin nhắn: người xem giao diện tiếng Anh nhận tin tiếng Việt → tự dịch CHỈ KHI họ không đọc được tiếng Việt.
// Chủ tiệm Việt để giao diện tiếng Anh từng thấy tin tiếng Việt của bạn bị tự dịch (11/2026). Đọc được tiếng Việt =
// trình duyệt / máy có tiếng Việt, hoặc chính họ nhắn tiếng Việt. Kiểm qua request /api/messages/translate (không cần AI).
// CHỈ chạy với server local.   node scripts/qa/chat_translate_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, Results, registerUser } from "./lib.mjs";

const R = new Results("Tự dịch tin nhắn");
let browser;
const errors = [];
try {
  const a = await registerUser({ name: "QA Dịch A" });
  const b = await registerUser({ name: "QA Dịch B", role: "OWNER" });
  const c = await registerUser({ name: "QA Dịch C" });
  for (const u of [a, b, c]) await u.client.login(u.body.email, u.body.password);
  // B nhắn tiếng Việt cho A và cho C; C tự nhắn tiếng Việt trước
  await b.client.req("/api/messages", { method: "POST", json: { receiverId: a.client.userId, content: "Chào em, tiệm còn tuyển thợ bột không ạ?" } });
  await c.client.req("/api/messages", { method: "POST", json: { receiverId: b.client.userId, content: "Dạ em chào anh, em muốn hỏi việc làm" } });
  await b.client.req("/api/messages", { method: "POST", json: { receiverId: c.client.userId, content: "Dạ được em, mai qua tiệm nhé" } });

  browser = await chromium.launch();
  // langs = navigator.languages của máy; giao diện luôn TIẾNG ANH (Accept-Language en-US, URL không tiền tố /vi)
  const open = async (u, langs) => {
    const ctx = await browser.newContext({ ...devices["Desktop Chrome"], locale: "en-US" });
    await ctx.addInitScript((l) => { Object.defineProperty(navigator, "languages", { get: () => l }); Object.defineProperty(navigator, "language", { get: () => l[0] }); }, langs);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    const tx = [];
    p.on("request", (r) => { if (r.url().includes("/api/messages/translate")) tx.push(r.url()); });
    await p.goto(BASE_URL + "/auth/login");
    await p.locator("#email").fill(u.body.email);
    await p.locator("#password").fill(u.body.password);
    await p.locator("#password").press("Enter");
    await p.waitForURL((x) => !x.pathname.startsWith("/auth"), { timeout: 30000 });
    await p.goto(`${BASE_URL}/messages?to=${b.client.userId}`); // giao diện TIẾNG ANH (không tiền tố /vi)
    await p.locator(".m-text").first().waitFor({ timeout: 20000 });
    await p.waitForTimeout(2500);
    const see = await p.getByRole("button", { name: /^See translation$/ }).count();
    await ctx.close();
    return { tx: tx.length, see };
  };
  const en = await open(a, ["en-US", "en"]);
  R.check("X1", "Người xem tiếng Anh (máy chỉ có tiếng Anh) nhận tin tiếng Việt → vẫn tự dịch như trước", en.tx >= 1, JSON.stringify(en));
  const vi = await open(a, ["en-US", "vi-VN", "vi"]);
  R.check("X2", "Giao diện tiếng Anh, máy có cài tiếng Việt → KHÔNG tự dịch, chỉ có nút 'See translation'", vi.tx === 0 && vi.see >= 1, JSON.stringify(vi));
  const writer = await open(c, ["en-US", "en"]);
  R.check("X3", "Người xem tự nhắn tiếng Việt trong cuộc trò chuyện → KHÔNG tự dịch tin tiếng Việt của người kia", writer.tx === 0 && writer.see >= 1, JSON.stringify(writer));
  R.check("X4", "Không lỗi JS", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 300), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
