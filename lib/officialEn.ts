// BẢN TIẾNG ANH cho bài của TÀI KHOẢN CHÍNH THỨC (bot nội dung, bộ mẫu, điểm tin việc, chủ đề nóng, tin ngành).
// Trước đây mọi bài chính thức chỉ có tiếng Việt → người dùng EN (chủ tiệm / thợ / khách Mỹ-Úc) thấy bảng tin
// không đọc được ("feed chết"). Quy ước lưu: phần tiếng Việt + EN_MARK + phần tiếng Anh trong CÙNG cột content
// (không đổi schema → không cần migration trên Turso). Chỉ tách cho bài của tài khoản ADMIN.
// Bài cũ (đã đăng trước quy ước này) được dựng lại bản EN từ khuôn mẫu khi nhận ra được (bộ mẫu, điểm tin việc,
// chủ đề nóng); còn lại người dùng bấm "Xem bản dịch" (AI, /api/posts/[id]/translate).
import { dtEn } from "@/lib/i18n/dataEn";

import { EN_MARK, joinEn, splitEn } from "@/lib/enMark";
export { EN_MARK, joinEn, splitEn };

// ---------- Bộ mẫu nail hôm nay (lib/designGallery.ts) ----------
export const GALLERY_HEAD_EN = {
  easy: "✨ 4 easy nail looks with clean, even results — great for newer techs 🌱",
  yearRound: "✨ 4 year-round nail looks that suit every client 💗",
  today: "✨ 4 nail looks worth trying today",
} as const;
export const GALLERY_ASK_EN = {
  easy: "Which one can you do in under 45 minutes? Share a real photo so newer techs can learn 💅",
  other: "Which number is your favourite? Post a real photo of your work when you try one 💅",
};
export function galleryEn(head: string, titlesEn: string[], siteUrl: string, ask: string): string {
  return [
    head,
    "",
    ...titlesEn.map((t, i) => `${i + 1}. ${t}`),
    "",
    `👉 Every look comes with supplies, steps and a suggested price: ${siteUrl}/designs`,
    ask,
    "",
    "AI illustrations · #NailDesigns #PawNail",
  ].join("\n");
}

// ---------- Điểm tin việc theo bang (lib/jobDigestPost.ts) ----------
export function digestLineEn(j: { salonName: string; city?: string | null; skills?: string; salary: string; urgent?: boolean }): string {
  return `• ${j.salonName}${j.city ? ` — ${j.city}` : ""}${j.skills ? `: needs ${j.skills}` : ""} · ${dtEn(j.salary)}${j.urgent ? " · 🔥 urgent" : ""}`;
}
export function digestEn(name: string, total: number, urgent: number, lines: string[], more: number, siteUrl: string): string {
  return [
    `📍 ${name}: ${total} salon${total === 1 ? "" : "s"} hiring this week${urgent ? ` (${urgent} urgent)` : ""}`,
    "",
    ...lines,
    ...(more > 0 ? [`• …and ${more} more salon${more === 1 ? "" : "s"}`] : []),
    "",
    `👉 Call salons directly, no middleman: ${siteUrl}/?tab=jobs`,
    "🔔 Turn on urgent-job alerts so you never miss a salon near you.",
    "",
    `#NailJobs #NailTech #${name.replace(/\s+/g, "")}`,
  ].join("\n");
}

// Kỹ năng trong điểm tin việc (nhãn tiếng Việt của bảng việc → tiếng Anh)
const SKILL_EN: Record<string, string> = {
  "Bột/Acrylic": "Acrylic", "Chân tay nước": "Mani-pedi", "Mi/Lông mày": "Lashes/Brows", "Vẽ móng": "Nail art", "Thiết kế": "Design",
  "Tay chân nước": "Mani-pedi", "Bột": "Acrylic", "Sơn gel": "Gel polish", "Nối mi": "Lash extensions", "Waxing": "Waxing",
};
const skillEn = (s: string) => SKILL_EN[s.trim()] ?? dtEn(s.trim());

