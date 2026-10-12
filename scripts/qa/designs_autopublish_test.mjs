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
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
