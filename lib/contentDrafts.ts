import type { Signals } from "@/lib/trendSignals";
import { TOPIC_LABEL, type NewsItem } from "@/lib/industryFeed";

// Biến tín hiệu thật thành BÀI NHÁP sẵn để đăng — admin duyệt trước khi lên
// bảng tin (PawNail Studio), hoặc sao chép caption đi Facebook / TikTok.
// Mỗi bài đều trích đúng con số & nguồn của tín hiệu, không thêm thắt.

export interface Draft {
  id: string; // ổn định theo nội dung → không đăng trùng
  kind: "pulse" | "gap" | "salary" | "hashtag" | "pain" | "news";
  title: string;
  body: string;
  href: string | null;
  caption: string; // bản cho mạng xã hội, kèm hashtag
  evidence: string; // dữ liệu gốc để admin kiểm
}

const BASE_TAGS = "#PawNail #NailTech #ThoNail #TiemNail";
const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
const money = (n: number, market: string) => `${market === "AU" ? "A$" : "$"}${n.toLocaleString("en-US")}`;

export function buildDrafts(s: Signals, news: NewsItem[]): Draft[] {
  const out: Draft[] = [];
  const add = (d: Omit<Draft, "id">) => out.push({ ...d, id: `${d.kind}-${hash(d.title)}` });
  const where = s.market === "US" ? "Mỹ" : "Úc";

  for (const p of s.pulse.filter((x) => x.published && x.top)) {
    const who = /thợ/i.test(p.topic) ? "thợ" : "chủ tiệm";
    add({
      kind: "pulse",
      title: `📊 ${p.topic}: ${p.top!.pct}% chọn "${p.top!.label}"`,
      body: `${p.total} ${who} tại ${where} trả lời "Nhịp đau tuần" trên PawNail — ${p.options.filter((o) => o.votes).map((o) => `${o.label} ${o.pct}%`).join(" · ")}. Bạn thì sao? Trả lời câu hỏi tuần này ngay trên bảng tin.`,
      href: "/?tab=feed",
      caption: `${p.top!.pct}% ${who} nail ở ${where} nói: "${p.top!.label}" là điều ${/học/.test(p.topic) ? "muốn học nhất" : "đáng bàn nhất"} tuần này. Còn bạn? 👇 ${BASE_TAGS}`,
      evidence: `Tuần ${p.week}, ${p.total} phiếu`,
    });
  }
  for (const g of s.skillGaps.slice(0, 4)) {
    add({
      kind: "gap",
      title: `🔥 Thiếu thợ ${g.skill} tại ${g.label}: ${g.jobs} tin cần, ${g.techs} thợ sẵn sàng`,
      body: `14 ngày qua có ${g.jobs} tin tuyển ở ${g.label} cần kỹ năng ${g.skill}, trong khi chỉ ${g.techs} thợ có kỹ năng này đang sẵn sàng nhận việc. Thợ ${g.skill}: bật "Tìm việc gấp" và cập nhật portfolio để tiệm tìm thấy bạn.`,
      href: "/?tab=jobs",
      caption: `Thợ ${g.skill} ở ${g.label} đang được săn: ${g.jobs} tiệm cần, mới ${g.techs} thợ sẵn sàng. Vào PawNail xem việc ngay 💅 ${BASE_TAGS} #${g.skill.replace(/\W/g, "")}`,
      evidence: `Tin tuyển 14 ngày ↔ hồ sơ thợ đang rảnh tại ${g.state}`,
    });
  }
  for (const m of s.salaryMoves.slice(0, 3)) {
    const up = m.changePct > 0;
    add({
      kind: "salary",
      title: `💵 Lương tuần tại ${m.label} ${up ? "tăng" : "giảm"} ${Math.abs(m.changePct)}%: ${money(m.before, s.market)} → ${money(m.now, s.market)}`,
      body: `Trung vị lương tuần trong tin tuyển ${m.label} 30 ngày qua là ${money(m.now, s.market)}, so với ${money(m.before, s.market)} của 30 ngày trước đó (${m.samples} tin có ghi lương). ${up ? "Thợ có thêm lợi thế khi thương lượng." : "Chủ tiệm có thể cân nhắc mức đăng tin."}`,
      href: "/trends",
      caption: `Lương thợ nail ở ${m.label} ${up ? "đang tăng" : "đang giảm"} ${Math.abs(m.changePct)}% (từ tin tuyển thật trên PawNail). ${BASE_TAGS} #LuongThoNail`,
      evidence: `${m.samples} tin có lương tuần, 60 ngày`,
    });
  }
  for (const t of s.risingTags.slice(0, 3)) {
    add({
      kind: "hashtag",
      title: `📈 #${t.tag} đang lên: ${t.now} bài tuần này`,
      body: `Hashtag #${t.tag} có ${t.now} bài trong 7 ngày qua${t.before ? ` (tuần trước ${t.before})` : ""}. Đăng mẫu của bạn kèm #${t.tag} để lên bảng Xu hướng.`,
      href: "/trends",
      caption: `#${t.tag} đang hot trong cộng đồng thợ nail Việt! Khoe mẫu của bạn trên PawNail nhé ✨ ${BASE_TAGS} #${t.tag}`,
      evidence: `Bài đăng 14 ngày qua`,
    });
  }
  for (const r of s.reviewPains.slice(0, 2)) {
    add({
      kind: "pain",
      title: `⚠️ Nỗi đau ngành: "${r.criterion}" chỉ đạt ${r.avg}★`,
      body: `Trong ${r.count} đánh giá 90 ngày qua, tiêu chí "${r.criterion}" có điểm trung bình thấp nhất (${r.avg}/5). ${r.side === "salon" ? "Tiệm minh bạch chia turn & trả lương đúng hẹn sẽ giữ được thợ giỏi." : "Thợ giữ chữ tín là thợ được mời lại."}`,
      href: "/trends",
      caption: `Điều thợ & tiệm nail phàn nàn nhiều nhất: "${r.criterion}". Bạn có gặp không? ${BASE_TAGS}`,
      evidence: `${r.count} đánh giá`,
    });
  }
  for (const p of s.ownerPains.slice(0, 2)) {
    if (p.count < 3) continue;
    add({
      kind: "pain",
      title: `🏪 ${p.pct}% chủ tiệm gặp: ${p.label}`,
      body: `${p.count} chủ tiệm tại ${where} cho biết họ đang gặp vấn đề "${p.label}" (khảo sát lúc đăng ký PawNail). Bạn xử lý thế nào? Chia sẻ kinh nghiệm trên bảng tin.`,
      href: "/?tab=feed",
      caption: `${p.pct}% chủ tiệm nail gặp "${p.label}". Tiệm bạn có không? ${BASE_TAGS}`,
      evidence: `${p.count} chủ tiệm khai báo`,
    });
  }
  for (const n of news.filter((x) => x.topic !== "other").slice(0, 5)) {
    add({
      kind: "news",
      title: `📰 ${TOPIC_LABEL[n.topic]}: ${n.title}`,
      body: `Nguồn: ${n.source}. Bấm để đọc bài gốc — bạn nghĩ sao về tin này?`,
      href: n.link,
      caption: `${n.title} (nguồn: ${n.source}) — thợ & chủ tiệm nail nghĩ sao? ${BASE_TAGS}`,
      evidence: `${n.source}${n.publishedAt ? `, ${n.publishedAt.slice(0, 10)}` : ""}`,
    });
  }
  return out;
}
