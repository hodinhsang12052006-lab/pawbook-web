// Mẫu nail KHÔNG cần duyệt (mặc định giai đoạn đầu) + ảnh thật thợ/tiệm hiện ở trang Mẫu nail.
// CHỈ chạy với server local.   node scripts/qa/designs_autopublish_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, SEED_TECH, registerUser } from "./lib.mjs";

const R = new Results("Mẫu nail lên thẳng + ảnh thật");
const db = createClient({ url: "file:prisma/dev.db" });
const errors = [];
let browser;
const IMG = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

try {
  const a = await registerUser({ name: "QA Auto Admin" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  await a.client.login(a.body.email, a.body.password);
  await a.client.req("/api/admin/designs", { method: "PATCH", json: { review: false } });
  const cfg = (await a.client.req("/api/admin/designs")).data;
  R.check("A1", "Mặc định TẮT duyệt (admin thấy công tắc)", cfg.review === false);

  const before = (await fetch(BASE_URL + "/api/designs?limit=60").then((r) => r.json())).designs.length;
  const cron = await fetch(BASE_URL + "/api/cron/designs?count=2", { headers: { authorization: "Bearer test-cron" } }).then((r) => r.json());
  const ids = cron.created || [];
  const rows = ids.length ? (await db.execute(`SELECT status, publishedAt FROM "NailDesign" WHERE id IN (${ids.map(() => "?").join(",")})`, ids)).rows : [];
  // Đăng thẳng (không chờ duyệt); trang công khai hiện mẫu khi đã có ảnh thật (vẽ xong) — giả lập ảnh đã vẽ.
  if (ids.length) await db.execute(`UPDATE "NailDesign" SET imageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg' WHERE imageUrl IS NULL AND id IN (${ids.map(() => "?").join(",")})`, ids);
  const after = await fetch(BASE_URL + "/api/designs?limit=60").then((r) => r.json());
  R.check("A2", "Mẫu mới tạo → lên THẲNG trang Mẫu nail (không chờ duyệt), hiện ngay khi có ảnh", ids.length === 2 && rows.every((r) => r.status === "published" && r.publishedAt) && ids.every((id) => after.designs.some((d) => d.id === id)), JSON.stringify({ ids, rows, before }));

  // Bật duyệt lại → mẫu mới chờ duyệt; tắt lại → lên thẳng
  await a.client.req("/api/admin/designs", { method: "PATCH", json: { review: true } });
  const c2 = await fetch(BASE_URL + "/api/cron/designs?count=1", { headers: { authorization: "Bearer test-cron" } }).then((r) => r.json());
  const st2 = c2.created?.[0] ? (await db.execute({ sql: `SELECT status FROM "NailDesign" WHERE id = ?`, args: [c2.created[0]] })).rows[0]?.status : null;
  await a.client.req("/api/admin/designs", { method: "PATCH", json: { review: false } });
  R.check("A3", "Bật công tắc duyệt → mẫu mới chờ duyệt (bật/tắt 1 chạm, không cần sửa code)", st2 === "draft", String(st2));
  const tech = new Client(); await tech.login(SEED_TECH);
  const hack = await tech.req("/api/admin/designs", { method: "PATCH", json: { review: true } });
  R.check("A4", "Thợ không đổi được công tắc duyệt (403)", hack.status === 403);

  // Ảnh thật từ thợ & tiệm
  const o = await registerUser({ role: "OWNER", name: "Tiệm Ảnh Thật", salonName: "Real Nails" });
  await o.client.login(o.body.email, o.body.password);
  const show = await o.client.req("/api/posts", { method: "POST", json: { content: "Bộ mắt mèo bạc mới làm xong 💅", postType: "SHOWCASE", mediaUrls: [IMG, IMG] } });
  await o.client.req("/api/posts", { method: "POST", json: { content: "Bài thường có ảnh", postType: "GENERAL", mediaUrls: [IMG] } });
  await o.client.req("/api/posts", { method: "POST", json: { content: "Khoe không ảnh", postType: "SHOWCASE", mediaUrls: [] } });
  await o.client.req("/api/posts", { method: "POST", json: { content: "Video", postType: "SHOWCASE", mediaUrls: ["https://res.cloudinary.com/demo/video/upload/dog.mp4"] } });
  const com = await fetch(BASE_URL + "/api/designs/community?limit=10").then((r) => r.json());
  const first = com.items?.[0];
  R.check("A5", "Bài 'Khoe tay nghề' có ảnh → hiện ngay ở Mẫu nail (bài thường / không ảnh / video thì không)", show.status < 300 && first?.caption?.startsWith("Bộ mắt mèo") && first.count === 2 && first.image === IMG && !com.items.some((i) => /Bài thường|Khoe không ảnh|Video/.test(i.caption)), JSON.stringify(com.items?.slice(0, 2)).slice(0, 200));
  R.check("A6", "Không lộ thông tin riêng (email/SĐT) của người đăng", !/@|phone|email/i.test(JSON.stringify(com.items?.map((i) => i.author))));

  // Giao diện
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx.addCookies(Object.entries(tech.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(BASE_URL + "/designs");
  const sec = p.getByTestId("community-designs");
  await sec.getByText("Tiệm Ảnh Thật").first().waitFor({ timeout: 15000 });
  await p.screenshot({ path: `${process.env.TEMP || "."}/designs_community.png` }).catch(() => {});
  R.check("A7", "Trang Mẫu nail: mục 'Ảnh thật từ thợ & tiệm' có ảnh vừa đăng + mục ý tưởng PawNail", (await sec.locator("img").count()) > 0 && (await p.getByText("Ý tưởng mẫu PawNail").count()) > 0);
  await sec.getByRole("button", { name: /Đăng mẫu của bạn/ }).click();
  await p.waitForURL(/tab=feed/, { timeout: 15000 });
  const pressed = p.getByRole("button", { name: /Khoe tay nghề/, pressed: true });
  await pressed.first().waitFor({ timeout: 15000 });
  R.check("A8", "Bấm 'Đăng mẫu của bạn' → mở ô đăng bài, chọn sẵn loại 'Khoe tay nghề'", (await pressed.count()) > 0);
  R.check("A9", "Không lỗi JS", errors.length === 0, errors.join(" | "));

  // ---- ẢNH MẪU DO MÁY PAWNAIL TỰ VẼ trên tay mẫu (mặc định bật): mẫu mới có hoạ tiết bộ máy vẽ được → ảnh máy vẽ,
  //      nhãn "Minh hoạ PawNail" (không phải "ảnh AI"); ảnh AI cũ được thay dần, link cũ giữ để khôi phục
  const rcfg = (await a.client.req("/api/admin/designs")).data;
  await db.execute(`DELETE FROM "NailDesign" WHERE day = '${new Date().toISOString().slice(0, 10)}' AND provider = 'pawnail'`);
  const old = (await db.execute(`SELECT id, pattern FROM "NailDesign" WHERE provider = 'pawnail' AND status = 'published' LIMIT 0`)).rows;
  const cr = await fetch(BASE_URL + "/api/cron/designs?count=3", { headers: { authorization: "Bearer test-cron" } }).then((r) => r.json());
  const made = (await db.execute({ sql: `SELECT id, pattern, imageUrl, prompt FROM "NailDesign" WHERE id IN (${cr.created.map(() => "?").join(",") || "''"})`, args: cr.created })).rows;
  const procedural = ["solid", "french", "ombre", "aura", "tortoise", "marble", "lines", "dots", "gems", "pearls", "jelly", "babyboomer", "chromefrench", "droplets", "gemcluster", "chromeline", "mixmatch", "doublefrench", "velvet", "leopard", "checker", "foil", "stars", "hearts", "charm3d", "chromedrops"];
  const mine = made.filter((r) => procedural.includes(String(r.pattern)));
  const api = await fetch(BASE_URL + "/api/designs?limit=60").then((r) => r.json());
  const pub = api.designs.filter((d) => mine.some((m) => m.id === d.id));
  R.check("A10", "Công tắc admin: ảnh máy PawNail tự vẽ BẬT mặc định; mẫu mới (hoạ tiết bộ máy vẽ được) có ảnh ngay, đánh dấu [pr:], API báo rendered (nhãn 'Minh hoạ PawNail'), không lộ prompt",
    rcfg.render === true && mine.length >= 1 && mine.every((r) => r.imageUrl && String(r.prompt).includes("[pr:")) && pub.length === mine.length && pub.every((d) => d.rendered === true && !("prompt" in d)),
    JSON.stringify({ render: rcfg.render, created: cr.created?.length, mine: mine.map((r) => [r.pattern, !!r.imageUrl, String(r.prompt).slice(-22)]), pub: pub.length, old: old.length }));
  // ảnh AI cũ của 1 mẫu đang hiện → cron thay bằng ảnh máy vẽ, giữ link cũ [ai:…]
  const target = mine[0];
  if (target) {
    await db.execute({ sql: `UPDATE "NailDesign" SET imageUrl = ?, prompt = replace(prompt, substr(prompt, instr(prompt, '[pr:')), '') WHERE id = ?`, args: [IMG, target.id] });
    const c2 = await fetch(BASE_URL + "/api/cron/designs?count=1", { headers: { authorization: "Bearer test-cron" } }).then((r) => r.json());
    const after = (await db.execute({ sql: `SELECT imageUrl, prompt FROM "NailDesign" WHERE id = ?`, args: [target.id] })).rows[0];
    R.check("A11", "Ảnh AI cũ của mẫu đang hiện → lượt cron sau thay bằng ảnh máy PawNail vẽ; link ảnh cũ giữ trong [ai:…] (khôi phục được)",
      c2.rerendered >= 1 && after.imageUrl !== IMG && String(after.prompt).includes(`[ai:${IMG}]`) && String(after.prompt).includes("[pr:"), JSON.stringify({ rer: c2.rerendered, url: String(after.imageUrl).slice(0, 40), tail: String(after.prompt).slice(-90) }));
    // tắt công tắc → mẫu mới quay về đường AI (không vẽ bằng máy)
    const off = await a.client.req("/api/admin/designs", { method: "PATCH", json: { render: false } });
    const cfg2 = (await a.client.req("/api/admin/designs")).data;
    await a.client.req("/api/admin/designs", { method: "PATCH", json: { render: true } });
    R.check("A12", "Admin tắt / bật lại được ảnh máy PawNail tự vẽ (không cần sửa code)", off.status === 200 && cfg2.render === false);
    // nút "Vẽ lại toàn bộ ngay": admin vẽ lại hết ảnh cũ trong vài lượt gọi (không chờ cron 8 ảnh / lượt)
    const olds = mine.slice(0, 2);
    for (const m of olds) await db.execute({ sql: `UPDATE "NailDesign" SET imageUrl = ?, prompt = replace(prompt, substr(prompt, instr(prompt, '[pr:')), '') WHERE id = ?`, args: [IMG, m.id] });
    const leftBefore = (await a.client.req("/api/admin/designs")).data.oldImages;
    const ra = await a.client.req("/api/admin/designs", { method: "PATCH", json: { action: "rerender-all" } });
    const rows2 = (await db.execute(`SELECT imageUrl, prompt FROM "NailDesign" WHERE id IN (${olds.map(() => "?").join(",")})`, olds.map((m) => m.id))).rows;
    const anon = await fetch(BASE_URL + "/api/admin/designs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rerender-all" }) });
    R.check("A13", `Admin "Vẽ lại toàn bộ ngay": ảnh cũ chờ vẽ ${leftBefore} → vẽ ${ra.data?.done} ảnh / lượt gọi, còn ${ra.data?.left}; ảnh mới có dấu thế hệ tay mẫu (:h2), link ảnh cũ giữ lại; khách không gọi được (401)`,
      leftBefore >= olds.length && ra.status === 200 && ra.data.done >= olds.length && ra.data.left < leftBefore && rows2.every((r) => r.imageUrl !== IMG && String(r.prompt).includes(":h2]") && String(r.prompt).includes(`[ai:${IMG}]`)) && anon.status === 401,
      JSON.stringify({ leftBefore, ra: ra.data, anon: anon.status }));
  } else R.check("A11", "Có mẫu hoạ tiết bộ máy vẽ được để thử thay ảnh", false, JSON.stringify(made.map((r) => r.pattern)));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
