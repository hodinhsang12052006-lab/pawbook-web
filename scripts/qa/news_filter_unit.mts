// Bộ lọc tin ngành: bỏ tin sự cố giật gân + nguồn chặn, giữ tin an toàn có quy định.   npx tsx scripts/qa/news_filter_unit.mts
import { postable, weakWriting } from "../../lib/newsPosts";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}`); };
const N = (title: string, topic: "law" | "labor" | "safety" | "business" | "trend" | "other" = "other", source = "AP News") => ({ title, topic, source });

ok("N1", "Tin tai nạn xe lao vào tiệm bị loại", !postable(N("Off-duty fire captain hurt after EV crashes into nail salon")));
ok("N2", "Tin an toàn có 'study' được giữ", postable(N("Nail salon air quality study detects VOCs", "safety")));
ok("N3", "Nguồn Breitbart bị loại", !postable(N("Nail salons see busy holiday season", "business", "Breitbart")));
ok("N4", "Tin kinh doanh thường được giữ", postable(N("Nail salons see busy holiday season", "business")));
ok("N5", "Câu mở '🚨 Tai nạn…!' bị coi là yếu", !!weakWriting({ hook: "🚨 Tai nạn xảy ra tại salon nail khiến nhiều người lo lắng!", points: ["Ý thứ nhất đủ dài để qua", "Ý thứ hai cũng đủ dài để qua"] }));
ok("N6", "Câu hỏi bỏ lửng bị coi là yếu", !!weakWriting({ hook: "Có vấn đề gì với salon nail ở Portland không vậy mọi người?", points: ["Ý thứ nhất đủ dài để qua", "Ý thứ hai cũng đủ dài để qua"] }));
ok("N7", "Câu mở bình thường vẫn đạt", weakWriting({ hook: "Tiểu bang Texas cập nhật quy định vệ sinh dụng cụ cho tiệm nail năm 2027", points: ["Ý thứ nhất đủ dài để qua", "Ý thứ hai cũng đủ dài để qua"] }) === null);

console.log(`\nLọc tin ngành: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
