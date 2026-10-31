// "CHỦ ĐỀ NÓNG" — bài MỞ THẢO LUẬN + thăm dò 1 chạm, đăng từ TÀI KHOẢN CHÍNH THỨC.
//   - Tool chỉ gửi TÍN HIỆU chủ đề đang sôi (từ khoá + số like/comment) qua /api/content/topics —
//     KHÔNG gửi nội dung bài hay tên người. PawNail chấm điểm → chọn chủ đề nóng nhất chưa đăng gần đây.
//   - Bài do PawNail tự viết (câu hỏi thật, không bịa số liệu, không giả danh ai). Người thật vào bình luận/bình chọn.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { savePostEn } from "@/lib/postEn";

export interface HotTopic { key: string; match: RegExp; text: string; question: string; options: string[] }

export const TOPIC_BANK: HotTopic[] = [
  { key: "turn", match: /turn|chia khách|xoay vòng|lượt khách/i, question: "Tiệm bạn chia turn kiểu nào?", options: ["Xoay vòng theo thứ tự", "Tính theo tiền dịch vụ", "Chủ tiệm tự chia", "Khách chọn thợ"],
    text: "💬 Chuyện muôn thuở: chia turn.\n\nCó tiệm xoay vòng đều, có tiệm tính theo tiền dịch vụ, có tiệm để chủ chia — và cũng không ít thợ thấy mình bị “ăn turn” mà không biết nói sao.\n\nỞ tiệm bạn chia thế nào? Kiểu nào bạn thấy công bằng nhất? Bình chọn bên dưới rồi kể cách tiệm bạn làm nhé 👇" },
  { key: "tip-card", match: /tip.*(thẻ|card)|quẹt thẻ|phí thẻ|tip cash|tiền tip/i, question: "Tip quẹt thẻ, tiệm bạn trả thợ thế nào?", options: ["Trả đủ, tiền mặt", "Trừ phí thẻ", "Gộp vào check", "Chưa rõ ràng"],
    text: "💬 Tip khách quẹt thẻ — tiệm bạn trả thợ ra sao?\n\nCó tiệm trả đủ bằng tiền mặt cuối ngày, có tiệm trừ phí thẻ, có tiệm gộp vào check. Không có cách nào là “chuẩn” cho mọi tiệm, nhưng rõ ràng ngay từ đầu thì đỡ mất lòng nhau.\n\nBình chọn + chia sẻ cách tiệm bạn làm để mọi người tham khảo nha 👇\n\n📝 Mẹo: ghi tip mỗi ngày ở mục “Thu nhập & tip” trong app để cuối tuần đối chiếu cho dễ." },
  { key: "pay-model", match: /bao lương|ăn chia|6\/4|7\/3|commission|lương tuần/i, question: "Bạn thích làm kiểu nào hơn?", options: ["Bao lương", "Ăn chia 6/4", "Ăn chia 7/3", "Tuỳ tiệm, tuỳ mùa"],
    text: "💬 Bao lương hay ăn chia — bạn chọn bên nào?\n\nBao lương thì chắc tay mùa vắng, ăn chia thì mùa đông khách được nhiều hơn. Mỗi người một hoàn cảnh: mới vào nghề, có gia đình, hay đang muốn tích tiền mở tiệm…\n\nBạn đang làm kiểu nào và vì sao? Bình chọn rồi kể nghe thử nhé 👇" },
  { key: "1099", match: /1099|w-?2|irs|thuế|tax/i, question: "Năm nay bạn nhận giấy tờ thuế kiểu nào?", options: ["1099", "W-2", "Không nhận gì", "Chưa biết"],
    text: "💬 Mùa thuế sắp tới — bạn đang được trả theo 1099 hay W-2?\n\nNhiều bạn thợ vẫn chưa rõ khác nhau ở đâu: 1099 thì tự lo thuế (có thể phải đóng theo quý), W-2 thì tiệm khấu trừ sẵn. Không nhận giấy tờ gì không có nghĩa là không phải khai.\n\nBình chọn cho mọi người biết tình hình nhé, có câu hỏi thì để lại bình luận 👇\n\nℹ️ Thông tin chung, không thay cho tư vấn thuế — trường hợp cụ thể hãy hỏi CPA." },
  { key: "no-pay", match: /quỵt|bỏ về|không trả|no.?show|huỷ hẹn|hủy hẹn|bùng/i, question: "Khách huỷ hẹn sát giờ / bỏ về không trả — tiệm bạn làm gì?", options: ["Lấy cọc trước", "Giữ thẻ khi đặt lịch", "Bỏ qua cho lành", "Không nhận lại khách đó"],
    text: "💬 Khách đặt lịch rồi không tới, hoặc làm xong chê rồi bỏ về không trả… ai làm nghề lâu chắc cũng gặp ít nhất một lần.\n\nTiệm bạn có cách nào phòng không? Lấy cọc, giữ thẻ, hay đành chịu cho lành?\n\nBình chọn và chia sẻ kinh nghiệm để mọi người cùng học hỏi nhé 👇" },
  { key: "notice", match: /nghỉ ngang|cho nghỉ|đuổi|báo trước|bỏ tiệm|mâu thuẫn|cãi nhau/i, question: "Thợ nghỉ việc / chủ cho nghỉ — nên báo trước bao lâu?", options: ["1 tuần", "2 tuần", "1 tháng", "Không cần báo"],
    text: "💬 Chủ – thợ chia tay sao cho đẹp?\n\nThợ nghỉ ngang thì tiệm kẹt khách, chủ cho nghỉ đột ngột thì thợ kẹt tiền nhà. Theo bạn, báo trước bao lâu là hợp lý cho cả hai bên?\n\nBình chọn + kể chuyện của bạn (không cần nêu tên tiệm) nhé 👇" },
  { key: "price", match: /giá|full set|bao nhiêu tiền|price|tăng giá/i, question: "Giá full set bột ở khu bạn khoảng bao nhiêu?", options: ["Dưới $40", "$40–55", "$55–70", "Trên $70"],
    text: "💬 Giá full set bột ở khu bạn đang bao nhiêu?\n\nVật tư lên giá, tiền thuê lên giá — nhưng tăng giá thì sợ mất khách. Cùng xem mỗi khu đang để giá thế nào để tham khảo nhé.\n\nBình chọn + bình luận bang / thành phố của bạn 👇" },
  { key: "days", match: /mấy ngày|ngày nghỉ|giờ làm|làm 7 ngày|overtime|tăng ca/i, question: "Bạn đang làm mấy ngày một tuần?", options: ["5 ngày", "6 ngày", "7 ngày", "Tuỳ lịch"],
    text: "💬 Làm nail mấy ngày một tuần là vừa?\n\nCó người làm 7 ngày để kiếm thêm, có người giữ 1–2 ngày nghỉ để lo sức khoẻ và gia đình. Lưng, cổ tay, mắt… đều có giới hạn.\n\nBạn đang làm mấy ngày? Bình chọn rồi chia sẻ cách bạn giữ sức nhé 👇" },
  { key: "health", match: /hoá chất|hóa chất|khẩu trang|bụi|ho|đau lưng|sức khoẻ|sức khỏe|mask/i, question: "Ở bàn làm, bạn đang dùng gì để đỡ bụi / mùi?", options: ["Khẩu trang thường", "Khẩu trang N95", "Máy hút bụi tại bàn", "Chưa dùng gì"],
    text: "💬 Bụi bột, mùi acetone mỗi ngày — bạn bảo vệ mình thế nào?\n\nNghề mình hít bụi và hoá chất nhiều hơn mình nghĩ. Khẩu trang, máy hút tại bàn, mở thông gió… mỗi thứ một chút đều đáng.\n\nBình chọn + gợi ý món đồ bạn thấy đáng tiền nhé 👇" },
  { key: "review", match: /review|1 sao|một sao|google|yelp|chê/i, question: "Gặp review 1 sao vô lý, bạn làm gì?", options: ["Trả lời lịch sự", "Nhắn riêng khách", "Kệ, không trả lời", "Nhờ khách quen review lại"],
    text: "💬 Review 1 sao vô lý trên Google/Yelp — xử lý sao cho khéo?\n\nTrả lời công khai thì sợ căng, im lặng thì người đọc tưởng tiệm sai. Bạn hay làm thế nào?\n\nBình chọn và chia sẻ câu trả lời mẫu bạn hay dùng nhé 👇" },
  { key: "license", match: /license|bằng nail|thi bằng|giấy phép|học nail/i, question: "Bạn thi license nail ở bang nào?", options: ["Texas", "California", "Florida", "Bang khác"],
    text: "💬 Hành trình thi license nail của bạn thế nào?\n\nMỗi bang một luật: số giờ học, thi lý thuyết, thi thực hành… Người mới vào nghề thường bỡ ngỡ nhất ở bước này.\n\nBình chọn bang của bạn + để lại 1 lời khuyên cho người mới nhé 👇" },
  { key: "hiring", match: /tuyển thợ|thiếu thợ|kiếm thợ|tìm thợ|cần thợ/i, question: "Chủ tiệm: tuyển thợ bây giờ khó cỡ nào?", options: ["Rất khó", "Hơi khó", "Bình thường", "Dễ"],
    text: "💬 Chủ tiệm ơi, tuyển thợ dạo này khó cỡ nào?\n\nCó tiệm đăng tin cả tuần không ai gọi, có tiệm thợ tới thử 1 ngày rồi đi. Thợ thì nói muốn biết rõ lương, chỗ ở, cách chia turn trước khi tới.\n\nBình chọn + chia sẻ: tiệm bạn ghi gì trong tin tuyển thì thợ gọi nhiều nhất? 👇\n\n👉 Đăng tin tuyển trên PawNail: bitpawos.com/jobs/create" },
];

