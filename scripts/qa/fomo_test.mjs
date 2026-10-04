// Kiểm thử "FOMO thật": độ nóng tin tuyển, chống bơm số, báo việc gấp theo
// bang, bảng xu hướng, huy hiệu. CHỈ chạy với server local trỏ vào dev.db.
//   node scripts/qa/fomo_test.mjs
import { chromium } from "playwright";
import { BASE_URL, Client, Results, SEED_OWNER, SEED_TECH, DEMO_PASSWORD, registerUser } from "./lib.mjs";

const R = new Results("FOMO thật");
const owner = new Client();
await owner.login(SEED_OWNER);
const tech = new Client();
await tech.login(SEED_TECH);
const techProfile = (await tech.req("/api/profile")).data;

// ---- Tin gấp mới ở đúng bang của thợ ----
const stamp = String(Date.now()).slice(-5);
const created = await owner.req("/api/jobs", {
  method: "POST",
  json: {
    title: `QA FOMO cần thợ Gel-X ${stamp}`, salonName: "QA Heat Nails", description: "test",
    market: techProfile.market, state: techProfile.state, city: techProfile.city || "San Jose",
    salaryType: "Bao lương tuần", salaryAmount: "$1,400-1,600/tuần", skills: ["Gel-X"], benefits: [], phone: "4085550199", isUrgent: true,
  },
});
const jobId = created.data?.id;
R.check("FM1", "Chủ tiệm đăng tin gấp", created.status === 201 && jobId, JSON.stringify(created.data).slice(0, 200));

// ---- Chi tiết tin mới: "1 trong 10 người đầu tiên", chưa hot ----
let d = (await tech.req(`/api/jobs/${jobId}`)).data;
R.check("FM2", "Tin mới có firstViewers=10, chưa 'Đang hot'", d.heat?.firstViewers === 10 && d.heat?.hot === false, JSON.stringify(d.heat));
R.check("FM3", "API chi tiết không lộ SĐT/email chủ tiệm", !("phone" in (d.owner || {})) && !("email" in (d.owner || {})), JSON.stringify(d.owner));

// ---- Lượt xem: chủ tiệm tự xem không tính; id rác bị bỏ ----
await owner.req("/api/jobs/track", { method: "POST", json: { ids: [jobId] } });
await tech.req("/api/jobs/track", { method: "POST", json: { ids: ["../../etc", 123, "x".repeat(500)] } });
d = (await tech.req(`/api/jobs/${jobId}`)).data;
R.check("FM4", "Chủ tiệm xem tin của mình không được tính + id rác bị bỏ", d.heat?.viewsToday === 0, JSON.stringify(d.heat));

// ---- 9 người xem khác nhau (9 IP) → "Đang hot" ----
for (let i = 0; i < 9; i++) await new Client().req("/api/jobs/track", { method: "POST", json: { ids: [jobId] } });
d = (await tech.req(`/api/jobs/${jobId}`)).data;
R.check("FM5", "9 lượt xem thật → viewsToday=9, Đang hot", d.heat?.viewsToday === 9 && d.heat?.hot === true, JSON.stringify(d.heat));

// ---- Script bơm lượt xem từ 1 IP bị chặn ----
const bot = new Client();
for (let i = 0; i < 8; i++) await bot.req("/api/jobs/track", { method: "POST", json: { ids: Array(20).fill(jobId) } });
d = (await tech.req(`/api/jobs/${jobId}`)).data;
R.check("FM6", "Gửi trùng id trong 1 request chỉ tính 1 lần (dedupe)", d.heat?.viewsToday <= 9 + 8, JSON.stringify(d.heat));
const bot2 = new Client();
const many = Array.from({ length: 8 }, () => ({ ids: [jobId] }));
for (let i = 0; i < 130; i++) await bot2.req("/api/jobs/track", { method: "POST", json: many[i % 8] });
const before = d.heat.viewsToday;
d = (await tech.req(`/api/jobs/${jobId}`)).data;
R.check("FM7", "1 IP bơm 130 lần → bị giới hạn ≤120/10 phút", d.heat.viewsToday - before <= 120, `tăng ${d.heat.viewsToday - before}`);

// ---- Lượt liên hệ: 1 lần / IP / tin / ngày ----
const c1 = new Client();
await c1.req("/api/jobs/track", { method: "POST", json: { contact: jobId } });
await c1.req("/api/jobs/track", { method: "POST", json: { contact: jobId } });
await new Client().req("/api/jobs/track", { method: "POST", json: { contact: jobId } });
await owner.req("/api/jobs/track", { method: "POST", json: { contact: jobId } });
d = (await tech.req(`/api/jobs/${jobId}`)).data;
R.check("FM8", "Liên hệ: 2 IP khác nhau = 2, bấm lặp & chủ tiệm không tính", d.heat?.contacts7d === 2, JSON.stringify(d.heat));

