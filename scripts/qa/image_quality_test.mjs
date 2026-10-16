// "AI chấm ảnh" mẫu nail (miễn phí): vẽ nhiều ảnh ứng viên → AI chấm → giữ ảnh đẹp nhất, KHÔNG đăng
// ảnh xấu, giữ trong hạn mức ngày; khung ảnh chỉ mô tả điều muốn có; ảnh thật từ menu thợ ở trang Mẫu nail.
// Cloudflare GIẢ (:4992). CHỈ chạy với server local (bash scripts/qa/start-launch-server.sh).
//   node scripts/qa/image_quality_test.mjs
import http from "node:http";
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, Results, SEED_TECH, registerUser } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("image_quality_test chỉ chạy với server local");
const R = new Results("AI chấm ảnh mẫu nail");
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");
const today = new Date().toISOString().slice(0, 10);
await db.execute(`DELETE FROM "NailDesignSave"`);
await db.execute(`DELETE FROM "NailDesign"`);
await db.execute({ sql: `DELETE FROM "AppSetting" WHERE key = ?`, args: [`img_cand:${today}`] });

// ---------- Cloudflare giả: FLUX trả ảnh "IMGn", Llama 4 Scout chấm theo kịch bản ----------
let n = 0;
const flux = []; // { prompt, id }
const judged = []; // ảnh nào được đưa đi chấm
let verdicts = []; // hàng đợi kết quả chấm; hết → điểm 8
let judgeDown = false;
const ok = (score, over = {}) => ({ hand: true, fiveFingers: true, textFree: true, nailsClear: true, matches: true, realistic: true, score, issues: [], ...over });
const cf = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const body = JSON.parse(b || "{}");
    res.setHeader("content-type", "application/json");
    if (/flux-1-schnell$/.test(req.url)) {
      n++;
      flux.push({ prompt: body.prompt, id: `IMG${n}` });
      return res.end(JSON.stringify({ success: true, result: { image: Buffer.from(`IMG${n}`).toString("base64") } }));
    }
    if (/llama-4-scout/.test(req.url)) {
      if (judgeDown) return res.writeHead(500).end(JSON.stringify({ success: false, errors: [{ message: "down" }] }));
      const url = body.messages?.[1]?.content?.find?.((c) => c.type === "image_url")?.image_url?.url || "";
      judged.push(Buffer.from(url.split(",")[1] || "", "base64").toString());
      return res.end(JSON.stringify({ success: true, result: { response: verdicts.length ? verdicts.shift() : ok(8) } }));
    }
    res.writeHead(500).end(JSON.stringify({ success: false, errors: [{ message: "not in test" }] })); // model chữ (viết bài) — ngoài phạm vi
  });
});
await new Promise((r) => cf.listen(4992, "127.0.0.1", r));
const cron = (count = 1) => fetch(BASE_URL + `/api/cron/designs?count=${count}`, { headers: { authorization: "Bearer test-cron" } }).then((r) => r.json());
const row = async (id) => (await db.execute({ sql: `SELECT imageUrl, prompt FROM "NailDesign" WHERE id = ?`, args: [id] })).rows[0];
const imgOf = (u) => (u ? Buffer.from(String(u).split(",")[1] || "", "base64").toString() : null);
let browser;
const errors = [];

