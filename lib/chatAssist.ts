// TRỢ LÝ TRẢ LỜI trong Messenger (thợ / tiệm ↔ khách làm nail) — như "trả lời nhanh" của Booksy / Fresha nhưng hiểu
// tin khách vừa nhắn: hỏi GIÁ, hỏi LỊCH, gửi ẢNH mẫu / ảnh tay, hỏi ĐỊA CHỈ, GIỜ, cảm ơn, chào. Gợi ý câu trả lời
// đúng ngôn ngữ khách (Việt / Anh), GIÁ LẤY THẬT TỪ MENU của thợ — không bịa giá, không bịa giờ mở cửa.
// Thợ bấm gợi ý → câu điền sẵn vào ô nhập để sửa rồi mới gửi (không tự gửi thay thợ).
// Thuần TypeScript, không gọi AI bên ngoài — nhanh, 0đ, chạy giống nhau trên mọi máy.

import { dtEn } from "./i18n/dataEn";

export type Intent = "price" | "booking" | "design" | "location" | "hours" | "thanks" | "greeting";

/** Tin nhắn có dấu tiếng Việt → khách nói tiếng Việt. */
export const isVietnamese = (s: string) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹáàãéèíìóòõúùý]/i.test(s);

// Khách Việt hay gõ KHÔNG DẤU ("gia bn vay chi", "mai con lich ko") → đếm từ Việt / từ Anh quen thuộc
const VI_WORDS = new Set("gia bn bnhieu ko k khong hok hong dc duoc vay z zay nha nhe nhen ak ah chi em anh lich mai tiem mau lam bao nhieu cam chao dau sao j gi hen dat minh nao oi ui roi chua co toi ban cho xin hoi bot son mong luong tuyen tho viec nhan tiem".split(" "));
const EN_WORDS = new Set("the you your for how much can do does have what is are my i it this that book booking price prices hi hello hey thanks thank please when where open nails nail set want would like an to any appointment available tomorrow today".split(" "));

/**
 * Trả lời khách bằng tiếng gì: có dấu → Việt; không dấu → đếm từ Việt / Anh; không đoán được (ok, emoji, "?")
 * → `fallback` (ngôn ngữ thợ đang dùng app).
 */
export function replyInVietnamese(text: string, fallback = true): boolean {
  if (isVietnamese(text)) return true;
  const words = (text.toLowerCase().match(/[a-z]+/g) || []);
  let vi = 0, en = 0;
  for (const w of words) { if (VI_WORDS.has(w)) vi++; if (EN_WORDS.has(w)) en++; }
  return vi === en ? fallback : vi > en;
}

// Ranh giới từ hiểu chữ có dấu: (?![\p{L}\p{N}]) thay cho \b (\b của JS chỉ hiểu a–z — "giá ", "chào " từng không khớp)
const RX: Record<Exclude<Intent, "design">, RegExp> = {
  price: /(gi[aá](?![\p{L}\p{N}])|bao nhi[eê]u|bn(?![\p{L}\p{N}])|mấy (đô|chục)|price|how much|cost|\$\s?\d|rate(?![\p{L}\p{N}])|charge)/iu,
  booking: /(l[iị]ch|đặt|dat lich|hẹn|hen(?![\p{L}\p{N}])|book|appointment|appt|available|availability|slot|còn trống|mấy giờ (được|làm)|hôm nay|ngày mai|cuối tuần|today|tomorrow|this week|weekend|walk[- ]?in)/iu,
  location: /(ở đâu|o dau|địa chỉ|dia chi|chỗ nào|tiệm nằm|where|address|location|located|parking|đậu xe)/iu,
  hours: /(giờ mở|mở cửa|đóng cửa|mấy giờ (mở|đóng)|open(ing)? hours|what time.*(open|close)|are you open|hours)/iu,
  thanks: /(cảm ơn|cam on|cám ơn|thank|thx|tks|ty(?![\p{L}\p{N}]))/iu,
  greeting: /^(hi|hello|hey|chào|chao|xin chào|alo|dạ chào)(?![\p{L}\p{N}])/iu,
};