// Bản tiếng Anh của từng chủ đề (cùng thứ tự lựa chọn — phiếu lưu theo chỉ số). Lưu kèm bài qua lib/postEn.ts.
export const TOPIC_BANK_EN: Record<string, { text: string; question: string; options: string[] }> = {
  turn: { question: "How does your salon split turns?", options: ["Rotation in order", "By service value", "The owner assigns", "Clients pick the tech"],
    text: "💬 The age-old question: splitting turns.\n\nSome salons rotate evenly, some go by service value, some let the owner decide — and plenty of techs feel their turns get skipped without knowing how to bring it up.\n\nHow does your salon do it, and which way feels fairest to you? Vote below and tell us how it works where you are." },
  "tip-card": { question: "Card tips: how does your salon pay techs?", options: ["In full, in cash", "Minus card fees", "Added to the paycheck", "Not clear"],
    text: "💬 Card tips — how does your salon pay them out?\n\nSome salons pay the full amount in cash at the end of the day, some deduct card fees, some add tips to the paycheck. There's no single “right” way for every salon, but agreeing on it up front saves a lot of friction.\n\nVote and share how your salon handles it so others can compare.\n\n📝 Tip: log your tips every day under “Income & tips” in the app so they're easy to check at the end of the week." },
  "pay-model": { question: "Which do you prefer?", options: ["Guaranteed pay", "60/40 commission", "70/30 commission", "Depends on the salon and season"],
    text: "💬 Guaranteed pay or commission — which side are you on?\n\nA guarantee is steadier in slow months; commission can pay more when the salon is busy. Everyone's situation is different: new to the trade, supporting a family, or saving to open a salon…\n\nWhich do you work on now, and why? Vote and tell us." },
  "1099": { question: "What tax form are you getting this year?", options: ["1099", "W-2", "None", "Not sure"],
    text: "💬 Tax season is coming — are you paid on a 1099 or a W-2?\n\nA lot of techs aren't sure what the difference is: on a 1099 you handle your own taxes (and may need to pay quarterly); on a W-2 the salon withholds them for you. Not getting a form doesn't mean you don't need to file.\n\nVote so everyone can see how it looks, and leave a comment if you have questions.\n\nℹ️ General information, not tax advice — ask a CPA about your situation." },
  "no-pay": { question: "Late cancellations or clients who leave without paying — what does your salon do?", options: ["Take a deposit", "Hold a card at booking", "Let it go", "Don't rebook that client"],
    text: "💬 Clients who book and don't show, or who complain after the service and leave without paying… anyone who's been in the trade a while has probably seen it at least once.\n\nHow does your salon protect itself? A deposit, a card on file, or just let it go?\n\nVote and share what's worked for you so others can learn from it." },
  notice: { question: "Leaving a salon or letting a tech go — how much notice is fair?", options: ["1 week", "2 weeks", "1 month", "No notice needed"],
    text: "💬 How should owners and techs part ways?\n\nWhen a tech leaves without notice, the salon is short-handed; when an owner lets a tech go suddenly, the tech is short on rent. How much notice is fair for both sides?\n\nVote and share your story (no need to name the salon)." },
  price: { question: "What does a full set of acrylics cost in your area?", options: ["Under $40", "$40–55", "$55–70", "Over $70"],
    text: "💬 What's a full set of acrylics going for in your area?\n\nSupplies cost more, rent costs more — but raising prices can mean losing clients. Let's see how pricing looks in different areas.\n\nVote and comment with your state or city." },
  days: { question: "How many days a week do you work?", options: ["5 days", "6 days", "7 days", "It varies"],
    text: "💬 How many days a week is the right amount?\n\nSome work 7 days to earn more; others keep 1–2 days off for their health and family. Backs, wrists and eyes all have limits.\n\nHow many days do you work? Vote and share how you keep your energy up." },
  health: { question: "At your station, what do you use for dust and fumes?", options: ["A regular mask", "An N95 mask", "A table-top dust collector", "Nothing yet"],
    text: "💬 Filing dust and acetone fumes every day — how do you protect yourself?\n\nNail techs breathe in more dust and chemicals than most people realize. A mask, a table-top collector, better ventilation… every bit helps.\n\nVote and recommend the gear you think is worth the money." },
  review: { question: "You get an unfair 1-star review — what do you do?", options: ["Reply politely", "Message the client privately", "Leave it", "Ask regulars for reviews"],
    text: "💬 An unfair 1-star review on Google or Yelp — how do you handle it well?\n\nReplying publicly can feel risky; staying quiet can make readers assume the salon was wrong. What do you usually do?\n\nVote and share a reply you like to use." },
  license: { question: "Which state did you get your nail license in?", options: ["Texas", "California", "Florida", "Another state"],
    text: "💬 What was getting your nail license like?\n\nEvery state has its own rules: training hours, a written exam, a practical exam… It's often the most confusing step for people new to the trade.\n\nVote for your state and leave one piece of advice for newcomers." },
  hiring: { question: "Salon owners: how hard is hiring right now?", options: ["Very hard", "Somewhat hard", "About normal", "Easy"],
    text: "💬 Salon owners, how hard is it to hire techs these days?\n\nSome salons post a job for a week with no calls; others have techs try a day and leave. Techs say they want to know the pay, housing and turn system up front.\n\nVote and share: what do you put in your job post that gets the most calls?\n\nPost a job on PawNail: bitpawos.com/jobs/create" },
};