try {
  // Q1: ảnh 1 lỗi ngón (AI cho 9 nhưng fiveFingers=false → ép 3), ảnh 2 đạt 8 → giữ ảnh 2, dừng (không vẽ ảnh 3)
  verdicts = [ok(9, { fiveFingers: false, issues: ["six fingers"] }), ok(8)];
  const f0 = flux.length;
  const c1 = await cron(1);
  const id1 = c1.created?.[0];
  const r1 = id1 ? await row(id1) : null;
  const drawn1 = flux.slice(f0);
  R.check("Q1", "Vẽ ảnh ứng viên → AI chấm từng ảnh → ảnh lỗi ngón bị loại dù AI cho 9 điểm, giữ ảnh 2 (8/10), dừng sớm", drawn1.length === 2 && imgOf(r1?.imageUrl) === drawn1[1].id && /\[q:8\]/.test(r1?.prompt || "") && JSON.stringify(judged.slice(-2)) === JSON.stringify(drawn1.map((d) => d.id)),
    JSON.stringify({ drawn: drawn1.map((d) => d.id), kept: imgOf(r1?.imageUrl), judged: judged.slice(-2), q: r1?.prompt?.match(/\[q:[^\]]*\]/)?.[0], err: c1.errors }));
  R.check("Q2", "2 ảnh ứng viên khác bối cảnh; khung ảnh chỉ mô tả điều muốn có (không câu phủ định gợi ra chữ / thừa ngón)",
    drawn1.length === 2 && drawn1[0].prompt !== drawn1[1].prompt && drawn1.every((d) => { const style = d.prompt.split(". Professional nail salon portfolio photograph")[1]; return !!style && !/\b(no|not|without|never)\b/i.test(style) && !/(woman|skin)/i.test(style); }),
    drawn1.map((d) => d.prompt.slice(-160)).join(" || "));

  // Q3: cả 3 ảnh đều xấu (có chữ → ép 3; 4; 4.5) → KHÔNG đăng ảnh xấu, đánh dấu thử hôm nay, báo lỗi rõ
  verdicts = [ok(9.5, { textFree: false, issues: ["gibberish text"] }), ok(4, { issues: ["blurry nails"] }), ok(4.5)];
  const f1 = flux.length;
  const c2 = await cron(1);
  const id2 = c2.created?.[0];
  const r2 = id2 ? await row(id2) : null;
  R.check("Q3", "3 ảnh đều dưới 5 điểm → không đăng ảnh xấu (giữ hình minh hoạ), báo \"Ảnh chưa đạt\" kèm lỗi, đánh dấu để mai vẽ lại",
    flux.length - f1 === 3 && r2 && r2.imageUrl === null && r2.prompt.includes(`[try:${today}]`) && c2.errors?.some((e) => /Ảnh chưa đạt \(4\.5\/10 sau 3 ảnh/.test(e)),
    JSON.stringify({ drawn: flux.length - f1, img: r2?.imageUrl, err: c2.errors }));

  // Q4: lượt sau trong ngày: vẽ mẫu mới, KHÔNG vẽ lại mẫu vừa hỏng (không đốt hạn mức vào 1 mẫu khó)
  const f2 = flux.length;
  verdicts = [];
  const c3 = await cron(1);
  const r2b = await row(id2);
  const r3 = c3.created?.[0] ? await row(c3.created[0]) : null;
  R.check("Q4", "Lượt vẽ cùng ngày bỏ qua mẫu đã thử hỏng hôm nay (chỉ vẽ 1 ảnh cho mẫu mới)", flux.length - f2 === 1 && r2b.imageUrl === null && imgOf(r3?.imageUrl) === flux.at(-1).id, JSON.stringify({ drawn: flux.length - f2, err: c3.errors }));

  // Q6: hạn mức ảnh ứng viên / ngày (mặc định 40) — đã đủ thì không gọi Cloudflare nữa (0đ, không vượt free)
  const used = Number((await db.execute({ sql: `SELECT value FROM "AppSetting" WHERE key = ?`, args: [`img_cand:${today}`] })).rows[0]?.value);
  await db.execute({ sql: `UPDATE "AppSetting" SET value = '40' WHERE key = ?`, args: [`img_cand:${today}`] });
  const f4 = flux.length;
  const c5 = await cron(1);
  const r5 = c5.created?.[0] ? await row(c5.created[0]) : null;
  R.check("Q6", "Đếm đúng số ảnh ứng viên trong ngày (6); chạm hạn mức 40/ngày → không vẽ thêm, mẫu vẫn tạo (hình minh hoạ)", used === 6 && flux.length === f4 && r5 && r5.imageUrl === null, JSON.stringify({ used, drawn: flux.length - f4, created: c5.created?.length }));
  await db.execute({ sql: `DELETE FROM "AppSetting" WHERE key = ?`, args: [`img_cand:${today}`] });

  // Q5: AI chấm hỏng → giữ cách cũ (nhận ảnh đầu, không chấm, không chặn cả lượt vẽ)
  judgeDown = true;
  const f3 = flux.length;
  const c4 = await cron(1);
  judgeDown = false;
  const r4 = c4.created?.[0] ? await row(c4.created[0]) : null;
  R.check("Q5", "AI chấm không trả lời → vẫn nhận ảnh đầu tiên như trước (không có điểm), không treo lượt vẽ", flux.length - f3 === 1 && imgOf(r4?.imageUrl) === flux.at(-1).id && !/\[q:/.test(r4?.prompt || ""), JSON.stringify({ drawn: flux.length - f3, kept: imgOf(r4?.imageUrl), err: c4.errors }));

  // Q7: admin thấy điểm chấm ảnh
  const a = await registerUser({ name: "QA Judge Admin" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  await a.client.login(a.body.email, a.body.password);
  const st = (await a.client.req("/api/admin/designs")).data;
  const all = [...(st.drafts || []), ...(st.published || [])];
  R.check("Q7", "Trang admin nhận điểm chấm ảnh (8/10) của mẫu đã vẽ", all.find((d) => d.id === id1)?.quality === 8 && all.find((d) => d.id === c4.created?.[0])?.quality === null, JSON.stringify(all.map((d) => [d.id === id1, d.quality])));

  // Q8: ảnh thật từ menu thợ ở trang Mẫu nail (bỏ ảnh AI chép từ kho, bỏ mẫu đang ẩn)
  const tech = new Client();
  await tech.login(SEED_TECH);
  for (const it of (await tech.req(`/api/menu?userId=${(await tech.req("/api/auth/session")).data.user.id}`)).data.items || []) if (/^QA /.test(it.name)) await tech.req(`/api/menu/${it.id}`, { method: "DELETE" });
  const REAL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  const AI = "https://res.cloudinary.com/demo/image/upload/v1/pawbook/designs/abc.jpg";
  const mk = async (data) => (await tech.req("/api/menu", { method: "POST", json: data })).data.item?.id;
  const real = await mk({ name: "QA Ảnh thật mắt mèo", priceFrom: 48, images: [REAL] });
  const aiCopy = await mk({ name: "QA Ảnh AI chép", priceFrom: 40, images: [AI] });
  const hidden = await mk({ name: "QA Ảnh thật đang ẩn", priceFrom: 40, images: [REAL], active: false });
  const noImg = await mk({ name: "QA Không ảnh", priceFrom: 40 });
  const show = (await fetch(BASE_URL + "/api/menu/showcase?limit=24").then((r) => r.json())).items || [];
  const names = show.map((i) => i.name);
  R.check("Q8", "Trang Mẫu nail: mẫu có ẢNH THẬT trong menu thợ được khoe (kèm giá, tên thợ); ảnh AI chép / mẫu ẩn / không ảnh thì không; không lộ vật tư",
    names.includes("QA Ảnh thật mắt mèo") && !names.some((x) => /AI chép|đang ẩn|Không ảnh/.test(x)) && show.find((i) => i.name === "QA Ảnh thật mắt mèo")?.owner?.name && show.every((i) => i.materials === null && !("email" in (i.owner || {}))),
    JSON.stringify(names));

  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(BASE_URL + "/designs");
  const strip = page.getByRole("region", { name: "Menu có giá từ thợ" });
  const vis = await strip.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  const link = vis ? await strip.getByRole("link", { name: /QA Ảnh thật mắt mèo/ }).getAttribute("href") : null;
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  R.check("Q9", "Điện thoại: dải \"Menu có giá từ thợ\" hiện ở trang Mẫu nail, bấm vào mở menu của thợ; không tràn ngang", vis && /^\/menu\//.test(link || "") && ov <= 1, JSON.stringify({ vis, link, ov }));
  R.check("Q10", "Không có lỗi JavaScript", errors.length === 0, errors.join(" | "));
  for (const id of [real, aiCopy, hidden, noImg].filter(Boolean)) await tech.req(`/api/menu/${id}`, { method: "DELETE" });
} finally {
  await browser?.close();
  cf.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
