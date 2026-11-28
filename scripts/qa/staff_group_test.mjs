// Nhóm chat NHÂN VIÊN (scripts/staff/create-staff-group.mts) trên DB QA local: 10 tài khoản Bitpaw 1–10, nhóm chỉ gồm
// nhân viên, ảnh nhóm = logo B, người ngoài không vào được, nhắn trong nhóm được, không hiện ở danh sách công khai,
// chạy lại không tạo trùng. CHỈ chạy với server + DB QA local:
//   QA_DB_URL=file:<db QA> BASE_URL=http://localhost:3000 node scripts/qa/staff_group_test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, Results, SEED_TECH, registerUser } from "./lib.mjs";

const R = new Results("Nhóm chat nhân viên BitPaw");
const DB = process.env.QA_DB_URL || "";
if (!DB.startsWith("file:")) throw new Error("Cần QA_DB_URL=file:… (DB QA local)");
const OUT = path.join(os.tmpdir(), `qa-staff-${Date.now()}.txt`);
const run = (...extra) =>
  execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/staff/create-staff-group.mts", "--yes", "--out", OUT, ...extra], {
    env: { ...process.env, TURSO_DATABASE_URL: DB, TURSO_AUTH_TOKEN: "", DATABASE_URL: DB },
    encoding: "utf8",
  });