/** Ý của 1 tin nhắn khách (có thể nhiều ý: "giá bao nhiêu, mai còn lịch không"). Ảnh → khách gửi mẫu / ảnh tay. */
export function detectIntents(text: string, type = "TEXT"): Intent[] {
  if (type === "IMAGE") return ["design"];
  const t = (text || "").trim();
  if (!t) return [];
  const out = (Object.keys(RX) as (keyof typeof RX)[]).filter((k) => RX[k].test(t)) as Intent[];
  if (/(mẫu này|mau nay|làm được (không|ko)|this (design|look|set)|can you do)/iu.test(t)) out.unshift("design");
  return [...new Set(out)];
}

export interface MenuLite { name: string; priceFrom: number; priceTo: number | null }
export interface ProCtx { market: "US" | "AU"; menu: MenuLite[]; menuUrl: string; /** khách chưa nhắn chữ / không đoán được → tiếng của thợ */ fallbackVi?: boolean }
export interface Suggestion { label: string; text: string; action?: "studio" | "consult" }

const money = (n: number, market: "US" | "AU") => `${market === "AU" ? "A$" : "$"}${Math.round(n)}`;
const range = (m: MenuLite, market: "US" | "AU") => (m.priceTo && m.priceTo > m.priceFrom ? `${money(m.priceFrom, market)}–${Math.round(m.priceTo)}` : `${money(m.priceFrom, market)}`);

/**
 * Gợi ý trả lời cho THỢ / TIỆM dựa trên tin mới nhất của khách (null: chưa có tin — gợi ý câu chào mở đầu).
 * Tối đa 3 gợi ý, ý chính của tin khách lên trước; ảnh khách gửi → kèm nút Tạo mẫu trên tay / Soi tay tư vấn.
 */
