// Bản EN cho bài chính thức (lib/officialEn): bài cũ chỉ tiếng Việt trên production (GET công khai /api/posts?market=US,
// 06/11/2026) được dựng lại bản EN; bài mới lưu 2 thứ tiếng qua EN_MARK; số liệu dịch phải có trong bản gốc.
//   env -u TURSO_DATABASE_URL npx tsx scripts/qa/official_en_unit.mts   (không dùng DB, không gọi AI)
import { deriveEn, galleryTitles, joinEn, pollEn, splitEn } from "../../lib/officialEn";
import { numbersKept } from "../../lib/translateEn";
import { pickLang } from "../../lib/enMark";

let fail = 0;
const ok = (c: unknown, m: string) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };

const gallery = "✨ 4 mẫu nail dễ làm, lên đều tay — thợ mới cũng làm đẹp 🌱\n\n1. Syrup xanh cobalt trong veo\n2. Nhũ vàng ánh kim loang nền nâu espresso\n3. French micro đỏ rượu ấm nền trắng sữa\n4. Giọt nước 3D trên nền nude be\n\n👉 Mỗi mẫu có sẵn vật tư, các bước làm và giá gợi ý: https://www.bitpawos.com/designs\nMẫu nào bạn làm dưới 45 phút? Khoe ảnh thật cho thợ mới học với nha 💅\n\nẢnh minh hoạ AI · #MauNail #PawNail";
ok(galleryTitles(gallery).length === 4, "gallery: 4 design titles found");
const titles = new Map([["Syrup xanh cobalt trong veo", "Clear cobalt syrup"], ["Nhũ vàng ánh kim loang nền nâu espresso", "Gold foil swirl on espresso"], ["French micro đỏ rượu ấm nền trắng sữa", "Wine micro French on milk"], ["Giọt nước 3D trên nền nude be", "3D water drops on nude"]]);
const gEn = deriveEn(gallery, { designTitleEn: titles });
ok(gEn?.startsWith("✨ 4 easy nail looks") && gEn.includes("1. Clear cobalt syrup") && gEn.includes("https://www.bitpawos.com/designs") && gEn.includes("AI illustrations"), "gallery: EN rebuilt with titleEn + link + AI label");
ok(deriveEn(gallery) === null, "gallery: no EN when a design title has no English name (never half-Vietnamese)");

const digest = "📍 Texas: 5 tiệm đang cần thợ tuần này (3 tin gấp)\n\n• Sunny Nails & Spa — San Antonio: cần Dip/SNS, Design · $1,000-1,300/tuần · 🔥 gấp\n• Rose Nails Bar — Austin: cần Bột/Acrylic, Gel-X · 60/40 ăn chia · 🔥 gấp\n• Happy Nails Lounge — Dallas: cần Mi/Lông mày, Dip/SNS · $1,400-1,800/tuần\n• …và 2 tiệm khác\n\n👉 Gọi thẳng cho tiệm, không qua trung gian: https://www.bitpawos.com/?tab=jobs\n🔔 Bật thông báo việc gấp để không lỡ tiệm gần bạn.\n\n#ViecLamNail #ThoNail #Texas";
const dEn = deriveEn(digest) || "";
console.log(dEn);
ok(dEn.startsWith("📍 Texas: 5 salons hiring this week (3 urgent)"), "digest: EN headline");
ok(dEn.includes("• Sunny Nails & Spa — San Antonio: needs Dip/SNS, Design · $1,000-1,300/wk · 🔥 urgent"), "digest: line with weekly pay");
ok(dEn.includes("Rose Nails Bar — Austin: needs Acrylic, Gel-X · 60/40 split"), "digest: skills + split translated");
ok(dEn.includes("…and 2 more salons") && dEn.includes("https://www.bitpawos.com/?tab=jobs") && !/[ạảấầẩẫậắằẳẵặẹẻẽếềểễệ]/.test(dEn), "digest: more-line, link, no Vietnamese left");

const hot = "💬 Mùa thuế sắp tới — bạn đang được trả theo 1099 hay W-2?\n\nNhiều bạn thợ…";
ok(deriveEn(hot)?.startsWith("💬 Tax season is coming"), "hot topic: EN text by first line");
const pe = pollEn("Năm nay bạn nhận giấy tờ thuế kiểu nào?");
ok(pe?.question === "What tax paperwork do you get this year?" && pe.options.length === 4, "hot topic: EN poll question + 4 options");
ok(deriveEn("📰 Một tin ngành bất kỳ") === null, "news without EN: null (UI offers See translation)");

const both = joinEn("Xin chào các bạn thợ", "Hello techs");
const sp = splitEn(both);
ok(sp.vi === "Xin chào các bạn thợ" && sp.en === "Hello techs", "joinEn/splitEn round-trip");
ok(splitEn("Bài thường").en === null, "plain post: no EN");
ok(numbersKept("Trừ tới $25,000 tiền tip (2025–2028)", "Deduct up to $25,000 in tips (2025–2028)"), "numbers kept: ok");
ok(!numbersKept("Trừ tới $25,000 tiền tip", "Deduct up to $35,000 in tips"), "numbers kept: invented number rejected");
ok(pickLang(both, "en") === "Hello techs" && pickLang(both, "vi") === "Xin chào các bạn thợ" && pickLang("chỉ tiếng Việt", "en") === "chỉ tiếng Việt", "pickLang: chat shows the viewer's language");
// lib/welcomeChat kéo theo lib/prisma → chỉ nạp sau khi chắc chắn không trỏ Turso (không query gì, chỉ dựng chữ)
if (process.env.TURSO_DATABASE_URL) throw new Error("TURSO_DATABASE_URL is set — refusing (offline unit test)");
const { welcomeText, welcomeTextEn, registrationSummary, registrationSummaryEn } = await import("../../lib/welcomeChat");
const info = { userId: "u", name: "Jamie Lee", role: "CLIENT" as const, market: "US" as const, state: "CA", city: "Irvine", phone: "(949) 555-0190", email: "j@example.com", via: "email" };
ok(welcomeTextEn(info).startsWith("Welcome to PawNail, Jamie Lee") && !/[ạảấầẩẫậắằẳẵặẹẻẽếềểễệ]/.test(welcomeTextEn(info) + registrationSummaryEn(info)), "welcome DM: English version, no Vietnamese left");
ok(welcomeText(info).startsWith("Chào mừng") && registrationSummary(info).startsWith("📋"), "welcome DM: Vietnamese version unchanged");
if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log("all ok");
