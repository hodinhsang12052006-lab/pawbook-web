// Dữ liệu MẪU (…@pawnailjobs.demo) không hiện ở chỗ công khai trên web thật, người thật vẫn hiện,
// tài khoản mẫu vẫn đăng nhập được (cho Apple / Google duyệt app). So 2 server CÙNG DB local:
//   :3000 = server test (SHOW_DEMO_DATA=1) · :3001 = giống web thật (không cờ).
// Chạy: bash scripts/qa/start-launch-server.sh  +  SHOW_DEMO_DATA= QA_PORT=3001 bash scripts/qa/start-launch-server.sh
//       node scripts/qa/demo_hidden_test.mjs
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { DEMO_PASSWORD, SEED_TECH, Results, registerUser } from "./lib.mjs";

const ON = "http://localhost:3000";
const OFF = "http://localhost:3001";
const R = new Results("Ẩn dữ liệu mẫu");
const db = createClient({ url: "file:prisma/dev.db" });
const demoIds = new Set((await db.execute(`SELECT id FROM "User" WHERE email LIKE '%pawnailjobs.demo'`)).rows.map((r) => String(r.id)));
const get = (base, path) => fetch(base + path, { headers: { "cf-connecting-ip": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } }).then((r) => r.json());
const ids = (list, pick) => (Array.isArray(list) ? list : []).map(pick).filter(Boolean).map(String);
const demoIn = (arr) => arr.filter((id) => demoIds.has(id)).length;

// Người thật đăng 1 bài + 1 tin → phải hiện ở cả 2 server
const real = await registerUser({ role: "OWNER", name: "QA Chủ Tiệm Thật", salonName: "QA Real Nails", state: "TX", city: "Dallas" });
await real.client.login(real.body.email, real.body.password);
const stamp = Date.now();
await real.client.req("/api/posts", { method: "POST", json: { content: `Tiệm mình mới mở thêm ghế ${stamp}`, postType: "GENERAL" } });

const feedOn = await get(ON, "/api/posts");
const feedOff = await get(OFF, "/api/posts");
const fOn = ids(feedOn.posts, (p) => p.author?.id);
const fOff = ids(feedOff.posts, (p) => p.author?.id);
R.check("H0", "Có dữ liệu mẫu trong DB để kiểm tra (server test vẫn thấy)", demoIds.size > 10 && demoIn(fOn) > 0, `${demoIds.size} demo · ${demoIn(fOn)} trên bảng tin :3000`);
R.check("H1", "Bảng tin web thật: 0 bài của tài khoản mẫu; bài người thật vẫn hiện", demoIn(fOff) === 0 && (feedOff.posts || []).some((p) => p.content?.includes(String(stamp))), `${demoIn(fOff)} bài mẫu`);

const tOff = await get(OFF, "/api/technicians?market=US");
const tOn = await get(ON, "/api/technicians?market=US");
const techList = (x) => (Array.isArray(x) ? x : x.technicians || x.items || []);
R.check("H2", "\"Thợ rảnh\" web thật: 0 thợ mẫu (server test vẫn thấy)", demoIn(ids(techList(tOff), (t) => t.user?.id ?? t.userId)) === 0 && demoIn(ids(techList(tOn), (t) => t.user?.id ?? t.userId)) > 0, `${techList(tOff).length} thợ`);

const sOff = await get(OFF, "/api/supply");
const sList = (x) => (Array.isArray(x) ? x : x.products || x.items || []);
R.check("H3", "Hàng sỉ web thật: 0 sản phẩm của tài khoản mẫu", demoIn(ids(sList(sOff), (p) => p.seller?.id ?? p.sellerId)) === 0, `${sList(sOff).length} sp`);

const jOff = await get(OFF, "/api/jobs?market=US");
R.check("H4", "Việc làm web thật: 0 tin của tài khoản mẫu", demoIn(ids(jOff, (j) => j.owner?.id ?? j.ownerId)) === 0, `${(jOff || []).length} tin`);

const trOff = await get(OFF, "/api/trends?market=US");
const trIds = [...ids(trOff.hotPosts, (p) => p.author?.id), ...ids(trOff.risingTechs, (t) => t.id ?? t.userId)];
R.check("H5", "Xu hướng web thật: bài hot / thợ nổi bật không có tài khoản mẫu", demoIn(trIds) === 0, JSON.stringify(trIds.slice(0, 5)));

const acOff = await get(OFF, "/api/activity");
R.check("H6", "Dải \"vừa có hoạt động\" web thật không nhắc tên tài khoản mẫu", !JSON.stringify(acOff).match(/Emily Nguyen|Dat Truong|Long Tran/), JSON.stringify(acOff).slice(0, 160));

// Tài khoản mẫu vẫn dùng được (Apple / Google duyệt app) + hồ sơ mở bằng link vẫn xem được
const b0 = await chromium.launch();
const lc = await b0.newContext();
const csrf = await (await lc.request.get(OFF + "/api/auth/csrf")).json();
await lc.request.post(OFF + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: SEED_TECH, password: DEMO_PASSWORD, json: "true" } });
const sess = await (await lc.request.get(OFF + "/api/auth/session")).json();
await b0.close();
const demoProfileId = [...demoIds][0];
const prof = await fetch(OFF + `/profile/${demoProfileId}`);
R.check("H7", "Tài khoản mẫu vẫn đăng nhập được (không bị khoá); trang hồ sơ mẫu mở bằng link vẫn 200", !!sess?.user?.id && demoIds.has(String(sess.user.id)) && prof.status === 200, `${JSON.stringify(sess?.user?.id)} ${prof.status}`);

// Giao diện điện thoại web thật: tab Thợ rảnh không hiện tên mẫu, không lỗi JS
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));
await p.goto(OFF + "/?tab=portfolio");
await p.waitForTimeout(4000);
const txt = await p.evaluate(() => document.body.innerText);
await p.screenshot({ path: `${process.env.TEMP}/demo_hidden_techs.png`, fullPage: true }).catch(() => {});
await p.goto(OFF + "/?tab=feed");
await p.waitForTimeout(4000);
const feedTxt = await p.evaluate(() => document.body.innerText);
R.check("H8", "Điện thoại (web thật): tab Thợ rảnh + Bảng tin không có thợ / bài mẫu (\"Emily Nguyen\", \"chrome mirror đang cháy hàng\"), không lỗi JS",
  !/Emily Nguyen|Dat Truong/.test(txt) && !/chrome mirror đang cháy hàng|kín lịch — báo hiệu/.test(feedTxt) && errs.length === 0, JSON.stringify({ errs, sample: txt.slice(0, 120) }));
await b.close();

const s = R.summary();
process.exit(s.failed ? 1 : 0);
