// ĐÓNG VAI trên web THẬT — CHỈ XEM (không đăng nhập, không gửi form, không tạo dữ liệu).   node scripts/qa/prod_roleplay.mjs <thư mục ảnh>
import fs from "node:fs";
import { chromium, devices } from "playwright";
const SITE = "https://www.bitpawos.com";
const OUT = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
const p = await ctx.newPage();
const errs = [];
const bad = [];
p.on("pageerror", (e) => errs.push(`${p.url()} ${e.message.slice(0, 120)}`));
p.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(SITE)) bad.push(`${r.status()} ${r.url()}`); });
const res = [];
const check = (name, ok, detail = "") => { res.push({ name, ok, detail }); console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  → " + detail}`); };
const text = () => p.evaluate(() => document.body.innerText);
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const visit = async (path, wait = 3500) => { await p.goto(SITE + path, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(wait); };

// THỢ tìm việc: tab Việc làm
await visit("/?tab=jobs", 4500);
let t = await text();
const jobs = await fetch(SITE + "/api/jobs?market=US").then((r) => r.json());
const newest = jobs[0];
check("Thợ: Việc làm có tin mới từ tool (hôm nay), tên + lương gọn, không tin sang/bán tiệm",
  jobs.length >= 20 && (Date.now() - new Date(newest.createdAt).getTime()) < 36 * 3600e3 && !jobs.some((j) => /sang tiệm|bán tiệm|nhận cọc/i.test(j.description)) && !jobs.some((j) => /\(.*\)$/.test(j.salonName)),
  JSON.stringify({ n: jobs.length, newest: newest?.createdAt, names: jobs.slice(0, 5).map((j) => j.salonName) }));
check("Thợ: không có lương vô lý (mảnh SĐT, giá dịch vụ)", !jobs.some((j) => /^\$?\d{2,3}$|bao lương \d{4}\d/.test(j.salaryAmount || "")), JSON.stringify(jobs.map((j) => j.salaryAmount)));
check("Thợ: tab Việc làm không tràn ngang", (await overflow()) <= 1);
await p.screenshot({ path: `${OUT}/rp_jobs.png`, fullPage: false });

// Mở 1 tin chi tiết
await visit(`/jobs/${newest.id}`, 3500);
t = await text();
check("Thợ: mở tin chi tiết — có nút Gọi / nội dung, không lỗi", /Gọi|Nhắn/.test(t) && (await overflow()) <= 1, t.slice(0, 120));

// Thợ rảnh: không còn thợ mẫu, có lời mời tạo hồ sơ
await visit("/?tab=portfolio", 4000);
t = await text();
check("Khách: Thợ rảnh không còn tài khoản mẫu; khung trống mời tạo hồ sơ + số tiệm đang tuyển thật", !/Emily Nguyen|Dat Truong|Long Tran/.test(t) && /Tạo hồ sơ thợ miễn phí|Thợ đang tìm việc/.test(t), t.slice(t.indexOf("Thợ rảnh"), t.indexOf("Thợ rảnh") + 200));

// Bảng tin
await visit("/?tab=feed", 5000);
t = await text();
const feed = await fetch(SITE + "/api/posts").then((r) => r.json());
const kinds = feed.posts.filter((x) => x.author.role === "ADMIN").map((x) => x.content.trim().slice(0, 2));
check("Bảng tin: không bài mẫu, mỗi loại bài chính thức 1 bài / ngày (không 2 'Mẫu hôm nay')", !/chrome mirror đang cháy hàng|kín lịch — báo hiệu/.test(t) && kinds.filter((k) => k.startsWith("✨")).length <= 1, JSON.stringify(kinds));
check("Bảng tin không tràn ngang", (await overflow()) <= 1);
await p.screenshot({ path: `${OUT}/rp_feed.png`, fullPage: false });

// Mẫu nail
await visit("/designs", 4000);
t = await text();
check("Mẫu nail: có mẫu, nhãn 'Ảnh minh hoạ AI'", /Ảnh minh hoạ AI/.test(t) && (await overflow()) <= 1);

// Khách quét QR menu của tiệm thật
const ownerId = jobs.find((j) => j.owner?.id && j.source !== "ingest")?.owner?.id || jobs[0].owner?.id;
await visit(`/menu/${ownerId}`, 3500);
t = await text();
check("Khách quét QR menu: trang mở được, không lỗi (menu trống thì báo gọn)", (await overflow()) <= 1 && /Menu mẫu nail|Chưa có mẫu/.test(t), t.slice(0, 160));

// Trang cho thợ / chủ (chưa đăng nhập → mời đăng nhập, không lỗi)
for (const [path, re] of [["/consult", /Đăng nhập|thợ nail và chủ tiệm/], ["/bookings", /thợ và chủ tiệm|Đăng nhập|Lịch hẹn/], ["/trends", /Xu hướng/], ["/supply", /Kho hàng|vật tư|sản phẩm/i], ["/auth/register?role=technician", /Đăng ký|thợ/i], ["/auth/register?role=owner", /Đăng ký|tiệm/i]]) {
  await visit(path, 3000);
  t = await text();
  check(`Trang ${path} mở đúng, không tràn ngang`, re.test(t) && (await overflow()) <= 1, t.slice(0, 100));
}
// Link đánh giá sai → báo gọn, không lỗi
await visit("/r/khong-co-link-nay-1234567890", 3000);
t = await text();
check("Link đánh giá sai → thông báo gọn", /không đúng|đã bị xoá/.test(t));

check("Không có lỗi JavaScript", errs.length === 0, errs.join(" | "));
check("Không có lỗi máy chủ 5xx", bad.length === 0, bad.join(" | "));
fs.writeFileSync(`${OUT}/rp_result.json`, JSON.stringify(res, null, 1));
console.log(`\nĐóng vai web thật: ${res.filter((r) => r.ok).length}/${res.length} PASS`);
await b.close();
