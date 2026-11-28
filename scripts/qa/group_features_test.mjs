// NHÓM chat "xịn": thành viên + online, lịch làm việc, họp video nhóm (mesh, tối đa 8). Bảo mật: người ngoài nhóm bị chặn
// ở MỌI API. CHỈ chạy với server QA local + Pusher giả (NEXT_PUBLIC_PUSHER_TEST_WS):
//   BASE_URL=http://localhost:3000 node scripts/qa/group_features_test.mjs
import { chromium } from "playwright";
import { BASE_URL, Client, Results, registerUser } from "./lib.mjs";

const R = new Results("Nhóm: thành viên · lịch làm việc · họp nhóm");
const errors = [];
let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

try {
  const [a, b, c, d] = await Promise.all([
    registerUser({ name: "QA Nhóm An", role: "OWNER" }),
    registerUser({ name: "QA Nhóm Bình" }),
    registerUser({ name: "QA Nhóm Chi" }),
    registerUser({ name: "QA Người Ngoài" }),
  ]);
  for (const u of [a, b, c, d]) await u.client.login(u.body.email, u.body.password);
  const g = await a.client.req("/api/conversations", { method: "POST", json: { isGroup: true, name: "QA Nhóm tiệm Sunny", participantIds: [b.client.userId, c.client.userId] } });
  const gid = g.data.id;
  R.check("G0", "Chủ tiệm tạo nhóm nhân viên 3 người", g.status < 300 && !!gid && g.data.participants?.length === 3, g.status);

  // ---------- Lịch làm việc (API + quyền) ----------
  const day = iso(today);
  const s1 = await b.client.req(`/api/groups/${gid}/shifts`, { method: "POST", json: { date: day, start: "09:00", end: "17:00", userId: c.client.userId, note: "Trực tin nhắn khách" } });
  const bad = await Promise.all([
    b.client.req(`/api/groups/${gid}/shifts`, { method: "POST", json: { date: day, start: "17:00", end: "09:00", userId: c.client.userId } }),
    b.client.req(`/api/groups/${gid}/shifts`, { method: "POST", json: { date: "29/11/2026", start: "09:00", end: "10:00", userId: c.client.userId } }),
    b.client.req(`/api/groups/${gid}/shifts`, { method: "POST", json: { date: day, start: "09:00", end: "10:00", userId: d.client.userId } }),
  ]);
  const list = await c.client.req(`/api/groups/${gid}/shifts?from=${day}&days=7`);
  R.check("S1", "Thành viên thêm ca cho thành viên khác → 201; giờ ngược / ngày sai / người ngoài nhóm làm ca → 400; cả nhóm thấy ca",
    s1.status === 201 && bad.every((r) => r.status === 400) && list.data.shifts?.some((s) => s.id === s1.data.id && s.note === "Trực tin nhắn khách" && s.canDelete === true),
    JSON.stringify({ s1: s1.status, bad: bad.map((r) => r.status), n: list.data.shifts?.length }));
  const outsiderGet = await d.client.req(`/api/groups/${gid}/shifts`);
  const outsiderPost = await d.client.req(`/api/groups/${gid}/shifts`, { method: "POST", json: { date: day, start: "09:00", end: "10:00", userId: d.client.userId } });
  const outsiderDel = await d.client.req(`/api/groups/${gid}/shifts?shiftId=${s1.data.id}`, { method: "DELETE" });
  const anon = await new Client().req(`/api/groups/${gid}/shifts`);
  R.check("S2", "Người ngoài nhóm / chưa đăng nhập: không xem, không thêm, không xoá được lịch (404 / 401)", outsiderGet.status === 404 && outsiderPost.status === 404 && outsiderDel.status === 404 && anon.status === 401,
    [outsiderGet.status, outsiderPost.status, outsiderDel.status, anon.status]);
  const s2 = await a.client.req(`/api/groups/${gid}/shifts`, { method: "POST", json: { date: day, start: "18:00", end: "20:00", userId: a.client.userId } });
  const bDel = await b.client.req(`/api/groups/${gid}/shifts?shiftId=${s2.data.id}`, { method: "DELETE" });
  const cDel = await c.client.req(`/api/groups/${gid}/shifts?shiftId=${s1.data.id}`, { method: "DELETE" });
  R.check("S3", "Chỉ người tạo ca / người làm ca xoá được (người khác → 403)", bDel.status === 403 && cDel.status === 200, [bDel.status, cDel.status]);

  // ---------- Họp nhóm (API + quyền) ----------
  const dJoin = await d.client.req("/api/group-calls", { method: "POST", json: { c: gid, action: "join" } });
  const dState = await d.client.req(`/api/group-calls?c=${gid}`);
  R.check("M0", "Người ngoài nhóm không vào được cuộc họp, không xem được ai đang họp (404)", dJoin.status === 404 && dState.status === 404, [dJoin.status, dState.status]);

  // ---------- Giao diện: 3 người, camera / micro giả ----------
  browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-features=WebRtcHideLocalIpsWithMdns"] });
  const open = async (u) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, locale: "vi-VN", permissions: ["camera", "microphone"] });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${u.body.name}: ${e.message}`));
    await p.goto(BASE_URL + "/auth/login");
    await p.locator("#email").fill(u.body.email);
    await p.locator("#password").fill(u.body.password);
    await p.locator("#password").press("Enter");
    await p.waitForURL((x) => !x.pathname.startsWith("/auth"), { timeout: 30000 });
    await p.goto(`${BASE_URL}/vi/messages?c=${gid}`);
    await p.locator("[data-group-info-btn]").waitFor({ timeout: 20000 });
    return p;
  };
  const pa = await open(a);
  await sleep(1500);
  const pb = await open(b);
  await sleep(1500);

  // Thành viên + online
  await pa.locator("[data-group-info-btn]").click();
  await pa.locator("[data-group-info]").waitFor({ timeout: 10000 });
  const rows = await pa.locator("[data-group-member]").count();
  const bOnline = await pa.waitForFunction((id) => document.querySelector(`[data-group-member="${id}"]`)?.getAttribute("data-online") === "1", b.client.userId, { timeout: 15000 }).then(() => true).catch(() => false);
  const cOnline = await pa.locator(`[data-group-member="${c.client.userId}"]`).getAttribute("data-online");
  R.check("U1", "Bấm 'Thành viên & lịch' → thấy đủ 3 thành viên; Bình đang mở app → chấm 'Đang hoạt động'; Chi chưa mở → không", rows === 3 && bOnline && cOnline === "0", JSON.stringify({ rows, bOnline, cOnline }));

  // Lịch làm việc qua giao diện
  await pa.locator("[data-tab-schedule]").click();
  await pa.locator("[data-shift-add]").click();
  await pa.locator("[data-shift-user]").selectOption(b.client.userId);
  await pa.locator("[data-shift-start]").fill("10:00");
  await pa.locator("[data-shift-end]").fill("14:00");
  await pa.locator("[data-shift-note]").fill("Ca sáng QA");
  await pa.locator("[data-shift-save]").click();
  const shown = await pa.getByText("Ca sáng QA").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("U2", "Thêm ca qua giao diện (Bình 10:00–14:00) → hiện ngay trong lịch tuần", shown, "");
  await pa.keyboard.press("Escape");

  // Họp: An bắt đầu → Bình thấy "Đang họp" → vào; Chi vào sau
  await pa.locator("[data-group-meet-btn]").click();
  await pa.locator('[data-gm-root="in"]').waitFor({ timeout: 20000 });
  const live = await pb.locator("[data-meeting-live]").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("U3", "An bắt đầu họp → Bình (đang ở nhóm) thấy 'Đang họp · 1 người — Tham gia' ngay", live, "");
  await (live ? pb.locator("[data-meeting-live]") : pb.locator("[data-group-meet-btn]")).click();
  await pb.locator('[data-gm-root="in"]').waitFor({ timeout: 20000 });
  const pc = await open(c);
  await pc.locator("[data-group-meet-btn]").click();
  await pc.locator('[data-gm-root="in"]').waitFor({ timeout: 20000 });
  // Mỗi người phải GIẢI MÃ được hình của 2 người còn lại
  const decoding = (p) => p.waitForFunction(() => [...document.querySelectorAll("[data-gm-tile] video")].filter((v) => !v.muted && v.videoWidth > 0 && v.readyState >= 2).length >= 2, null, { timeout: 30000 }).then(() => true).catch(() => false);
  const [va, vb, vc] = await Promise.all([decoding(pa), decoding(pb), decoding(pc)]);
  const counts = await Promise.all([pa, pb, pc].map((p) => p.locator("[data-gm-count]").innerText()));
  R.check("U4", "3 người cùng họp: ai cũng thấy hình 2 người còn lại (video giải mã thật), đếm 3 người", va && vb && vc && counts.every((x) => x.trim() === "3"), JSON.stringify({ va, vb, vc, counts }));

  // Tắt micro / camera
  await pb.locator("[data-gm-mic]").click();
  await pb.locator("[data-gm-cam]").click();
  const st = await pb.evaluate(() => ({ mic: document.querySelector("[data-gm-mic]")?.getAttribute("data-gm-mic"), cam: document.querySelector("[data-gm-cam]")?.getAttribute("data-gm-cam") }));
  R.check("U5", "Bình tắt micro + camera → nút chuyển trạng thái tắt", st.mic === "off" && st.cam === "off", JSON.stringify(st));

  // Rời họp
  await pc.locator("[data-gm-leave]").click();
  const gone = await pa.waitForFunction(() => document.querySelector("[data-gm-count]")?.textContent?.trim() === "2", null, { timeout: 15000 }).then(() => true).catch(() => false);
  const cClosed = (await pc.locator("[data-gm-root]").count()) === 0;
  R.check("U6", "Chi rời họp → màn họp của Chi đóng, An thấy còn 2 người", gone && cClosed, JSON.stringify({ gone, cClosed }));
  await pa.locator("[data-gm-leave]").click();
  await pb.locator("[data-gm-leave]").click();
  await sleep(1500);
  const empty = await a.client.req(`/api/group-calls?c=${gid}`);
  R.check("U7", "Mọi người rời → phòng họp trống", (empty.data.members || []).length === 0, JSON.stringify(empty.data));
  R.check("U8", "Không lỗi JS", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 300), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
