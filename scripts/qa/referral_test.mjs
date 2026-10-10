// Mời bạn bè: link ?ref= → cookie → đăng ký gắn người mời → thông báo → huy hiệu Đại sứ.
// CHỈ chạy với server local (scripts/qa/start-launch-server.sh).
//   node scripts/qa/referral_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Results, fakeIp, registerUser } from "./lib.mjs";

const R = new Results("Mời bạn bè");
const db = createClient({ url: "file:prisma/dev.db" });
const refOf = async (id) => (await db.execute({ sql: `SELECT referredById FROM "User" WHERE id = ?`, args: [id] })).rows[0]?.referredById ?? null;
const idOf = async (email) => (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [email] })).rows[0]?.id;
const errors = [];
let browser;

try {
  const inviter = await registerUser({ role: "OWNER", name: "Mai Salon Owner", salonName: "Mai Nails QA" });
  await inviter.client.login(inviter.body.email, inviter.body.password);
  const me = inviter.client.userId;
  const r0 = await inviter.client.req("/api/referrals");
  R.check("RF1", "API trả link mời riêng (bitpawos.com/?ref=<id>), chưa ai tham gia", r0.status === 200 && r0.data.link === `https://www.bitpawos.com/?ref=${me}` && r0.data.count === 0, JSON.stringify(r0.data));
  const anon = await fetch(BASE_URL + "/api/referrals");
  R.check("RF2", "Khách chưa đăng nhập không xem được", anon.status === 401);

  // Bạn bè bấm link → xem trang → đăng ký (cookie nhớ người mời)
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": fakeIp() } }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(`${BASE_URL}/?ref=${me}`);
  await p.waitForTimeout(1200);
  const ck = (await ctx.cookies()).find((c) => c.name === "pn_ref");
  R.check("RF3", "Mở link mời → nhớ người mời 30 ngày (cookie pn_ref)", ck?.value === me && ck.expires * 1000 > Date.now() + 29 * 86_400_000, JSON.stringify(ck));
  await p.goto(`${BASE_URL}/jobs?ref=zzzzzzzzzzzzzzzzzzzz`);
  await p.waitForTimeout(800);
  R.check("RF4", "Link mời khác mở sau KHÔNG ghi đè người mời đầu tiên", (await ctx.cookies()).find((c) => c.name === "pn_ref")?.value === me);

  const e1 = `ban1.${Date.now()}@qa.test`;
  const reg1 = await p.request.post(BASE_URL + "/api/register", { data: { name: "Hoa Tran", email: e1, password: "QaPass#2026", role: "TECHNICIAN", market: "US", phone: "+1 555 0101", state: "CA", city: "San Jose", specialties: ["Gel-X"] } });
  const f1 = await idOf(e1);
  R.check("RF5", "Đăng ký (từ trình duyệt có cookie) → tài khoản gắn đúng người mời", reg1.status() === 201 && (await refOf(f1)) === me, `${reg1.status()} ${await refOf(f1)}`);

  // Thêm 2 người qua body.ref (app/đăng ký khác thiết bị)
  const f2 = await registerUser({ name: "Linh Vo", ref: me });
  const f3 = await registerUser({ role: "OWNER", name: "Tuan Le", salonName: "Tuan Nails", ref: me });
  const id2 = await idOf(f2.body.email), id3 = await idOf(f3.body.email);
  R.check("RF6", "Đăng ký có ref trong body (thợ + chủ tiệm) đều được tính", f2.res.status === 201 && f3.res.status === 201 && (await refOf(id2)) === me && (await refOf(id3)) === me);

  // Ref rác / không tồn tại → vẫn đăng ký được, không gắn ai
  const bad1 = await registerUser({ ref: "khong-hop-le!!" });
  const bad2 = await registerUser({ ref: "cnotexist0000000000000000" });
  R.check("RF7", "Ref sai/không tồn tại: đăng ký vẫn thành công, không gắn người mời", bad1.res.status === 201 && bad2.res.status === 201 && (await refOf(await idOf(bad1.body.email))) === null && (await refOf(await idOf(bad2.body.email))) === null);

  const r1 = await inviter.client.req("/api/referrals");
  R.check("RF8", "Đếm đúng 3 người đã tham gia, có tên trong danh sách", r1.data.count === 3 && r1.data.recent.length === 3 && r1.data.recent.some((u) => u.name === "Hoa Tran"), JSON.stringify(r1.data).slice(0, 200));
  const n = await inviter.client.req("/api/notifications");
  const inv = (n.data?.items || []).filter((i) => i.kind === "invite");
  R.check("RF9", "Chuông của người mời: 3 thông báo 'vừa tham gia nhờ lời mời của bạn'", inv.length === 3 && inv.every((i) => /lời mời của bạn/.test(i.text)), JSON.stringify(inv).slice(0, 200));
  const prof = await inviter.client.req(`/api/profile?id=${me}&badges=1`);
  R.check("RF10", "Mời đủ 3 người → huy hiệu 'Đại sứ PawNail' trên hồ sơ", (prof.data?.badges || prof.data?.user?.badges || []).some?.((b) => b.key === "ambassador") ?? false, JSON.stringify(prof.data?.badges || prof.data).slice(0, 200));

  // Giao diện: thẻ Mời bạn bè trong Hồ sơ + huy hiệu trên trang công khai
  const ctx2 = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx2.addCookies(Object.entries(inviter.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p2.goto(BASE_URL + "/profile#moi-ban-be");
  const card = p2.getByTestId("invite-friends");
  await card.waitFor({ timeout: 15000 });
  await card.scrollIntoViewIfNeeded();
  const cardText = await card.innerText();
  R.check("RF11", "Hồ sơ có thẻ 'Mời bạn bè': link, nút gửi, '3 người đã tham gia', chip Đại sứ", /3 người đã tham gia/.test(cardText) && /Đại sứ PawNail/.test(cardText) && /Gửi link cho bạn bè/.test(cardText) && (await p2.getByTestId("invite-link").innerText()).includes(`?ref=${me}`), cardText.slice(0, 200));
  await p2.screenshot({ path: `${process.env.TEMP || "."}/referral_card.png` }).catch(() => {});
  await p2.goto(`${BASE_URL}/profile/${me}`);
  await p2.getByText("Đại sứ PawNail").first().waitFor({ timeout: 15000 }).catch(() => {});
  R.check("RF12", "Trang hồ sơ công khai hiện huy hiệu Đại sứ PawNail", (await p2.getByText("Đại sứ PawNail").count()) > 0);
  R.check("RF13", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