// ---------- Chủ đề nóng có thăm dò (lib/hotTopics.ts) — bản EN viết tay, cùng ý, không thêm số liệu ----------
export const HOT_TOPIC_EN: Record<string, { text: string; question: string; options: string[] }> = {
  turn: {
    text: "💬 The never-ending question: HOW TURNS ARE SPLIT.\n\nSome salons rotate evenly, some go by service value, some let the owner decide — and plenty of techs feel they lose turns without knowing how to bring it up.\n\nHow does your salon do it? Which way feels fairest to you? Vote below and tell us how it works where you are 👇",
    question: "How does your salon split turns?", options: ["Rotation in order", "By service value", "Owner decides", "Client picks the tech"],
  },
  "tip-card": {
    text: "💬 Card tips — how does your salon pay them out?\n\nSome salons pay the full amount in cash at the end of the day, some take out the card fee, some add it to the paycheck. There's no single \"right\" way for every salon, but agreeing on it up front saves a lot of bad feeling.\n\nVote and share how your salon does it so others can compare 👇\n\n📝 Tip: log your tips every day under \"Income & tips\" in the app so the weekly check is easy.",
    question: "Card tips — how does your salon pay techs?", options: ["In full, in cash", "Minus the card fee", "Added to the paycheck", "Not clear"],
  },
  "pay-model": {
    text: "💬 Guaranteed pay or commission — which side are you on?\n\nGuaranteed pay is safer in slow months; commission pays more when the salon is busy. Everyone's situation is different: just arrived, supporting a family, or saving up to open your own salon…\n\nHow are you paid and why? Vote and tell us 👇",
    question: "Which do you prefer?", options: ["Guaranteed pay", "60/40 commission", "70/30 commission", "Depends on salon & season"],
  },
  "1099": {
    text: "💬 Tax season is coming — are you paid on a 1099 or a W-2?\n\nMany techs still aren't sure what the difference is: on a 1099 you handle your own taxes (possibly quarterly), on a W-2 the salon withholds for you. Not receiving any paperwork doesn't mean you don't have to file.\n\nVote so everyone can see how it looks out there, and leave a comment if you have questions 👇\n\nℹ️ General information, not tax advice — ask a CPA about your own situation.",
    question: "What tax paperwork do you get this year?", options: ["1099", "W-2", "Nothing", "Not sure"],
  },
  "no-pay": {
    text: "💬 Clients who book and don't show, or finish and walk out without paying… anyone who's been in the trade a while has probably had it happen at least once.\n\nDoes your salon have a way to prevent it? A deposit, holding a card, or just letting it go?\n\nVote and share what works so others can learn 👇",
    question: "Late cancellations / walk-outs — what does your salon do?", options: ["Take a deposit", "Hold a card at booking", "Let it go", "Don't rebook that client"],
  },
  notice: {
    text: "💬 Owner and tech parting ways — how to do it right?\n\nWhen a tech quits on the spot the salon is stuck with clients; when an owner lets someone go suddenly the tech is stuck with rent. How much notice is fair for both sides?\n\nVote and share your story (no need to name the salon) 👇",
    question: "Quitting / letting someone go — how much notice?", options: ["1 week", "2 weeks", "1 month", "No notice needed"],
  },
  price: {
    text: "💬 What does an acrylic full set cost in your area?\n\nSupplies cost more, rent costs more — but raising prices risks losing clients. Let's see how prices look in each area so everyone can compare.\n\nVote and comment your state / city 👇",
    question: "Acrylic full set price in your area?", options: ["Under $40", "$40–55", "$55–70", "Over $70"],
  },
  days: {
    text: "💬 How many days a week is right for nail work?\n\nSome work 7 days to earn more, some keep 1–2 days off for their health and family. Your back, wrists and eyes all have limits.\n\nHow many days do you work? Vote and share how you keep your energy up 👇",
    question: "How many days a week do you work?", options: ["5 days", "6 days", "7 days", "Depends on the schedule"],
  },
  health: {
    text: "💬 Acrylic dust and acetone fumes every day — how do you protect yourself?\n\nWe breathe in more dust and chemicals than we think. A mask, a table extractor, better ventilation… every little bit counts.\n\nVote and recommend the gear you think is worth the money 👇",
    question: "At your station, what do you use against dust / fumes?", options: ["Regular mask", "N95 mask", "Table dust extractor", "Nothing yet"],
  },
  review: {
    text: "💬 An unfair 1-star review on Google/Yelp — how do you handle it well?\n\nReplying publicly can escalate, staying silent makes readers think the salon was wrong. What do you usually do?\n\nVote and share a reply template you like to use 👇",
    question: "An unfair 1-star review — what do you do?", options: ["Reply politely", "Message the client privately", "Ignore it", "Ask regulars to review"],
  },
  license: {
    text: "💬 How was your nail license journey?\n\nEvery state has its own rules: training hours, written exam, practical exam… This is usually the most confusing step for newcomers.\n\nVote for your state and leave one piece of advice for someone just starting 👇",
    question: "Which state did you get your nail license in?", options: ["Texas", "California", "Florida", "Another state"],
  },
  hiring: {
    text: "💬 Salon owners — how hard is hiring right now?\n\nSome salons post for a whole week with no calls; some techs come for a one-day trial and leave. Techs say they want to know pay, housing and how turns work before they come.\n\nVote and share: what in your job post gets the most calls? 👇\n\n👉 Post a job for free on PawNail: bitpawos.com/jobs/create",
    question: "Owners: how hard is hiring right now?", options: ["Very hard", "Somewhat hard", "Normal", "Easy"],
  },
};

