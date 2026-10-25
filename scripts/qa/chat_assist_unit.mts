// Kiểm thử TRỢ LÝ TRẢ LỜI trong Messenger (lib/chatAssist): hiểu đúng ý tin khách (Việt có dấu / không dấu / Anh /
// viết tắt), gợi ý đúng ngôn ngữ khách, giá lấy thật từ menu thợ (không bịa), câu mở đầu đúng cặp vai trò.
//   npx tsx scripts/qa/chat_assist_unit.mts
import { detectIntents, detectHireIntents, hireSuggestions, proSuggestions, starters, isVietnamese, replyInVietnamese, type HireIntent, type Intent } from "../../lib/chatAssist";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`); };
const has = (text: string, ...want: Intent[]) => { const got = detectIntents(text); return want.every((w) => got.includes(w)); };
const menu = [{ name: "Gel-X", priceFrom: 55, priceTo: 70 }, { name: "Sơn gel", priceFrom: 35, priceTo: null }, { name: "Bột", priceFrom: 50, priceTo: 65 }, { name: "Vẽ", priceFrom: 0, priceTo: null }];
const ctx = { market: "US" as const, menu, menuUrl: "https://www.bitpawos.com/menu/abc" };

// 1. hiểu ý
const cases: [string, Intent[]][] = [
  ["Giá bao nhiêu ạ", ["price"]], ["gia bn vay chi", ["price"]], ["How much for a full set?", ["price"]], ["mẫu này bn tiền", ["price", "design"]],
  ["Mai còn lịch không ạ", ["booking"]], ["có thể đặt hẹn chiều nay ko", ["booking"]], ["Do you have availability this weekend?", ["booking"]], ["Can I book for tomorrow 2pm", ["booking"]],
  ["Tiệm ở đâu vậy", ["location"]], ["what's your address?", ["location"]], ["Mấy giờ mở cửa ạ", ["hours"]], ["are you open sunday", ["hours"]],
  ["Cảm ơn em nhiều", ["thanks"]], ["thank you!", ["thanks"]], ["Chào tiệm", ["greeting"]], ["hello", ["greeting"]],
  ["Làm được mẫu này không ạ, giá sao", ["design", "price"]], ["Can you do this design?", ["design"]],
];
const bad = cases.filter(([t, w]) => !has(t, ...w)).map(([t, w]) => `"${t}" → ${detectIntents(t).join(",") || "∅"} (cần ${w.join(",")})`);
ok("A1", `Hiểu ý tin khách: giá / lịch / địa chỉ / giờ / cảm ơn / chào / hỏi mẫu — Việt có dấu, không dấu, viết tắt (bn, ko), tiếng Anh (${cases.length} câu)`, !bad.length, bad.join(" | "));
const neutral = ["ok", "dạ", "😍😍", "Em tên Lan", "Tối nay em bận"].filter((t) => detectIntents(t).some((x) => x === "price" || x === "booking" || x === "location"));
ok("A2", "Câu không hỏi gì (ok, dạ, emoji, giới thiệu tên) không bị hiểu nhầm thành hỏi giá / lịch / địa chỉ", !neutral.length, neutral.join(" | "));
ok("A3", "Ảnh khách gửi → hiểu là gửi mẫu / ảnh tay", detectIntents("https://res.cloudinary.com/x.jpg", "IMAGE").join() === "design");
ok("A4", "Nhận ra tiếng Việt có dấu / tiếng Anh", isVietnamese("Giá bao nhiêu ạ") && !isVietnamese("How much is it"));

// 2. gợi ý trả lời
const p = proSuggestions({ content: "Giá bao nhiêu ạ", type: "TEXT" }, ctx);
ok("B1", "Khách hỏi giá → gợi ý đầu là bảng giá THẬT từ menu ($55–70 Gel-X, $35 sơn gel, $50–65 bột), bỏ món chưa có giá, kèm link menu", /Gel-X \$55–70/.test(p[0].text) && /Sơn gel \$35/.test(p[0].text) && /Bột \$50–65/.test(p[0].text) && !/Vẽ \$0/.test(p[0].text) && p[0].text.includes(ctx.menuUrl), JSON.stringify(p[0]));
const pe = proSuggestions({ content: "How much for a full set?", type: "TEXT" }, ctx);
ok("B2", "Khách nhắn tiếng Anh → câu trả lời tiếng Anh (tên món giữ đúng tên thợ đặt trong menu)", /^Our prices: .*Send me a photo/.test(pe[0].text) && !isVietnamese(pe[0].text.replace(/Sơn gel|Bột/g, "")), pe[0].text);
const pb = proSuggestions({ content: "Mai còn lịch không ạ", type: "TEXT" }, ctx);
ok("B3", "Khách hỏi lịch → gửi link đặt lịch + hỏi giờ khách muốn; không bịa giờ mở cửa", /còn lịch/.test(pb[0].text) && pb[0].text.includes(ctx.menuUrl) && pb.some((x) => /mấy giờ/.test(x.text)) && !pb.some((x) => /\d{1,2}(am|pm|h)/i.test(x.text)), JSON.stringify(pb));
const pi = proSuggestions({ content: "https://x/y.jpg", type: "IMAGE" }, ctx);
ok("B4", "Khách gửi ảnh → gợi ý Vẽ thử lên tay khách (mở Thử mẫu) + Soi tay tư vấn + báo giá theo menu", pi[0].action === "studio" && pi.some((x) => x.action === "consult") && pi.length === 3, JSON.stringify(pi.map((x) => [x.label, x.action])));
const pm = proSuggestions({ content: "Giá bao nhiêu ạ", type: "TEXT" }, { ...ctx, menu: [] });
ok("B5", "Thợ chưa có menu → KHÔNG đưa giá bịa, mời khách gửi ảnh để báo giá", !/\$\d/.test(pm.map((x) => x.text).join(" ")) && /gửi em ảnh/.test(pm[0].text), JSON.stringify(pm));
const pa = proSuggestions({ content: "Giá bao nhiêu ạ", type: "TEXT" }, { ...ctx, market: "AU" });
ok("B6", "Thợ ở Úc → giá A$", /A\$55–70/.test(pa[0].text), pa[0].text);
const noAccent = ["gia bn vay chi", "mai con lich ko em", "tiem o dau vay", "cam on em nha", "lam mau nay dc ko"].filter((t) => !replyInVietnamese(t, false));
const english = ["How much for a full set?", "Can I book for tomorrow", "thank you!", "Do you have availability this weekend?"].filter((t) => replyInVietnamese(t, true));
ok("B8", "Khách gõ KHÔNG DẤU (gia bn vay chi, mai con lich ko…) → vẫn trả lời tiếng Việt; khách nhắn tiếng Anh → tiếng Anh", !noAccent.length && !english.length, JSON.stringify({ noAccent, english }));
const pn = proSuggestions({ content: "gia bn vay chi", type: "TEXT" }, { ...ctx, fallbackVi: false });
ok("B9", "Thợ dùng app tiếng Anh nhưng khách gõ Việt không dấu → gợi ý vẫn bằng tiếng Việt", /^Dạ giá bên em/.test(pn[0].text), pn[0].text);
const po = proSuggestions({ content: "ok", type: "TEXT" }, { ...ctx, fallbackVi: false });
ok("B10", "Tin không đoán được ngôn ngữ (ok, emoji) → theo ngôn ngữ app của thợ", po.every((x) => !isVietnamese(x.text.replace(/Sơn gel|Bột/g, ""))), JSON.stringify(po.map((x) => x.text)));
const all = [null, { content: "ok", type: "TEXT" }, { content: "Cảm ơn em", type: "TEXT" }, { content: "Chào tiệm", type: "TEXT" }, { content: "x", type: "IMAGE" }].map((l) => proSuggestions(l, ctx));
ok("B7", "Luôn có 1–3 gợi ý, không trùng nhau, luôn có đường đi tiếp (đặt lịch / mời gửi ảnh)", all.every((a) => a.length >= 1 && a.length <= 3 && new Set(a.map((x) => x.text)).size === a.length && a.some((x) => x.text.includes(ctx.menuUrl) || /ảnh|photo/i.test(x.text) || !!x.action)), JSON.stringify(all.map((a) => a.map((x) => x.label))));

// 3. chat TUYỂN THỢ (chủ tiệm ↔ thợ)
const hcases: [string, HireIntent[]][] = [
  ["Tiệm còn tuyển thợ không ạ", ["hiring"]], ["tiem con tuyen tho ko a", ["hiring"]], ["Lương tính sao ạ", ["pay"]], ["luong sao anh", ["pay"]], ["Có chỗ ở không ạ", ["housing"]],
  ["chia turn sao ạ", ["turn"]], ["Bạn làm được bột với dip không", ["skills"]], ["Khi nào bạn ghé tiệm thử tay nghề được", ["trial"]], ["Are you still hiring? What's the pay?", ["hiring", "pay"]],
  ["Do you offer housing?", ["housing"]], ["Can you come by for a trial tomorrow?", ["trial"]],
];
const hbad = hcases.filter(([t, w]) => { const g = detectHireIntents(t); return !w.every((x) => g.includes(x)); }).map(([t, w]) => `"${t}" → ${detectHireIntents(t).join(",") || "∅"} (cần ${w.join(",")})`);
ok("H1", `Hiểu ý tin tuyển thợ: còn tuyển / lương / chỗ ở / chia turn / tay nghề / ghé thử — Việt có dấu, không dấu, Anh (${hcases.length} câu)`, !hbad.length, hbad.join(" | "));
const job = { title: "Cần thợ Bột/Dip gấp", salaryType: "Bao lương", salaryAmount: "$1,200-1,500/tuần", benefits: "Có chỗ ở,Bao lương" };
const oc = { side: "owner" as const, city: "Houston", state: "TX", job, turn: "6/4", housing: false };
const o1 = hireSuggestions({ content: "Chào anh, tiệm còn tuyển thợ không ạ? Lương sao ạ?", type: "TEXT" }, oc);
ok("H2", "Thợ hỏi còn tuyển + lương → chủ tiệm có gợi ý lương THẬT từ tin tuyển ($1,200-1,500/tuần, chia turn 6/4), không lặp câu chào", o1.some((x) => x.text.includes("$1,200-1,500/tuần") && x.text.includes("6/4")) && !o1.some((x) => /Chào thợ/.test(x.label)) && o1.length <= 3, JSON.stringify(o1.map((x) => x.text)));
const o2 = hireSuggestions({ content: "Tiệm có chỗ ở không ạ", type: "TEXT" }, oc);
ok("H3", "Hỏi chỗ ở → tin tuyển có \"Có chỗ ở\" → trả lời có hỗ trợ chỗ ở", /có hỗ trợ chỗ ở/.test(o2[0].text), o2[0].text);
const o3 = hireSuggestions({ content: "Lương sao ạ", type: "TEXT" }, { side: "owner", housing: false });
ok("H4", "Chủ tiệm CHƯA đăng tin tuyển → không bịa lương, mời thợ gửi ảnh tay nghề để báo lương", !/\$\d/.test(o3.map((x) => x.text).join(" ")) && /ảnh tay nghề/.test(o3[0].text), JSON.stringify(o3.map((x) => x.text)));
const tc = { side: "tech" as const, city: "San Jose", state: "CA", skills: ["Bột/Acrylic", "Gel-X"], years: 5, profileUrl: "https://www.bitpawos.com/profile/t1" };
const t1 = hireSuggestions({ content: "Chào bạn, tiệm mình đang cần thợ, bạn còn nhận việc không?", type: "TEXT" }, tc);
ok("H5", "Chủ tiệm hỏi còn nhận việc → thợ có câu giới thiệu: kỹ năng THẬT trong hồ sơ, số năm, khu vực, link ảnh tay nghề", /Bột\/Acrylic, Gel-X/.test(t1[0].text) && /5 năm/.test(t1[0].text) && /San Jose, CA/.test(t1[0].text) && t1[0].text.includes(tc.profileUrl), t1[0].text);
const t2 = hireSuggestions({ content: "Lương bên tiệm $1,300/tuần nha", type: "TEXT" }, tc);
const t3 = hireSuggestions({ content: "Can you do acrylic?", type: "TEXT" }, tc);
ok("H6", "Chủ tiệm báo lương có số → thợ có câu đồng ý + hỏi ngày ghé thử; chủ tiệm nhắn tiếng Anh → thợ trả lời tiếng Anh", /mức đó em thấy ổn/.test(t2[0].text) && /^I can do Acrylic, Gel-X, 5 years' experience/.test(t3[0].text), JSON.stringify([t2[0].text, t3[0].text]));
const hall = [null, { content: "ok", type: "TEXT" }, { content: "x", type: "IMAGE" }].flatMap((l) => [hireSuggestions(l, oc), hireSuggestions(l, tc)]);
const t4 = hireSuggestions({ content: "Are you still hiring?", type: "TEXT" }, { ...tc, years: 1 });
const o4 = hireSuggestions({ content: "Are you still hiring? What's the pay?", type: "TEXT" }, oc);
ok("H8", "Trả lời tiếng Anh: kỹ năng / tên tin / lương dịch sang tiếng Anh (Acrylic, \"/wk\"), số ít \"1 year's\" — không lẫn tiếng Việt", /1 year's experience/.test(t4[0].text) && !isVietnamese(t4[0].text) && o4.every((x) => !isVietnamese(x.text)) && o4.some((x) => /\/wk/.test(x.text)), JSON.stringify([t4[0].text, ...o4.map((x) => x.text)]));
ok("H7", "Chat tuyển thợ: luôn có 1–3 gợi ý, không trùng", hall.every((a) => a.length >= 1 && a.length <= 3 && new Set(a.map((x) => x.text)).size === a.length), JSON.stringify(hall.map((a) => a.map((x) => x.label))));

// 4. câu mở đầu đúng vai
const T = (v: string) => v;
const c2p = starters("CLIENT", "OWNER", T), p2c = starters("TECHNICIAN", "CLIENT", T), o2t = starters("OWNER", "TECHNICIAN", T), t2o = starters("TECHNICIAN", "OWNER", T);
ok("C1", "Câu mở đầu đúng cặp vai: khách → tiệm hỏi lịch / giá (KHÔNG hỏi tuyển thợ); thợ → khách mời gửi ảnh; chủ tiệm → thợ hỏi việc; thợ → chủ tiệm hỏi tuyển",
  c2p.every((x) => !/tuyển|lương|turn/.test(x)) && c2p.some((x) => /lịch/.test(x)) && p2c.some((x) => /ảnh/.test(x)) && p2c.every((x) => !/tuyển/.test(x)) && o2t.some((x) => /cần thợ/.test(x)) && t2o.some((x) => /tuyển thợ/.test(x)),
  JSON.stringify({ c2p, p2c }));

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