const SCORE_KEY = "hot_topic_scores";
const LAST_KEY = "hot_topic_last";
const DAY = 86_400_000;
type Scores = Record<string, { score: number; at: number }>;
const readJson = async <T,>(k: string, d: T): Promise<T> => { try { return JSON.parse((await getSetting(k)) || "") as T; } catch { return d; } };

/** Tool gửi tín hiệu: [{ topic: "chia turn bất công", likes, comments }] — chỉ chữ chủ đề, không nội dung/tên. */
export async function recordTopicSignals(items: { topic?: unknown; likes?: unknown; comments?: unknown }[], now = Date.now()) {
  const scores = await readJson<Scores>(SCORE_KEY, {});
  let matched = 0;
  for (const it of items.slice(0, 500)) {
    const text = String(it.topic ?? "").slice(0, 300);
    const weight = 1 + Math.min(500, Number(it.likes) || 0) + 2 * Math.min(500, Number(it.comments) || 0);
    for (const t of TOPIC_BANK) {
      if (!t.match.test(text)) continue;
      const prev = scores[t.key] && now - scores[t.key].at < 3 * DAY ? scores[t.key].score : 0; // điểm cũ hơn 3 ngày → reset
      scores[t.key] = { score: prev + weight, at: now };
      matched++;
    }
  }
  await setSetting(SCORE_KEY, JSON.stringify(scores));
  return { matched, scores };
}

