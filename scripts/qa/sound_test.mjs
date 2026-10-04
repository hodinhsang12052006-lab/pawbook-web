// Kiểm thử hệ thống âm thanh: đúng âm cho đúng sự kiện, tôn trọng nút tắt
// tiếng, chống phát dồn dập. Không "nghe" được trong trình duyệt headless nên
// bắt sự kiện "pn-sound" mà lib/sounds.ts phát ra mỗi khi thật sự phát âm.
// CHỈ chạy với server local trỏ vào dev.db.   node scripts/qa/sound_test.mjs
import { chromium } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, SEED_TECH } from "./lib.mjs";

const R = new Results("Âm thanh");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];

const owner = new Client();
await owner.login(SEED_OWNER);

async function techPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "vi-VN" });
  await ctx.addInitScript(() => {
    window.__sounds = [];
    window.addEventListener("pn-sound", (e) => window.__sounds.push(e.detail.kind));
    sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(SEED_TECH);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  return p;
}
const sounds = (p) => p.evaluate(() => window.__sounds.slice());
const clear = (p) => p.evaluate(() => (window.__sounds = []));
const waitSound = (p, kind, ms = 10000) =>
  p.waitForFunction((k) => window.__sounds.includes(k), kind, { timeout: ms }).then(() => true).catch(() => false);

try {
  const p = await techPage();
  const techId = await p.evaluate(() => fetch("/api/auth/session").then((r) => r.json()).then((s) => s.user.id));
  await p.goto(BASE_URL + "/?tab=feed");
  await p.waitForTimeout(3000);
  await p.mouse.click(5, 300); // tương tác đầu tiên → mở khoá âm thanh

  // 1. Tin nhắn mới khi đang ở trang khác
  await clear(p);
  await owner.req("/api/messages", { method: "POST", json: { receiverId: techId, content: `QA âm thanh ${Date.now()}` } });
  R.check("SD1", "Tin nhắn mới (đang ở trang chủ) → âm 'message'", await waitSound(p, "message"), JSON.stringify(await sounds(p)));

  // 2. Thông báo (chủ tiệm thích bài của thợ) → chuông
  await clear(p);
  const myPost = await owner.req("/api/posts", { method: "POST", json: { content: "x" } }); // không dùng — chỉ để có quyền
  const posts = (await owner.req(`/api/posts?authorId=${techId}`)).data.posts || [];
  if (posts[0]) {
    if (posts[0].likedByMe) await owner.req(`/api/posts/${posts[0].id}/like`, { method: "POST" });
    await owner.req(`/api/posts/${posts[0].id}/like`, { method: "POST" });
    R.check("SD2", "Có người thích bài → âm chuông 'notify'", await waitSound(p, "notify"), JSON.stringify(await sounds(p)));
  } else R.check("SD2", "Chuông thông báo", false, "thợ seed không có bài");
  if (myPost.data?.id) await owner.req(`/api/posts/${myPost.data.id}`, { method: "DELETE" });

  // 3. Việc gấp cùng bang → âm 'urgent'
  await clear(p);
  const me = await p.evaluate(() => fetch("/api/profile").then((r) => r.json()));
  await owner.req("/api/jobs", {
    method: "POST",
    json: { title: `QA âm việc gấp ${Date.now() % 1e5}`, salonName: "QA Sound Nails", description: "", market: me.market, state: me.state, city: me.city || "LA", salaryType: "Bao lương tuần", salaryAmount: "$1,400/tuần", skills: [], benefits: [], phone: "4085550111", isUrgent: true },
  });
  R.check("SD3", "Việc gấp cùng bang → âm 'urgent'", await waitSound(p, "urgent", 15000), JSON.stringify(await sounds(p)));

  // 4. Thả tim → 'like'; đăng bài → 'success'
  await clear(p);
  const likeBtn = p.locator("article").getByRole("button", { name: "Thích", exact: true }).first();
  await likeBtn.click();
  R.check("SD4", "Thả tim → âm 'like'", await waitSound(p, "like", 4000), JSON.stringify(await sounds(p)));
  await clear(p);
  await p.locator("textarea").first().fill(`QA bài có âm thanh ${Date.now() % 1e5}`);
  await p.getByRole("button", { name: /Đăng bài/ }).last().click();
  R.check("SD5", "Đăng bài thành công → âm 'success'", await waitSound(p, "success", 8000), JSON.stringify(await sounds(p)));

  // 5. Trong khung chat đang mở: tin đến → 'messageInChat', gửi → 'sent'
  await p.goto(`${BASE_URL}/messages?to=${owner.userId}`);
  const box = p.getByPlaceholder("Viết tin nhắn...").filter({ visible: true }).first();
  await box.waitFor({ timeout: 15000 });
  await p.waitForTimeout(1500);
  await clear(p);
  await owner.req("/api/messages", { method: "POST", json: { receiverId: techId, content: `QA trong khung chat ${Date.now()}` } });
  R.check("SD6", "Tin đến trong khung chat đang mở → âm 'messageInChat' (không phải 'message')", (await waitSound(p, "messageInChat")) && !(await sounds(p)).includes("message"), JSON.stringify(await sounds(p)));
  await clear(p);
  await box.fill("QA gửi có âm vút");
  await box.press("Enter");
  R.check("SD7", "Gửi tin thành công → âm 'sent'", await waitSound(p, "sent", 8000), JSON.stringify(await sounds(p)));

  // 6. Chống phát dồn dập: 3 tin liên tiếp → 1 âm
  await p.goto(BASE_URL + "/?tab=feed");
  await p.waitForTimeout(2500);
  await clear(p);
  await Promise.all([1, 2, 3].map((i) => owner.req("/api/messages", { method: "POST", json: { receiverId: techId, content: `QA dồn dập ${i} ${Date.now()}` } })));
  await p.waitForTimeout(2500);
  const burst = (await sounds(p)).filter((k) => k === "message").length;
  R.check("SD8", "3 tin đến dồn dập → chỉ kêu 1 lần (không ồn)", burst === 1, `kêu ${burst} lần`);

  // 7. Tắt tiếng nhanh từ bảng thông báo → tin mới không kêu
  await p.getByRole("button", { name: /^Thông báo/ }).click();
  await p.getByRole("button", { name: "Tắt âm thanh" }).click();
  await p.keyboard.press("Escape");
  await p.waitForTimeout(800);
  await clear(p);
  await owner.req("/api/messages", { method: "POST", json: { receiverId: techId, content: `QA khi tắt tiếng ${Date.now()}` } });
  await p.waitForTimeout(4000);
  R.check("SD9", "Đã tắt tiếng → tin nhắn mới KHÔNG kêu", !(await sounds(p)).includes("message"), JSON.stringify(await sounds(p)));

  // 8. Trang cài đặt: công tắc đồng bộ + Nghe thử vẫn phát khi đang tắt nhóm
  await p.goto(BASE_URL + "/profile");
  const master = p.getByRole("switch", { name: "Bật âm thanh" });
  await master.waitFor({ timeout: 10000 });
  const synced = (await master.getAttribute("aria-checked")) === "false";
  await master.click();
  await clear(p);
  await p.getByRole("button", { name: "Nghe thử âm thông báo" }).click();
  await p.waitForTimeout(300);
  R.check("SD10", "Cài đặt đồng bộ với nút tắt nhanh + 'Nghe thử' phát đúng âm", synced && (await sounds(p)).includes("notify") && (await master.getAttribute("aria-checked")) === "true", JSON.stringify(await sounds(p)));
} finally {
  await browser.close();
}
R.check("SD11", "Không có lỗi JS", errors.length === 0, errors.join(" | "));
const s = R.summary();
process.exit(s.failed ? 1 : 0);