export function proSuggestions(last: { content: string; type: string } | null, ctx: ProCtx): Suggestion[] {
  const fb = ctx.fallbackVi ?? true;
  const vi = !last || last.type !== "TEXT" ? fb : replyInVietnamese(last.content, fb);
  const T = (v: string, e: string) => (vi ? v : e);
  const items = ctx.menu.filter((m) => m.priceFrom > 0).slice(0, 3);
  const priceLine = items.length ? items.map((m) => `${m.name} ${range(m, ctx.market)}`).join(", ") : "";
  const out: Suggestion[] = [];
  const add = (s: Suggestion) => { if (!out.some((o) => o.text === s.text) && out.length < 3) out.push(s); };
  const intents = last ? detectIntents(last.content, last.type) : [];
  for (const it of intents) {
    switch (it) {
      case "design":
        add({ label: T("✨ Vẽ thử mẫu lên tay khách", "✨ Try it on their hand"), text: T("Mẫu xinh quá ạ 😍 Em làm được mẫu này nha. Để em vẽ thử lên tay chị/anh cho mình xem trước nhé!", "Love this look 😍 I can do it! Let me show you how it looks on your own hand first."), action: "studio" });
        add({ label: T("🔍 Soi tay tư vấn", "🔍 Hand consult"), text: T("Em xem kỹ tay chị/anh rồi tư vấn dáng + màu hợp nhất nha.", "Let me check your nails and suggest the best shape and colours."), action: "consult" });
        if (priceLine) add({ label: T("💲 Báo giá theo menu", "💲 Quote from menu"), text: T(`Dạ mẫu kiểu này bên em khoảng: ${priceLine}. Em báo giá chính xác khi xem kỹ mẫu ạ.`, `For this kind of set: ${priceLine}. I'll confirm the exact price once I see the details.`) });
        break;
      case "price":
        add({ label: T("💲 Gửi bảng giá", "💲 Send prices"), text: priceLine
          ? T(`Dạ giá bên em: ${priceLine}. Chị/anh gửi em ảnh mẫu mình thích, em báo giá chính xác liền ạ 💅 Menu đủ ảnh + giá: ${ctx.menuUrl}`, `Our prices: ${priceLine}. Send me a photo of the look you like and I'll give you an exact quote 💅 Full menu with photos: ${ctx.menuUrl}`)
          : T(`Dạ chị/anh gửi em ảnh mẫu mình thích, em báo giá chính xác liền ạ 💅`, `Send me a photo of the look you like and I'll give you an exact quote 💅`) });
        break;
      case "booking":
        add({ label: T("📅 Gửi link đặt lịch", "📅 Send booking link"), text: T(`Dạ còn lịch ạ! Chị/anh chọn dịch vụ + giờ ở đây cho nhanh: ${ctx.menuUrl} — em xác nhận ngay khi nhận được ạ.`, `Yes, we have openings! Pick your service and time here: ${ctx.menuUrl} — I'll confirm right away.`) });
        add({ label: T("🕐 Hỏi giờ khách muốn", "🕐 Ask preferred time"), text: T("Chị/anh muốn làm ngày nào, khoảng mấy giờ ạ? Em giữ lịch cho mình liền.", "Which day and roughly what time works for you? I'll hold the spot.") });
        break;
      case "location":
        add({ label: T("📍 Chỉ địa chỉ", "📍 Share location"), text: T("Dạ chị/anh bấm vào tên tiệm ở đầu tin nhắn để xem địa chỉ + chỉ đường nha. Cần em gửi thêm gì cứ nhắn ạ.", "Tap our name at the top of the chat to see the address and directions. Let me know if you need anything else!") });
        break;
      case "hours":
        add({ label: T("🕐 Trả lời giờ", "🕐 Answer hours"), text: T("Chị/anh muốn ghé khoảng mấy giờ ạ? Em kiểm tra lịch rồi báo mình ngay.", "What time were you hoping to come in? I'll check and get right back to you.") });
        break;
      case "thanks":
        add({ label: T("❤️ Cảm ơn", "❤️ Thank you"), text: T("Dạ em cảm ơn chị/anh nhiều ạ ❤️ Hẹn gặp mình ở tiệm nha!", "Thank you so much ❤️ See you at the salon!") });
        break;
      case "greeting":
        add({ label: T("👋 Chào khách", "👋 Greet"), text: T("Dạ chào chị/anh ạ! Mình muốn làm mẫu gì? Gửi em ảnh tay hoặc ảnh mẫu, em tư vấn + báo giá liền nha 💅", "Hi there! What look are you after? Send me a photo of your nails or the design, and I'll suggest and quote right away 💅") });
        break;
    }
  }
  // luôn có 1 lối đi tiếp: chưa rõ ý → mời gửi ảnh + menu; đã trả lời giá / lịch → thêm câu còn lại
  if (!out.length) add({ label: T("👋 Mời gửi ảnh mẫu", "👋 Ask for a photo"), text: T("Dạ chào chị/anh ạ! Mình muốn làm mẫu gì? Gửi em ảnh tay hoặc ảnh mẫu, em tư vấn + báo giá liền nha 💅", "Hi there! What look are you after? Send me a photo of your nails or the design, and I'll suggest and quote right away 💅") });
  if (!intents.includes("booking")) add({ label: T("📅 Gửi link đặt lịch", "📅 Send booking link"), text: T(`Chị/anh đặt lịch ở đây cho nhanh nha: ${ctx.menuUrl} — chọn dịch vụ + giờ, em xác nhận ngay ạ.`, `You can book here: ${ctx.menuUrl} — pick a service and time, I'll confirm right away.`) });
  if (!intents.includes("price") && priceLine) add({ label: T("💲 Gửi bảng giá", "💲 Send prices"), text: T(`Dạ giá bên em: ${priceLine}. Menu đủ ảnh + giá: ${ctx.menuUrl}`, `Our prices: ${priceLine}. Full menu with photos: ${ctx.menuUrl}`) });
  return out;
}

// ---------------- TUYỂN THỢ: chủ tiệm ↔ thợ (lõi PawNail Jobs) ----------------
// Cùng nguyên tắc: hiểu tin đối phương CHƯA trả lời → 1–3 câu trả lời; số liệu (lương, chia turn, chỗ ở, kỹ năng,
// khu vực) lấy THẬT từ tin tuyển / hồ sơ của chính người trả lời. Không có số liệu → hỏi lại / hẹn trao đổi, không bịa.

export type HireIntent = "pay" | "housing" | "turn" | "hiring" | "trial" | "skills" | "location" | "thanks" | "greeting";