// ---------- Dựng lại bản EN cho bài CŨ (trước quy ước EN_MARK) ----------
const GALLERY_RE = /^✨ 4 mẫu nail (dễ làm, lên đều tay|quanh năm, khách nào cũng hợp|đáng thử hôm nay)(?: — có mẫu (.+?) (\S+))?/u;
const DIGEST_HEAD_RE = /^📍 (.+?): (\d+) tiệm đang cần thợ tuần này(?: \((\d+) tin gấp\))?$/u;
const DIGEST_LINE_RE = /^• (.+?)(?: — ([^:·]+?))?(?:: cần ([^·]+?))? · (.+?)( · 🔥 gấp)?$/u;
const URL_RE = /(https?:\/\/[^\s]+?)(?:\/designs|\/\?tab=jobs)\b/;

export interface EnCtx {
  /** tên mẫu tiếng Việt → tiếng Anh (bảng NailDesign.title → titleEn) */
  designTitleEn?: Map<string, string>;
}

/** Tên mẫu tiếng Việt cần tra (bài bộ mẫu cũ). */
export function galleryTitles(content: string): string[] {
  if (!GALLERY_RE.test(content)) return [];
  return content.split("\n").map((l) => l.match(/^\d\. (.+)$/)?.[1]).filter((x): x is string => !!x);
}

export function deriveEn(vi: string, ctx: EnCtx = {}): string | null {
  const lines = vi.split("\n");
  const first = lines[0].trim();
  // Chủ đề nóng
  const hotKey = HOT_FIRST_VI.get(first);
  if (hotKey && HOT_TOPIC_EN[hotKey]) return HOT_TOPIC_EN[hotKey].text;
  // Bộ mẫu
  const g = first.match(GALLERY_RE);
  if (g) {
    const site = vi.match(URL_RE)?.[1] ?? "https://www.bitpawos.com";
    const titles = galleryTitles(vi);
    if (!titles.length) return null;
    const en = titles.map((t) => ctx.designTitleEn?.get(t) || dtEn(t));
    if (en.some((t, i) => t === titles[i] && /[^\x00-\x7F]/.test(t))) return null; // còn tên mẫu chưa có bản EN
    const head = g[1].startsWith("dễ") ? GALLERY_HEAD_EN.easy : g[1].startsWith("quanh") ? GALLERY_HEAD_EN.yearRound : GALLERY_HEAD_EN.today + (g[2] ? ` — including ${dtEn(g[2])} ${g[3]}` : "");
    return galleryEn(head, en, site, g[1].startsWith("dễ") ? GALLERY_ASK_EN.easy : GALLERY_ASK_EN.other);
  }
  // Điểm tin việc
  const d = first.match(DIGEST_HEAD_RE);
  if (d) {
    const site = vi.match(URL_RE)?.[1] ?? "https://www.bitpawos.com";
    const out: string[] = [];
    let more = 0;
    for (const l of lines.slice(1)) {
      const m = l.match(/^• …và (\d+) tiệm khác$/u);
      if (m) { more = Number(m[1]); continue; }
      const j = l.match(DIGEST_LINE_RE);
      if (!j) continue;
      const skills = j[3] ? j[3].split(",").map(skillEn).join(", ") : "";
      out.push(digestLineEn({ salonName: j[1], city: j[2], skills, salary: j[4].trim(), urgent: !!j[5] }));
    }
    if (!out.length) return null;
    return digestEn(d[1], Number(d[2]), Number(d[3] || 0), out, more, site);
  }
  return null;
}

