// "CHỦ ĐỀ NÓNG" — bài MỞ THẢO LUẬN + thăm dò 1 chạm, đăng từ TÀI KHOẢN CHÍNH THỨC.
//   - Tool chỉ gửi TÍN HIỆU chủ đề đang sôi (từ khoá + số like/comment) qua /api/content/topics —
//     KHÔNG gửi nội dung bài hay tên người. PawNail chấm điểm → chọn chủ đề nóng nhất chưa đăng gần đây.
//   - Bài do PawNail tự viết (câu hỏi thật, không bịa số liệu, không giả danh ai). Người thật vào bình luận/bình chọn.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";

export interface HotTopic { key: string; match: RegExp; text: string; question: string; options: string[] }

export const TOPIC_BANK: HotTopic[] = [
  { key: "turn", match: /turn|chia khách|xoay vòng|lượt khách/i, question: "Tiệm bạn chia turn kiểu nào?", options: ["Xoay vòng theo thứ tự", "Tính theo tiền dịch vụ", "Chủ tiệm tự chia", "Khách chọn thợ"],
    text: "💬 Chuyện muôn thuở: CHIA TURN.\n\nCó tiệm xoay vòng đều, có tiệm tính theo tiền dịch vụ, có tiệm để chủ chia — và cũng không ít thợ thấy mình bị “ăn turn” mà không biết nói sao.\n\nỞ tiệm bạn chia thế nào? Kiểu nào bạn thấy công bằng nhất? Bình chọn bên dưới rồi kể cách tiệm bạn làm nhé 👇" },
  { key: "tip-card", match: /tip.*(thẻ|card)|quẹt thẻ|phí thẻ|tip cash|tiền tip/i, question: "Tip quẹt thẻ, tiệm bạn trả thợ thế nào?", options: ["Trả đủ, tiền mặt", "Trừ phí thẻ", "Gộp vào check", "Chưa rõ ràng"],
    text: "💬 Tip khách quẹt thẻ — tiệm bạn trả thợ ra sao?\n\nCó tiệm trả đủ bằng tiền mặt cuối ngày, có tiệm trừ phí thẻ, có tiệm gộp vào check. Không có cách nào là “chuẩn” cho mọi tiệm, nhưng rõ ràng ngay từ đầu thì đỡ mất lòng nhau.\n\nBình chọn + chia sẻ cách tiệm bạn làm để mọi người tham khảo nha 👇\n\n📝 Mẹo: ghi tip mỗi ngày ở mục “Thu nhập & tip” trong app để cuối tuần đối chiếu cho dễ." },
  { key: "pay-model", match: /bao lương|ăn chia|6\/4|7\/3|commission|lương tuần/i, question: "Bạn thích làm kiểu nào hơn?", options: ["Bao lương", "Ăn chia 6/4", "Ăn chia 7/3", "Tuỳ tiệm, tuỳ mùa"],
    text: "💬 Bao lương hay ăn chia — bạn chọn bên nào?\n\nBao lương thì chắc tay mùa vắng, ăn chia thì mùa đông khách được nhiều hơn. Mỗi người một hoàn cảnh: mới qua, có gia đình, hay đang muốn tích tiền mở tiệm…\n\nBạn đang làm kiểu nào và vì sao? Bình chọn rồi kể nghe thử nhé 👇" },
  { key: "1099", match: /1099|w-?2|irs|thuế|tax/i, question: "Năm nay bạn nhận giấy tờ thuế kiểu nào?", options: ["1099", "W-2", "Không nhận gì", "Chưa biết"],
    text: "💬 Mùa thuế sắp tới — bạn đang được trả theo 1099 hay W-2?\n\nNhiều bạn thợ vẫn chưa rõ khác nhau ở đâu: 1099 thì tự lo thuế (có thể phải đóng theo quý), W-2 thì tiệm khấu trừ sẵn. Không nhận giấy tờ gì không có nghĩa là không phải khai.\n\nBình chọn cho mọi người biết tình hình nhé, có câu hỏi thì để lại bình luận 👇\n\nℹ️ Thông tin chung, không thay cho tư vấn thuế — trường hợp cụ thể hãy hỏi CPA." },
  { key: "no-pay", match: /quỵt|bỏ về|không trả|no.?show|huỷ hẹn|hủy hẹn|bùng/i, question: "Khách huỷ hẹn sát giờ / bỏ về không trả — tiệm bạn làm gì?", options: ["Lấy cọc trước", "Giữ thẻ khi đặt lịch", "Bỏ qua cho lành", "Không nhận lại khách đó"],
    text: "💬 Khách đặt lịch rồi không tới, hoặc làm xong chê rồi bỏ về không trả… ai làm nghề lâu chắc cũng gặp ít nhất một lần.\n\nTiệm bạn có cách nào phòng không? Lấy cọc, giữ thẻ, hay đành chịu cho lành?\n\nBình chọn và chia sẻ kinh nghiệm để anh chị em khác học hỏi nhé 👇" },
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
    text: "💬 Hành trình thi license nail của bạn thế nào?\n\nMỗi bang một luật: số giờ học, thi lý thuyết, thi thực hành… Người mới qua thường bỡ ngỡ nhất ở bước này.\n\nBình chọn bang của bạn + để lại 1 lời khuyên cho người mới nhé 👇" },
  { key: "hiring", match: /tuyển thợ|thiếu thợ|kiếm thợ|tìm thợ|cần thợ/i, question: "Chủ tiệm: tuyển thợ bây giờ khó cỡ nào?", options: ["Rất khó", "Hơi khó", "Bình thường", "Dễ"],
    text: "💬 Chủ tiệm ơi, tuyển thợ dạo này khó cỡ nào?\n\nCó tiệm đăng tin cả tuần không ai gọi, có tiệm thợ tới thử 1 ngày rồi đi. Thợ thì nói muốn biết rõ lương, chỗ ở, cách chia turn trước khi tới.\n\nBình chọn + chia sẻ: tiệm bạn ghi gì trong tin tuyển thì thợ gọi nhiều nhất? 👇\n\n👉 Đăng tin tuyển miễn phí trên PawNail: bitpawos.com/jobs/create" },
];

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
  if (await prisma.post.count({ where: { authorId: officialId, createdAt: { gte: dayStart }, content: { startsWith: "💬" } } })) return { posted: false, reason: "hôm nay đã có" };
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
  await setSetting(LAST_KEY, JSON.stringify({ ...last, [pick.key]: now.getTime() }));
  return { posted: true, key: pick.key };
}