const HRX: Record<Exclude<HireIntent, "location" | "thanks" | "greeting">, RegExp> = {
  pay: /(lương|luong|ăn chia|an chia|bao lương|chia (mấy|may|bao nhiêu)|pay(?![\p{L}])|salary|wage|commission|per week|weekly|\$\s?\d)/iu,
  housing: /(chỗ ở|cho o(?![\p{L}\p{N}])|nhà ở|nha o(?![\p{L}\p{N}])|bao ăn ở|ở lại tiệm|housing|accommodation|place to stay)/iu,
  turn: /(turn|walk[- ]?in|khách (đông|vãng lai|quen|sang)|tip(?![\p{L}]))/iu,
  hiring: /(tuyển|tuyen|cần thợ|can tho(?![\p{L}])|còn (nhận|cần|tuyển)|con (nhan|can|tuyen)|nhận việc|nhan viec|tìm việc|tim viec|hiring|job(?![\p{L}])|position|looking for work|still need)/iu,
  trial: /(thử tay nghề|thu tay nghe|ghé (tiệm|thử|qua)|ghe tiem|qua tiệm|phỏng vấn|phong van|làm thử|lam thu|interview|trial|come by|stop by|bắt đầu (làm|đi làm)|khi nào (đi làm|làm được|ghé))/iu,
  skills: /(làm được|lam duoc|biết làm|biet lam|bột|dip(?![\p{L}])|sns|gel-?x|vẽ|chân tay nước|pedicure|acrylic|can you do)/iu,
};

export function detectHireIntents(text: string, type = "TEXT"): HireIntent[] {
  const t = (text || "").trim();
  if (type !== "TEXT" || !t) return [];
  const out = (Object.keys(HRX) as (keyof typeof HRX)[]).filter((k) => HRX[k].test(t)) as HireIntent[];
  if (RX.location.test(t)) out.push("location");
  if (RX.thanks.test(t)) out.push("thanks");
  if (RX.greeting.test(t)) out.push("greeting");
  return out;
}

export interface HireJobLite { title: string; salaryType?: string | null; salaryAmount?: string | null; benefits?: string | null }
export interface HireCtx {
  side: "owner" | "tech";
  /** khu vực của người trả lời (hồ sơ) */
  city?: string | null; state?: string | null;
  /** chủ tiệm: tin tuyển MỚI NHẤT + chính sách tiệm */
  job?: HireJobLite | null; turn?: string | null; housing?: boolean;
  /** thợ: kỹ năng + số năm + link hồ sơ (ảnh tay nghề) */
  skills?: string[]; years?: number; profileUrl?: string;
  fallbackVi?: boolean;
}