/** Đăng 1 chủ đề nóng (nóng nhất chưa đăng trong 10 ngày; không có tín hiệu thì xoay vòng kho chủ đề). */
export async function publishHotTopicPost(now = new Date()): Promise<{ posted: boolean; key?: string; reason?: string }> {
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  if (!officialId || process.env.OFFICIAL_DAILY_POST === "0" || process.env.HOT_TOPICS_DAILY === "0") return { posted: false, reason: "tắt" };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Đếm bài CÓ THĂM DÒ hôm nay (bài bot khác cũng có thể mở đầu bằng 💬)
  if (await prisma.post.count({ where: { authorId: officialId, createdAt: { gte: dayStart }, poll: { isNot: null } } })) return { posted: false, reason: "hôm nay đã có" };
  const scores = await readJson<Scores>(SCORE_KEY, {});
  const last = await readJson<Record<string, number>>(LAST_KEY, {});
  const fresh = TOPIC_BANK.filter((t) => !last[t.key] || now.getTime() - last[t.key] > 10 * DAY);
  const pool = fresh.length ? fresh : TOPIC_BANK;
  const live = (t: HotTopic) => (scores[t.key] && now.getTime() - scores[t.key].at < 3 * DAY ? scores[t.key].score : 0);
  const day = Math.floor(now.getTime() / DAY);
  const pick = [...pool].sort((a, b) => live(b) - live(a) || ((TOPIC_BANK.indexOf(a) - day) % 12 + 12) % 12 - (((TOPIC_BANK.indexOf(b) - day) % 12 + 12) % 12))[0];
  const id = "c" + crypto.randomBytes(12).toString("hex");
  await prisma.post.create({ data: { id, authorId: officialId, content: pick.text, postType: "GENERAL", mediaUrls: "[]", market: null, createdAt: now } });
  await prisma.postPoll.create({ data: { postId: id, question: pick.question, options: JSON.stringify(pick.options) } });
  const en = TOPIC_BANK_EN[pick.key];
  if (en) await savePostEn(id, { content: en.text, question: en.question, options: en.options });
  await setSetting(LAST_KEY, JSON.stringify({ ...last, [pick.key]: now.getTime() }));
  return { posted: true, key: pick.key };
}