let browser;
try {
  // Tài khoản "admin" có sẵn (đăng ký thường) + 1 email nhân viên MỚI chưa có tài khoản
  const boss = await registerUser({ name: "QA Chủ BitPaw", role: "OWNER" });
  const newStaff = `qa.staff.${Date.now()}@gmail.test`;
  const out1 = run("--add", boss.body.email, "--add", newStaff);
  const file = fs.readFileSync(OUT, "utf8");
  const creds = [...file.matchAll(/^(Bitpaw \d+)\s*\| (\S+)\s*\| (\S+)/gm)].map((m) => ({ name: m[1], email: m[2], pw: m[3] }));
  const newPw = file.split("\n").find((l) => l.includes(newStaff))?.split("|")[2]?.trim().split(/\s+/)[0];
  R.check("T1", "Script tạo đủ 10 tài khoản Bitpaw 1–10 (email nội bộ) + ghi file tài khoản / mật khẩu, KHÔNG in mật khẩu ra màn hình",
    creds.length === 10 && creds[0].name === "Bitpaw 1" && creds[9].name === "Bitpaw 10" && creds.every((c) => /@staff\.pawnailjobs\.demo$/.test(c.email) && /^Bp\S{4}-\S{4}-\S{4}$/.test(c.pw)) && !creds.some((c) => out1.includes(c.pw)),
    JSON.stringify({ n: creds.length, out: out1.slice(0, 200) }));

  const a = new Client(), b = new Client(), outsider = new Client();
  const la = await a.login(creds[0].email, creds[0].pw);
  const lb = await b.login(creds[1].email, creds[1].pw);
  await outsider.login(SEED_TECH);
  const bossLogin = await boss.client.login(boss.body.email, boss.body.password);
  // Máy chủ nhớ cài đặt 30 s (lib/settings) → ảnh nhóm vừa đặt có thể hiện sau tối đa 30 s
  let g = null;
  for (let i = 0; i < 9; i++) {
    const list = await a.req("/api/messages");
    g = (list.data.conversations || []).find((c) => c.isGroup && c.name === "Họp Nội Bộ BitPaw") || null;
    if (g?.groupAvatarUrl) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  R.check("T2", "Bitpaw 1 đăng nhập được, thấy nhóm 'Họp Nội Bộ BitPaw' gồm đúng 10 Bitpaw + tài khoản chủ + nhân viên mới (12), ảnh nhóm = logo B",
    la.ok && lb.ok && !!g && g.participants.length === 12 && g.participants.filter((p) => /^Bitpaw \d+$/.test(p.name)).length === 10 && g.participants.some((p) => p.id === boss.client.userId) && g.groupAvatarUrl === "/logo_b.jpg",
    JSON.stringify({ ok: [la.ok, lb.ok], g: g && { n: g.participants.length, av: g.groupAvatarUrl } }));

  const peek = await outsider.req(`/api/conversations?id=${g?.id}`);
  const sneak = await outsider.req("/api/messages", { method: "POST", json: { conversationId: g?.id, content: "người ngoài" } });
  R.check("T3", "Người ngoài (thợ) không xem được nhóm (404) và không gửi được tin vào nhóm", peek.status === 404 && sneak.status >= 400, [peek.status, sneak.status]);

  const msg = `QA nhân viên ${Date.now()}`;
  const sent = await b.req("/api/messages", { method: "POST", json: { conversationId: g?.id, content: msg } });
  const seen = await a.req(`/api/messages?conversationId=${g?.id}`);
  const body = JSON.stringify(seen.data);
  R.check("T4", "Bitpaw 2 nhắn vào nhóm → Bitpaw 1 thấy tin", sent.status < 300 && body.includes(msg), [sent.status, seen.status]);

  const techs = await outsider.req("/api/technicians?market=US");
  const feed = await outsider.req("/api/posts?limit=50");
  R.check("T5", "Tài khoản nhân viên không hiện ở danh sách công khai (thợ / bảng tin)", !JSON.stringify(techs.data).includes("Bitpaw ") && !JSON.stringify(feed.data).includes("Bitpaw "), "");

  const bossSees = (await boss.client.req("/api/messages")).data.conversations?.some((c) => c.id === g?.id);
  const ns = new Client();
  const nsLogin = newPw ? await ns.login(newStaff, newPw) : { ok: false };
  const nsSees = nsLogin.ok && (await ns.req("/api/messages")).data.conversations?.some((c) => c.id === g?.id);
  R.check("T2b", "Tài khoản chủ (có sẵn, giữ mật khẩu của mình) vào nhóm; email nhân viên mới được tạo tài khoản + mật khẩu trong file, đăng nhập thấy nhóm",
    bossLogin.ok && bossSees && !!newPw && nsSees, JSON.stringify({ bossSees, newPw: !!newPw, nsSees }));
  const fake = await outsider.req("/api/conversations", { method: "POST", json: { isGroup: true, name: "Họp Nội Bộ BitPaw", participantIds: [a.userId] } });
  R.check("T2c", "Người thường không tạo được nhóm giả tên 'Họp Nội Bộ BitPaw' (tên giữ chỗ)", fake.status === 400, fake.status);

  const out2 = run("--remove", newStaff);
  const file2 = fs.readFileSync(OUT, "utf8");
  const list2 = await a.req("/api/messages");
  const groups = (list2.data.conversations || []).filter((c) => c.isGroup && c.name === "Họp Nội Bộ BitPaw");
  const nsAfter = await ns.req(`/api/conversations?id=${g?.id}`);
  R.check("T6", "Chạy lại với --remove: không tạo trùng tài khoản / nhóm, giữ mật khẩu cũ; người bị bỏ quyền rời nhóm (không mở được nhóm nữa)",
    /0 tài khoản mới/.test(out2) && /giữ mật khẩu cũ/.test(file2) && groups.length === 1 && groups[0].participants.length === 11 && nsAfter.status === 404 && (await new Client().login(creds[2].email, creds[2].pw)).ok,
    JSON.stringify({ out2: out2.slice(0, 160), groups: groups.length }));

  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const p = await ctx.newPage();
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(creds[0].email);
  await p.locator("#password").fill(creds[0].pw);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
  await p.goto(`${BASE_URL}/vi/messages?c=${g.id}`);
  await p.locator("[data-group-avatar]").first().waitFor({ timeout: 20000 });
  const src = await p.locator("[data-group-avatar]").first().getAttribute("src");
  await p.screenshot({ path: path.join(os.tmpdir(), "staff_group.png") });
  R.check("T7", "Mở nhóm trên điện thoại: đầu khung chat hiện logo B làm ảnh nhóm", src === "/logo_b.jpg", src);
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 300), false);
} finally {
  await browser?.close();
  try { fs.unlinkSync(OUT); } catch {}
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