// ---- Job board trả heat ----
const list = (await tech.req(`/api/jobs?market=${techProfile.market}&state=${techProfile.state}`)).data;
const row = list.find((j) => j.id === jobId);
R.check("FM9", "Danh sách tin có heat {viewsToday, contacts7d, hot}", row?.heat?.hot === true && row.heat.contacts7d === 2, JSON.stringify(row?.heat));

// ---- Chuông: thợ cùng bang thấy tin gấp; thợ khác bang không ----
const n = (await tech.req("/api/notifications")).data;
R.check("FM10", "Thợ cùng bang có thông báo 'cần thợ gấp'", n.items?.some((i) => i.kind === "job" && i.href === `/jobs/${jobId}`), JSON.stringify(n.items?.slice(0, 2)));
const other = await registerUser({ state: techProfile.state === "TX" ? "FL" : "TX", city: "Austin" });
const n2 = (await other.client.req("/api/notifications")).data;
R.check("FM11", "Thợ khác bang KHÔNG nhận tin gấp này", !n2.items?.some((i) => i.href === `/jobs/${jobId}`), JSON.stringify(n2.items?.slice(0, 2)));
const on = (await owner.req("/api/notifications")).data;
R.check("FM12", "Chủ tiệm không nhận thông báo tin của chính mình", !on.items?.some((i) => i.kind === "job" && i.href === `/jobs/${jobId}`));

// ---- Bảng xu hướng ----
const tr = await new Client().req(`/api/trends?market=${techProfile.market}`);
const t = tr.data;
R.check("FM13", "/api/trends công khai, đủ 5 mục", tr.status === 200 && ["pulse", "hotPosts", "hashtags", "salaries", "risingTechs"].every((k) => Array.isArray(t[k])), JSON.stringify(t).slice(0, 200));
R.check("FM14", "Xu hướng không lộ SĐT/email/mật khẩu", !/"(phone|email|password)"/.test(JSON.stringify(t)));
R.check("FM15", "Nhịp thị trường có bang của tin vừa đăng", t.pulse.some((p) => p.state === techProfile.state && p.newJobs >= 1 && p.urgentJobs >= 1), JSON.stringify(t.pulse));
const badState = await new Client().req(`/api/trends?market=<script>`);
R.check("FM16", "market rác → mặc định US, không lỗi", badState.status === 200 && badState.data.market === "US");

// ---- Huy hiệu ----
const pub = (await new Client().req(`/api/profile?id=${tech.userId}`)).data;
R.check("FM17", "Hồ sơ có huy hiệu 'Thành viên sáng lập' (đăng ký trước 2027)", pub.badges?.some((b) => b.key === "founding"), JSON.stringify(pub.badges));
R.check("FM18", "Hồ sơ công khai vẫn không lộ SĐT/email", !pub.phone && !pub.email);

// ---- UI: thẻ 'Đang hot' + trang Xu hướng + toast việc gấp realtime ----
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(SEED_TECH);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });

  await p.goto(`${BASE_URL}/jobs/${jobId}`);
  const hot = await p.getByText("Đang hot").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const views = await p.getByText(/người xem hôm nay/).first().isVisible().catch(() => false);
  R.check("FM19", "Trang tin hiện 'Đang hot' + 'N người xem hôm nay'", hot && views);
  await p.screenshot({ path: process.env.TEMP + "/fomo_job.png", fullPage: true });

  await p.goto(`${BASE_URL}/trends`);
  const h1 = await p.getByRole("heading", { name: "Xu hướng tuần này" }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const pulse = await p.getByText("Nơi đang tuyển nhiều nhất", { exact: true }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("FM20", "Trang /trends hiển thị tiêu đề + 'Nơi đang tuyển nhiều nhất'", h1 && pulse);
  await p.screenshot({ path: process.env.TEMP + "/fomo_trends.png", fullPage: true });

  // Thợ đang mở app → chủ tiệm đăng tin gấp cùng bang → toast realtime
  await p.goto(`${BASE_URL}/`);
  await p.waitForTimeout(3000);
  const t2 = await owner.req("/api/jobs", {
    method: "POST",
    json: {
      title: `QA realtime gấp ${stamp}`, salonName: "QA Live Nails", description: "", market: techProfile.market, state: techProfile.state,
      city: techProfile.city || "San Jose", salaryType: "Bao lương tuần", salaryAmount: "$1,500/tuần", skills: [], benefits: [], phone: "4085550198", isUrgent: true,
    },
  });
  const toastShown = await p.getByText("Việc gấp gần bạn").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("FM21", "Thợ đang mở app nhận toast 'Việc gấp gần bạn' realtime", t2.status === 201 && toastShown);
  await p.screenshot({ path: process.env.TEMP + "/fomo_toast.png" });
} finally {
  await browser.close();
}
R.check("FM22", "Không có lỗi JS trên trang", errors.length === 0, errors.join(" | "));

const s = R.summary();
process.exit(s.failed ? 1 : 0);