// Khoá đối chiếu bài CŨ: dòng đầu + câu hỏi tiếng Việt ĐÚNG như đã đăng (giữ nguyên kể cả khi lib/hotTopics đổi chữ,
// vì bài đã nằm trong DB với chữ cũ). Không dịch các chuỗi này.
const HOT_VI: Record<string, [string, string]> = {
  "turn": ["💬 Chuyện muôn thuở: CHIA TURN.", "Tiệm bạn chia turn kiểu nào?"],
  "tip-card": ["💬 Tip khách quẹt thẻ — tiệm bạn trả thợ ra sao?", "Tip quẹt thẻ, tiệm bạn trả thợ thế nào?"],
  "pay-model": ["💬 Bao lương hay ăn chia — bạn chọn bên nào?", "Bạn thích làm kiểu nào hơn?"],
  "1099": ["💬 Mùa thuế sắp tới — bạn đang được trả theo 1099 hay W-2?", "Năm nay bạn nhận giấy tờ thuế kiểu nào?"],
  "no-pay": ["💬 Khách đặt lịch rồi không tới, hoặc làm xong chê rồi bỏ về không trả… ai làm nghề lâu chắc cũng gặp ít nhất một lần.", "Khách huỷ hẹn sát giờ / bỏ về không trả — tiệm bạn làm gì?"],
  "notice": ["💬 Chủ – thợ chia tay sao cho đẹp?", "Thợ nghỉ việc / chủ cho nghỉ — nên báo trước bao lâu?"],
  "price": ["💬 Giá full set bột ở khu bạn đang bao nhiêu?", "Giá full set bột ở khu bạn khoảng bao nhiêu?"],
  "days": ["💬 Làm nail mấy ngày một tuần là vừa?", "Bạn đang làm mấy ngày một tuần?"],
  "health": ["💬 Bụi bột, mùi acetone mỗi ngày — bạn bảo vệ mình thế nào?", "Ở bàn làm, bạn đang dùng gì để đỡ bụi / mùi?"],
  "review": ["💬 Review 1 sao vô lý trên Google/Yelp — xử lý sao cho khéo?", "Gặp review 1 sao vô lý, bạn làm gì?"],
  "license": ["💬 Hành trình thi license nail của bạn thế nào?", "Bạn thi license nail ở bang nào?"],
  "hiring": ["💬 Chủ tiệm ơi, tuyển thợ dạo này khó cỡ nào?", "Chủ tiệm: tuyển thợ bây giờ khó cỡ nào?"],
};
const HOT_FIRST_VI = new Map(Object.entries(HOT_VI).map(([k, [first]]) => [first, k]));
const POLL_EN = new Map(Object.entries(HOT_VI).map(([k, [, q]]) => [q, { question: HOT_TOPIC_EN[k].question, options: HOT_TOPIC_EN[k].options }]));
/** Bản EN của câu hỏi + lựa chọn thăm dò (chủ đề nóng): khớp theo câu hỏi tiếng Việt. */
export const pollEn = (question: string) => POLL_EN.get(question) ?? null;