/** Gợi ý trả lời trong chat TUYỂN THỢ (chủ tiệm trả lời thợ, hoặc thợ trả lời chủ tiệm). */
export function hireSuggestions(last: { content: string; type: string } | null, ctx: HireCtx): Suggestion[] {
  const fb = ctx.fallbackVi ?? true;
  const vi = !last || last.type !== "TEXT" ? fb : replyInVietnamese(last.content, fb);
  const T = (v: string, e: string) => (vi ? v : e);
  const out: Suggestion[] = [];
  const add = (s: Suggestion | null) => { if (s && !out.some((o) => o.text === s.text) && out.length < 3) out.push(s); };
  const intents = last ? detectHireIntents(last.content, last.type) : [];
  const place = [ctx.city, ctx.state].filter(Boolean).join(", ");

  if (ctx.side === "owner") {
    // trả lời tiếng Anh → tên tin / lương / kỹ năng do app sinh ra dịch theo bảng dataEn ("Cần thợ Bột gấp", "$1,300/tuần"…)
    const en = (x: string) => (vi ? x : dtEn(x));
    const job = ctx.job ? { ...ctx.job, title: en(ctx.job.title) } : null;
    const pay = job && (job.salaryAmount || job.salaryType) ? [job.salaryType, job.salaryAmount].filter((x): x is string => !!x).map(en).join(" ") : "";
    const housing = !!ctx.housing || /chỗ ở|housing/i.test(job?.benefits || "");
    const askSkills = { label: T("🧰 Hỏi tay nghề", "🧰 Ask skills"), text: T("Bạn làm được những món nào (Bột / Dip / Gel-X / vẽ…), đang ở khu nào ạ? Gửi tiệm vài ảnh tay nghề nha.", "Which services can you do (acrylic / dip / Gel-X / art…), and where are you based? Please send a few photos of your work.") };
    const invite = { label: T("📅 Hẹn thử tay nghề", "📅 Invite for a trial"), text: T(`Bạn ghé tiệm thử tay nghề được hôm nào ạ?${place ? ` Tiệm ở ${place},` : ""} hẹn giờ xong tiệm gửi địa chỉ cụ thể nha.`, `When could you come in for a skills trial?${place ? ` We're in ${place} —` : ""} I'll send the exact address once we set a time.`) };
    for (const it of intents) {
      if (it === "pay") add({ label: T("💵 Trả lời lương", "💵 Answer pay"), text: pay ? T(`Dạ lương bên tiệm: ${pay}${ctx.turn ? ` · chia turn ${ctx.turn}` : ""}. Bạn làm được những món nào để tiệm sắp xếp ạ?`, `Pay at our salon: ${pay}${ctx.turn ? ` · turn split ${ctx.turn}` : ""}. Which services can you do?`) : T("Lương tuỳ tay nghề + món làm được ạ. Bạn gửi tiệm vài ảnh tay nghề, tiệm báo lương cụ thể nha.", "Pay depends on skills and services. Send me a few photos of your work and I'll give you exact numbers.") });
      if (it === "housing") add(housing ? { label: T("🏠 Có chỗ ở", "🏠 Housing: yes"), text: T("Dạ tiệm có hỗ trợ chỗ ở cho thợ ở xa nha.", "Yes, we help with housing for techs moving from out of town.") } : { label: T("🏠 Trả lời chỗ ở", "🏠 Answer housing"), text: T("Về chỗ ở, tiệm trao đổi cụ thể khi bạn ghé nha.", "We can talk about housing in person when you come by.") });
      if (it === "turn" && ctx.turn) add({ label: T("🔄 Chia turn", "🔄 Turn split"), text: T(`Dạ tiệm chia turn: ${ctx.turn}.`, `Our turn split: ${ctx.turn}.`) });
      if (it === "hiring") add({ label: T("✅ Còn tuyển", "✅ Still hiring"), text: T(`Dạ tiệm vẫn đang tuyển ạ${job ? `: ${job.title}` : ""}${pay ? ` — ${pay}` : ""}. Bạn làm được những món nào, đang ở khu nào ạ?`, `Yes, we're still hiring${job ? ` (${job.title})` : ""}${pay ? ` — ${pay}` : ""}. Which services can you do, and where are you based?`) });
      if (it === "trial") add(invite);
      if (it === "skills") add({ label: T("👍 Mời gửi ảnh tay nghề", "👍 Ask for photos"), text: T("Tốt quá! Bạn gửi tiệm vài ảnh tay nghề nha, rồi mình hẹn ghé thử tay nghề.", "Great! Send me a few photos of your work and let's set up a skills trial.") });
      if (it === "location") add({ label: T("📍 Khu vực tiệm", "📍 Salon area"), text: place ? T(`Tiệm ở ${place} ạ. Bạn đang ở khu nào?`, `We're in ${place}. Where are you based?`) : T("Bạn đang ở khu nào ạ? Tiệm gửi địa chỉ cụ thể khi hẹn giờ ghé nha.", "Where are you based? I'll send the exact address when we set a time.") });
      if (it === "thanks") add({ label: T("❤️ Cảm ơn", "❤️ Thank you"), text: T("Cảm ơn bạn nha! Có gì cứ nhắn tiệm.", "Thank you! Message me anytime.") });
      if (it === "greeting" && !intents.includes("hiring")) add({ label: T("👋 Chào thợ", "👋 Greet"), text: T(`Chào bạn! Tiệm đang cần thợ${pay ? ` — ${pay}` : ""}. Bạn làm được những món nào, đang ở khu nào ạ?`, `Hi! We're hiring${pay ? ` — ${pay}` : ""}. Which services can you do, and where are you based?`) });
    }
    add(askSkills);
    add(invite);
    return out;
  }

  // thợ trả lời chủ tiệm
  const skills = (ctx.skills ?? []).filter(Boolean).slice(0, 5).map((x) => (vi ? x : dtEn(x))).join(", ");
  const exp = ctx.years && ctx.years > 0 ? T(`, ${ctx.years} năm kinh nghiệm`, `, ${ctx.years} ${ctx.years === 1 ? "year's" : "years'"} experience`) : "";
  const link = ctx.profileUrl ? T(` Ảnh tay nghề của em: ${ctx.profileUrl}`, ` My work photos: ${ctx.profileUrl}`) : "";
  const intro = { label: T("🙋 Giới thiệu bản thân", "🙋 Introduce myself"), text: T(`Dạ em còn nhận việc ạ! Em làm được ${skills || "các món cơ bản"}${exp}${place ? `, đang ở ${place}` : ""}.${link}`, `Yes, I'm available! I can do ${skills || "the basics"}${exp}${place ? `, based in ${place}` : ""}.${link}`) };
  const askTerms = { label: T("❓ Hỏi lương / turn / chỗ ở", "❓ Ask pay / turns / housing"), text: T("Cho em hỏi lương tính bao lương hay ăn chia, chia turn sao và tiệm có hỗ trợ chỗ ở không ạ?", "Could you tell me the pay (salary or commission), how turns are split, and whether you help with housing?") };
  const hasNumber = !!last && /\d/.test(last.content);
  for (const it of intents) {
    if (it === "hiring" || it === "greeting") add(intro);
    if (it === "skills") add({ label: T("💅 Trả lời tay nghề", "💅 Answer skills"), text: T(`Dạ em làm được ${skills || "ạ"}${exp}.${link}`, `I can do ${skills || "that"}${exp}.${link}`) });
    if (it === "trial") add({ label: T("📅 Nhận lời ghé thử", "📅 Accept trial"), text: T("Dạ em ghé được ạ! Anh/chị cho em xin địa chỉ tiệm + giờ tiện nhất nha.", "Sure, I can come by! Please send me the address and the best time.") });
    if (it === "pay") add(hasNumber ? { label: T("👌 Đồng ý mức lương", "👌 Pay works"), text: T("Dạ mức đó em thấy ổn ạ. Khi nào em ghé thử tay nghề được ạ?", "That works for me. When can I come in for a trial?") } : askTerms);
    if (it === "housing" || it === "turn") add(askTerms);
    if (it === "location") add({ label: T("📍 Khu vực của em", "📍 My area"), text: place ? T(`Dạ em đang ở ${place} ạ. Tiệm mình ở khu nào ạ?`, `I'm in ${place}. Where's the salon?`) : T("Tiệm mình ở khu nào ạ?", "Where's the salon located?") });
    if (it === "thanks") add({ label: T("❤️ Cảm ơn", "❤️ Thank you"), text: T("Dạ em cảm ơn anh/chị ạ!", "Thank you!") });
  }
  add(intro);
  add(askTerms);
  return out;
}

/** Câu mở đầu gợi ý khi cuộc trò chuyện còn trống — theo ĐÚNG cặp vai trò (khách hỏi tiệm khác hẳn thợ hỏi việc). */
export function starters(me: string | null | undefined, partner: string | null | undefined, tr: (vi: string, en: string) => string): string[] {
  const pro = (r?: string | null) => r === "TECHNICIAN" || r === "OWNER";
  if (me === "CLIENT" && pro(partner)) return [tr("Chào tiệm, em muốn làm móng — tuần này còn lịch không ạ?", "Hi! I'd like to book a nail appointment — any openings this week?"), tr("Mẫu như ảnh này giá bao nhiêu ạ?", "How much would a set like this cost?"), tr("Tiệm có làm Gel-X / bột không ạ?", "Do you do Gel-X or acrylic?")];
  if (pro(me) && partner === "CLIENT") return [tr("Chào chị/anh! Mình muốn làm mẫu gì ạ? Gửi em ảnh tay hoặc ảnh mẫu, em tư vấn + báo giá nha.", "Hi! What look are you after? Send me a photo and I'll suggest and quote."), tr("Chị/anh muốn đặt lịch ngày nào ạ?", "Which day would you like to come in?")];
  if (me === "OWNER") return [tr("Chào bạn, tiệm mình đang cần thợ, bạn còn nhận việc không?", "Hi! Our salon is hiring — are you still taking work?"), tr("Bạn làm được Bột/Dip/Gel-X không?", "Can you do acrylic/dip/Gel-X?"), tr("Khi nào bạn có thể ghé tiệm thử tay nghề?", "When can you come by for a skills trial?")];
  if (me === "CLIENT") return [tr("Chào bạn!", "Hi there!")];
  return [tr("Chào anh/chị, tiệm còn tuyển thợ không ạ?", "Hi, is the salon still hiring?"), tr("Cho em hỏi lương và cách chia turn ạ?", "What's the pay and how are turns split?"), tr("Tiệm có hỗ trợ chỗ ở không ạ?", "Does the salon help with housing?")];
}
