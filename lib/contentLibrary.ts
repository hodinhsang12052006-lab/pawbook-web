// KHO BÀI DÙNG QUANH NĂM cho tài khoản chính thức — bổ sung cho lib/contentBot.ts (bài thuế/
// an toàn/theo mùa). Viết cho thợ nail & chủ tiệm người Việt ở Mỹ/Úc: tiếng Anh đứng quầy, sửa lỗi
// tay nghề, sức khoẻ, vệ sinh, nghề nghiệp, quản lý tiệm.
//
// Nguyên tắc: lời khuyên chung, dùng được ngay; KHÔNG đưa con số luật/thuế (phần đó ở contentBot
// có nguồn). Mỗi bài 3–5 ý + 1 câu kêu gọi lưu/chia sẻ/bình luận. Id ổn định → không đăng trùng.
import type { Topic } from "@/lib/contentBot";

const t = (x: Omit<Topic, "title" | "bullets"> & { title: string; bullets: string[] }): Topic => ({
  ...x,
  title: () => x.title,
  bullets: () => x.bullets,
});

export const LIBRARY_TOPICS: Topic[] = [
  // ---------- 🗣️ Tiếng Anh đứng quầy ----------
  t({
    id: "en-greeting", pillar: "skills", audience: "tech", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #1: chào khách & hỏi làm gì — 6 câu dùng mỗi ngày",
    bullets: [
      "\"Hi, welcome in! Do you have an appointment?\" — Chào, mời vào! Chị có hẹn trước không?",
      "\"What are we doing for you today?\" — Hôm nay chị muốn làm gì?",
      "\"Manicure, pedicure, or a full set?\" — Làm tay, làm chân hay đắp bộ mới?",
      "\"Please pick a color, I'll be right with you.\" — Chị chọn màu nha, em ra liền.",
      "\"It's about a 10-minute wait. Is that okay?\" — Chờ khoảng 10 phút, chị đợi được không?",
      "\"Go ahead and have a seat here.\" — Mời chị ngồi đây ạ.",
    ],
    cta: "💾 Lưu lại, mỗi ngày đọc to 1 lần — 1 tuần là nói trơn. Bình luận câu bạn hay bí nhất, PawNail làm bài tiếp theo!",
    tags: "#TiengAnhTiemNail #ThoNail #HocTiengAnh",
  }),
  t({
    id: "en-shape-length", pillar: "skills", audience: "tech", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #2: hỏi dáng, độ dài — khỏi làm sai ý khách",
    bullets: [
      "\"What shape would you like? Square, round, almond, coffin?\" — Chị thích dáng gì: vuông, tròn, hạnh nhân, coffin?",
      "\"How long do you want them? Short, medium, or long?\" — Chị muốn dài cỡ nào: ngắn, vừa hay dài?",
      "\"Is this length okay, or a little shorter?\" — Dài vầy được chưa, hay cắt ngắn chút nữa?",
      "\"Do you want them squoval — square with soft corners?\" — Chị muốn vuông bo góc không?",
      "Mẹo: đưa khách xem ảnh mẫu / bảng dáng móng rồi hỏi \"Like this one?\" — chỉ tay vào là khỏi hiểu lầm.",
    ],
    cta: "🔁 Gửi cho đồng nghiệp mới qua — đỡ cảnh làm xong khách lắc đầu.",
    tags: "#TiengAnhTiemNail #DangMong #ThoNail",
  }),
  t({
    id: "en-price-upsell", pillar: "skills", audience: "tech", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #3: báo giá & mời thêm dịch vụ mà khách không thấy bị \"ép\"",
    bullets: [
      "\"That'll be $45 for the gel manicure.\" — Gel tay giá $45 chị nha.",
      "\"Would you like to add a design? It's $5 per nail.\" — Chị muốn vẽ thêm không? $5 một móng.",
      "\"We have a mani-pedi combo today, it saves you $10.\" — Hôm nay có combo tay + chân, rẻ hơn $10.",
      "\"Your cuticles are a bit dry — would you like a paraffin treatment?\" — Da tay hơi khô, chị muốn ủ paraffin không?",
      "Nguyên tắc: gợi ý 1 lần, nói lợi ích cho khách, khách từ chối thì cười \"No problem!\" — không hỏi lại.",
    ],
    cta: "💬 Dịch vụ thêm nào tiệm bạn bán chạy nhất? Bình luận để thợ khác học hỏi nha.",
    tags: "#TiengAnhTiemNail #BanHang #ThoNail",
  }),
  t({
    id: "en-complaint", pillar: "skills", audience: "all", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #4: khách phàn nàn — 5 câu giữ bình tĩnh, giữ khách",
    bullets: [
      "\"I'm so sorry about that. Let me take a look.\" — Em xin lỗi, để em xem lại nha.",
      "\"Can you show me which nail is bothering you?\" — Chị chỉ em móng nào bị khó chịu?",
      "\"I can fix that for you right now, no charge.\" — Em sửa liền cho chị, không tính tiền.",
      "\"Let me get the manager to help you.\" — Để em gọi quản lý hỗ trợ chị.",
      "Đừng cãi, đừng nói tiếng Việt với nhau trước mặt khách — khách dễ nghĩ đang bị nói xấu.",
    ],
    cta: "💾 Lưu bài này — lúc căng thẳng dễ quên chữ nhất. Chia sẻ cho cả tiệm cùng đọc.",
    tags: "#TiengAnhTiemNail #ChamSocKhach #TiemNail",
  }),
  t({
    id: "en-phone-booking", pillar: "skills", audience: "all", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #5: nghe điện thoại đặt lịch không bị run",
    bullets: [
      "\"Thank you for calling [tên tiệm], how can I help you?\" — Cảm ơn đã gọi [tên tiệm], em giúp gì được ạ?",
      "\"What day and time works for you?\" — Chị muốn ngày giờ nào?",
      "\"We have 2 o'clock or 3:30 available.\" — Còn 2 giờ hoặc 3 rưỡi.",
      "\"Can I have your name and phone number?\" — Cho em xin tên và số điện thoại.",
      "\"Sorry, could you say that again a little slower?\" — Xin lỗi, chị nói chậm lại giúp em — câu cứu cánh, dùng thoải mái!",
    ],
    cta: "🔁 Gửi cho người hay phải trực quầy. Bạn sợ nhất câu nào khi nghe điện thoại?",
    tags: "#TiengAnhTiemNail #DatLich #TiemNail",
  }),
  t({
    id: "en-payment-tip", pillar: "skills", audience: "tech", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #6: tính tiền & tip — lịch sự mà rõ ràng",
    bullets: [
      "\"Your total is $62. Cash or card?\" — Tổng $62, chị trả tiền mặt hay thẻ?",
      "\"Would you like to add a tip on the card?\" — Chị muốn thêm tip vào thẻ không?",
      "\"Do you need a receipt?\" — Chị lấy hoá đơn không?",
      "\"Thank you so much! See you in two weeks.\" — Cảm ơn chị, hẹn 2 tuần nữa nha (nhắc luôn lịch dặm).",
      "Không nhìn chằm chằm lúc khách bấm tip — quay sang dọn bàn, khách thoải mái hơn và thường tip tốt hơn.",
    ],
    cta: "💬 Tiệm bạn khách tip tiền mặt hay qua thẻ nhiều hơn? Bình luận chia sẻ nha.",
    tags: "#TiengAnhTiemNail #Tip #ThoNail",
  }),
  t({
    id: "en-small-talk", pillar: "skills", audience: "tech", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #7: nói chuyện phiếm để khách quay lại tìm đúng bạn",
    bullets: [
      "\"Any plans for the weekend?\" — Cuối tuần chị có đi đâu chơi không?",
      "\"Is this for a special occasion?\" — Làm móng để đi tiệc hay dịp gì đặc biệt không chị?",
      "\"I love your ring / your bag!\" — Khen thật lòng 1 món khách đeo — mở chuyện dễ nhất.",
      "\"How did your last set hold up?\" — Bộ trước chị giữ được lâu không? (vừa hỏi han vừa biết tay nghề mình)",
      "Ghi chú tên + chuyện của khách quen vào điện thoại — lần sau nhắc lại, khách nhớ bạn mãi.",
    ],
    cta: "⭐ Khách quen = thu nhập ổn định. Lưu bài, thử 1 câu với khách đầu tiên ngày mai!",
    tags: "#TiengAnhTiemNail #KhachQuen #ThoNail",
  }),
  t({
    id: "en-colors", pillar: "skills", audience: "tech", market: "ALL",
    title: "🗣️ Tiếng Anh tiệm nail #8: gọi tên màu & hiệu ứng như dân chuyên",
    bullets: [
      "Nude / neutral = màu da · Milky white = trắng sữa · Sheer pink = hồng trong",
      "Glossy = bóng · Matte = nhám · Shimmer = ánh nhũ mịn · Glitter = kim tuyến",
      "Chrome = tráng gương · Cat eye = mắt mèo · Ombré = chuyển màu · French tip = đầu trắng",
      "\"Do you want a glossy or matte top coat?\" — Chị muốn phủ bóng hay nhám?",
      "\"This color is very popular this season.\" — Màu này đang được chuộng mùa này.",
    ],
    cta: "💾 Lưu để tra nhanh khi khách hỏi. Còn từ nào bạn hay gặp mà chưa biết? Bình luận nha!",
    tags: "#TiengAnhTiemNail #MauSon #ThoNail",
  }),

  // ---------- 💅 Sửa lỗi tay nghề ----------
  t({
    id: "fix-gel-lifting", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Gel bị bong sau 1 tuần? 5 lỗi hay gặp nhất và cách sửa",
    bullets: [
      "Chưa sạch dầu và lớp da chết trên móng: đẩy da kỹ, lau khử dầu (dehydrator) trước khi lên base.",
      "Lên gel chạm da / chạm viền: chừa 1 đường tóc quanh viền, chạm là chỗ đó bong trước tiên.",
      "Lớp quá dày: nhiều lớp mỏng chắc hơn 1 lớp dày — dày dễ co, dễ bong mép.",
      "Chưa bọc đầu móng (cap the free edge): quét base + top qua mép đầu móng để khoá lại.",
      "Hơ chưa đủ: đèn yếu / bóng cũ làm gel chưa khô hẳn bên dưới — kiểm tra đèn định kỳ.",
    ],
    cta: "💬 Khách của bạn hay bong ở chỗ nào: mép da hay đầu móng? Bình luận, thợ khác góp kinh nghiệm cho!",
    tags: "#TayNghe #Gel #ThoNail",
  }),
  t({
    id: "fix-dip-lumpy", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Dip bị vón, gồ ghề, mặt sần? Cách lên bột mịn ngay từ lớp đầu",
    bullets: [
      "Quét base mỏng, tránh sát da — base dày là bột đọng thành cục.",
      "Nhúng xong gõ nhẹ cho rơi bột thừa, đừng để bột đọng ở mép.",
      "Lớp đầu nên mỏng, lớp sau mới tạo độ dày ở giữa móng (apex).",
      "Dũa định hình TRƯỚC khi lên activator lần cuối — dũa sau dễ trầy, mất bóng.",
      "Bột để lâu bị ẩm sẽ vón: đậy kín hũ, không nhúng tay ướt.",
    ],
    cta: "🔁 Lưu & gửi cho thợ mới học dip — đỡ mất khách vì bộ móng dày cộm.",
    tags: "#TayNghe #DipSNS #ThoNail",
  }),
  t({
    id: "fix-acrylic-bubbles", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Bột acrylic có bọt khí, đục hoặc nứt chân chim — nguyên nhân & cách sửa",
    bullets: [
      "Tỉ lệ nước:bột sai: viên bột quá ướt dễ bọt, quá khô dễ nứt — tập lấy viên bột \"bóng ướt vừa\".",
      "Cọ bẩn hoặc còn bột khô trong lông cọ: lau cọ sạch giữa các viên bột.",
      "Ấn, vỗ viên bột quá mạnh tạo bọt: đặt viên bột rồi vuốt nhẹ.",
      "Phòng quá lạnh làm bột khô chậm và đục — giữ phòng ấm vừa phải.",
      "Dung dịch (liquid) để mở nắp lâu bị bẩn: dùng chén nhỏ, đổ lượng vừa đủ cho mỗi khách.",
    ],
    cta: "💬 Bạn dùng tỉ lệ nước:bột thế nào cho mùa lạnh? Chia sẻ bí quyết cho anh chị em nha.",
    tags: "#TayNghe #BotAcrylic #ThoNail",
  }),
  t({
    id: "fix-chrome", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Chrome không lên gương, bị mờ hoặc lem? Kiểm tra 4 điều này",
    bullets: [
      "Dùng top không lau (no-wipe) và hơ đủ thời gian trước khi chà bột.",
      "Chà khi top còn ấm sau khi hơ — nguội rồi bột bám kém, không lên gương.",
      "Chà nhẹ bằng mút / đầu silicon, đều tay — ấn mạnh làm trầy lớp top.",
      "Phủ top khoá 2 lớp, nhớ bọc mép đầu móng để chrome không bong mép.",
    ],
    cta: "🔁 Lưu lại thử ngay bộ chrome tiếp theo. Gắn tag #PawNail khi khoe ảnh thành phẩm nha!",
    tags: "#TayNghe #Chrome #ThoNail",
  }),
  t({
    id: "fix-long-set-break", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Móng dài hay gãy ở giữa? Bí quyết nằm ở điểm cao (apex)",
    bullets: [
      "Apex là phần dày nhất, nằm khoảng 1/3 tính từ chỗ móng thật nối với móng giả — đó là chỗ chịu lực.",
      "Nhìn ngang móng: đường cong nhẹ, dày ở apex, mỏng dần về đầu và về chân móng.",
      "Móng càng dài càng cần apex rõ — móng phẳng lì là dễ gãy ngang.",
      "Dặn khách: không dùng móng để cạy, mở lon — gợi ý dùng đầu ngón tay.",
    ],
    cta: "💬 Dáng nào khách tiệm bạn chuộng nhất: coffin, almond hay square? Bình luận nha!",
    tags: "#TayNghe #DapMong #ThoNail",
  }),
  t({
    id: "fix-cuticle-safety", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Làm da (cuticle) an toàn: không chảy máu, không mất khách",
    bullets: [
      "Làm mềm da trước (ngâm hoặc dùng cuticle remover) — da mềm thì ít phải cắt.",
      "Chỉ cắt phần da chết đã bong, không cắt vào da sống.",
      "Kìm phải sắc và được khử trùng sau mỗi khách — kìm cùn dễ giật da.",
      "Lỡ chảy máu: dừng ngay, ấn bông sạch, xin lỗi khách, xử lý theo quy định vệ sinh của tiệm/bang.",
      "Khách có bệnh tiểu đường hoặc da tay có vết thương: làm nhẹ tay, hạn chế cắt.",
    ],
    cta: "🔁 Gửi cho thợ mới — làm da là chỗ khách hay phàn nàn nhất.",
    tags: "#TayNghe #VeSinh #ThoNail",
  }),
  t({
    id: "fix-french-straight", pillar: "skills", audience: "tech", market: "ALL",
    title: "💅 Vẽ French đầu thẳng, đều 10 ngón — 3 cách cho thợ chưa chắc tay",
    bullets: [
      "Cọ dẹt nhỏ: tì cổ tay vào bàn, xoay ngón tay khách thay vì xoay cọ.",
      "Silicon stamper: quét gel trắng lên mặt stamper, ấn đầu móng vào — nhanh và đều.",
      "Dán băng định hình (French guide) cho khách khó tính, lên màu xong gỡ khi còn ướt.",
      "Vẽ đường cong 2 bên trước, nối vào giữa sau — dễ cân hơn vẽ 1 nét.",
    ],
    cta: "💬 Bạn quen cách nào? Bình luận chia sẻ, hoặc quay video 10 giây đăng mục Khoe tay nghề để chủ tiệm thấy bạn nha!",
    tags: "#TayNghe #FrenchTip #ThoNail",
  }),

  // ---------- 🩺 Sức khoẻ thợ ----------
  t({
    id: "health-back-neck", pillar: "health", audience: "tech", market: "ALL",
    title: "🧘 Đau lưng, mỏi cổ vai gáy: 5 động tác 2 phút làm giữa 2 khách",
    bullets: [
      "Xoay vai: 10 vòng ra sau, 10 vòng ra trước — đỡ cứng vai sau khi cúi lâu.",
      "Kéo giãn cổ: nghiêng đầu sang 1 bên, giữ 15 giây, đổi bên.",
      "Mở ngực: đan tay sau lưng, ưỡn ngực, giữ 15 giây.",
      "Duỗi cổ tay: duỗi thẳng tay, dùng tay kia kéo nhẹ các ngón về phía mình.",
      "Chỉnh ghế để mắt không phải cúi gập — kê bàn tay khách cao hơn thay vì cúi người xuống.",
    ],
    cta: "💾 Lưu & làm thử hôm nay. Đau kéo dài, tê tay thì nên đi khám — sức khoẻ là cần câu cơm.",
    tags: "#SucKhoeTho #ThoNail",
  }),
  t({
    id: "health-eyes", pillar: "health", audience: "tech", market: "ALL",
    title: "👀 Giữ mắt khi làm nail cả ngày: bụi mài, ánh đèn và mỏi mắt",
    bullets: [
      "Đeo kính bảo hộ khi mài bột — bụi bắn vào mắt dễ viêm, trầy giác mạc.",
      "Quy tắc 20-20-20: cứ 20 phút nhìn xa khoảng 6 mét trong 20 giây.",
      "Đèn bàn đủ sáng, ánh trắng — thiếu sáng làm mắt phải căng.",
      "Không nhìn thẳng vào đèn hơ gel.",
      "Mắt đỏ, nhìn mờ kéo dài: đi khám, đừng tự nhỏ thuốc lung tung.",
    ],
    cta: "🔁 Gửi cho đồng nghiệp — đôi mắt theo nghề mình cả chục năm.",
    tags: "#SucKhoeTho #ThoNail",
  }),
  t({
    id: "health-allergy", pillar: "health", audience: "tech", market: "ALL",
    title: "🧤 Ngứa, nổi mẩn khi làm gel/bột? Dấu hiệu dị ứng & cách phòng",
    bullets: [
      "Dấu hiệu: ngứa, đỏ, phồng rộp quanh ngón tay của thợ hoặc quanh móng của khách.",
      "Nguyên nhân hay gặp: gel/monomer chưa khô dính lên da nhiều lần.",
      "Phòng: đeo găng nitrile, không để gel chạm da, lau sạch dụng cụ dính gel.",
      "Hơ đủ thời gian để gel khô hẳn — gel còn ướt là thủ phạm chính.",
      "Đã bị dị ứng thì nên đi khám da liễu và tạm ngưng tiếp xúc sản phẩm gây kích ứng.",
    ],
    cta: "💬 Bạn hay khách của bạn từng bị chưa? Chia sẻ để mọi người cùng cẩn thận.",
    tags: "#SucKhoeTho #DiUng #ThoNail",
  }),

  // ---------- 🧼 Vệ sinh & an toàn tiệm ----------
  t({
    id: "hygiene-tools", pillar: "safety", audience: "all", market: "ALL",
    title: "🧼 Khử trùng dụng cụ giữa 2 khách: quy trình 4 bước khách nhìn là tin",
    bullets: [
      "Làm sạch: rửa xà phòng, chà sạch bụi và cặn trên kìm, sủi da.",
      "Khử trùng: ngâm dung dịch khử trùng đúng loại và đủ thời gian theo hướng dẫn trên chai.",
      "Lau khô, cất vào hộp/túi sạch có nắp — không để lộ thiên trên bàn.",
      "Đồ dùng 1 lần (dũa giấy, buffer, đá chà gót) phải bỏ sau mỗi khách hoặc tặng khách mang về.",
      "Quy định cụ thể khác nhau theo bang/vùng — kiểm tra hướng dẫn của cơ quan cấp phép nơi bạn làm.",
    ],
    cta: "⭐ Khách để ý vệ sinh hơn bạn nghĩ — mở túi dụng cụ mới trước mặt khách là điểm cộng lớn. Lưu lại cho cả tiệm nha!",
    tags: "#VeSinhTiem #TiemNail #ThoNail",
  }),
  t({
    id: "hygiene-pedicure", pillar: "safety", audience: "all", market: "ALL",
    title: "🛁 Bồn ngâm chân sạch: việc nhỏ quyết định tiệm có bị khiếu nại hay không",
    bullets: [
      "Xả nước, chà sạch bồn sau MỖI khách — kể cả khi dùng túi lót.",
      "Chạy dung dịch khử trùng trong bồn theo đúng thời gian ghi trên sản phẩm.",
      "Cuối ngày vệ sinh kỹ bộ phận lọc / tuần hoàn (nếu có).",
      "Khách có vết thương hở ở chân: lịch sự đề nghị dời lịch.",
      "Ghi sổ vệ sinh bồn hằng ngày — vừa nhắc thợ, vừa có bằng chứng khi được kiểm tra.",
    ],
    cta: "🔁 Chủ tiệm gửi cho cả team cùng đọc nha.",
    tags: "#VeSinhTiem #Pedicure #TiemNail",
  }),

  // ---------- 📈 Nghề nghiệp & thu nhập ----------
  t({
    id: "career-first-30-days", pillar: "skills", audience: "tech", market: "ALL",
    title: "📈 30 ngày đầu ở tiệm mới: làm sao để chủ giữ, khách nhớ, đồng nghiệp quý",
    bullets: [
      "Hỏi rõ ngay từ đầu: chia turn, cách tính lương, giờ giấc, ai mua supply — ghi lại bằng tin nhắn.",
      "Đến sớm 10 phút, dọn bàn gọn — chủ tiệm để ý những thứ này rất nhanh.",
      "Học bảng giá và dịch vụ của tiệm trong tuần đầu.",
      "Chụp ảnh mọi bộ móng đẹp bạn làm — portfolio là \"CV\" cho lần sau.",
      "Không bàn chuyện lương với đồng nghiệp ở tiệm — dễ mất lòng.",
    ],
    cta: "💬 Bạn từng có kinh nghiệm \"ngày đầu đi làm\" nhớ đời nào không? Bình luận nha.",
    tags: "#NgheNail #ThoNail #ViecLamNail",
  }),
  t({
    id: "career-negotiate", pillar: "skills", audience: "tech", market: "ALL",
    title: "💬 Thương lượng lương khi đổi tiệm: nói gì để không bị ép mà vẫn giữ hoà khí",
    bullets: [
      "Tham khảo mức lương khu vực trước (Nail Radar trên PawNail) — biết giá thị trường mới tự tin.",
      "Nói bằng con số và tay nghề: \"Em làm được Gel-X, dip, design; khách quen khoảng 20 người.\"",
      "Hỏi trọn gói: bao lương bao lâu, sau đó chia mấy/mấy, tip trả thế nào, có chỗ ở không.",
      "Xin thoả thuận bằng tin nhắn — nói miệng dễ \"quên\".",
      "Chưa ưng thì cảm ơn và từ chối lịch sự — ngành nhỏ, giữ mối quan hệ.",
    ],
    cta: "🔁 Lưu trước khi đi phỏng vấn tiệm mới. Xem việc đang tuyển ở tab Việc gấp nha!",
    tags: "#LuongThoNail #NgheNail #ThoNail",
  }),
  t({
    id: "career-portfolio-social", pillar: "skills", audience: "tech", market: "ALL",
    title: "📸 Thợ nail tự xây kênh cá nhân: 5 bước để khách tự tìm tới bạn",
    bullets: [
      "Chụp mọi bộ móng đẹp: cùng 1 góc, ánh sáng tự nhiên, nền trơn — kênh nhìn chuyên nghiệp.",
      "Đăng đều 3–4 lần/tuần, video ngắn 10–15 giây quá trình làm thu hút hơn ảnh tĩnh.",
      "Ghi rõ thành phố + tiệm trong phần giới thiệu để khách địa phương tìm thấy.",
      "Trả lời bình luận, tin nhắn trong ngày.",
      "Đăng ảnh lên mục Khoe tay nghề trên PawNail — chủ tiệm đang tìm thợ cũng xem mục này.",
    ],
    cta: "💬 Kênh nào mang khách cho bạn nhiều nhất: Instagram, TikTok hay Facebook? Bình luận chia sẻ nha!",
    tags: "#ThoNail #Portfolio #MarketingTiemNail",
  }),
  t({
    id: "career-regulars", pillar: "skills", audience: "tech", market: "ALL",
    title: "⭐ Biến khách vãng lai thành khách quen: 5 thói quen của thợ có thu nhập ổn định",
    bullets: [
      "Nhớ tên khách và gọi tên khi chào lần sau.",
      "Hẹn luôn lịch dặm trước khi khách về: \"See you in 2–3 weeks?\"",
      "Ghi chú màu, dáng, độ dài khách thích — lần sau khỏi hỏi lại.",
      "Làm đúng giờ đã hẹn — khách bận rộn nhớ nhất là chuyện bị bắt chờ.",
      "Sửa miễn phí trong vài ngày nếu bị lỗi — mất 10 phút, giữ được khách cả năm.",
    ],
    cta: "💬 Bạn đang có bao nhiêu khách quen? Bình luận chia sẻ bí quyết giữ khách của bạn.",
    tags: "#KhachQuen #ThoNail #TiemNail",
  }),
  t({
    id: "career-income-log", pillar: "skills", audience: "tech", market: "ALL",
    title: "🧾 Ghi thu nhập & tip mỗi tối: 2 phút giúp bạn không bị tính thiếu lương",
    bullets: [
      "Ghi ngay sau ca: số khách, tiền turn, tip tiền mặt, tip qua thẻ.",
      "Cuối tuần so với phiếu lương/check — sai là thấy liền, hỏi chủ khi chuyện còn mới.",
      "Giữ lại sổ cả năm: lúc khai thuế đỡ phải nhớ lại từ đầu.",
      "Dùng công cụ Thu nhập & Tip miễn phí trên PawNail để ghi nhanh trên điện thoại.",
    ],
    cta: "🔁 Gửi cho bạn thợ hay \"không biết tiền đi đâu hết\" 😄",
    tags: "#ThuNhapThoNail #Tip #ThoNail",
  }),

  // ---------- 🏪 Quản lý tiệm ----------
  t({
    id: "owner-keep-techs", pillar: "owner", audience: "owner", market: "ALL",
    title: "🏪 Giữ thợ giỏi không chỉ bằng lương: 5 điều thợ nói ra khi nghỉ việc",
    bullets: [
      "Chia turn không công bằng — dùng bảng turn rõ ràng, ai cũng nhìn thấy.",
      "Trả lương, trả tip chậm hoặc không rõ — trả đúng hẹn, có phiếu chi tiết.",
      "Bị nói nặng trước mặt khách — góp ý riêng, khen trước mặt mọi người.",
      "Không có ngày nghỉ ổn định — xếp lịch trước ít nhất 1 tuần.",
      "Không được học thêm — cho thợ thử kỹ thuật mới vào giờ vắng.",
    ],
    cta: "💬 Chủ tiệm: bạn giữ thợ bằng cách nào hiệu quả nhất? Thợ: điều gì làm bạn ở lại lâu? Bình luận nha!",
    tags: "#ChuTiemNail #QuanLyTiem #GiuTho",
  }),
  t({
    id: "owner-price-board", pillar: "owner", audience: "owner", market: "ALL",
    title: "💲 Bảng giá rõ ràng = bớt cãi nhau với khách và giữa thợ với nhau",
    bullets: [
      "Ghi giá từng dịch vụ + giá cộng thêm (design, dài thêm, tháo bột cũ) — tránh \"báo miệng\".",
      "Treo bảng giá chỗ khách thấy trước khi ngồi vào bàn.",
      "Thống nhất cách tính cho thợ: dịch vụ thêm tính vào turn của ai.",
      "Cập nhật bảng giá trên Google/Facebook của tiệm cho khớp.",
      "Tăng giá thì báo trước khách quen 2–4 tuần.",
    ],
    cta: "🔁 Chủ tiệm lưu lại. Bạn tính phí tháo bột cũ bao nhiêu? Bình luận tham khảo nha.",
    tags: "#ChuTiemNail #BangGia #QuanLyTiem",
  }),
  t({
    id: "owner-onboarding", pillar: "owner", audience: "owner", market: "ALL",
    title: "🗂️ Ngày đầu của thợ mới: checklist 15 phút giúp thợ ở lại lâu",
    bullets: [
      "Giới thiệu thợ với cả tiệm, chỉ chỗ để đồ, chỗ nghỉ.",
      "Giải thích bảng turn, cách tính lương & tip, ngày trả lương.",
      "Đưa bảng giá, quy trình vệ sinh, cách đón khách của tiệm.",
      "Giao khách dễ trước để thợ quen tay, quen tiệm.",
      "Cuối ngày hỏi 1 câu: \"Hôm nay có gì chưa ổn không?\"",
    ],
    cta: "💬 Tiệm bạn có \"luật bất thành văn\" nào thợ mới hay bỡ ngỡ? Bình luận nha.",
    tags: "#ChuTiemNail #ThoMoi #QuanLyTiem",
  }),
  t({
    id: "owner-reviews", pillar: "owner", audience: "owner", market: "ALL",
    title: "⭐ Trả lời review 1 sao trên Google: mẫu câu biến khách giận thành khách quay lại",
    bullets: [
      "Trả lời trong 24–48 giờ, giọng bình tĩnh — khách mới đọc cách bạn trả lời hơn là đọc lời chê.",
      "Mẫu: \"We're sorry your visit didn't meet expectations. Please call us so we can make it right.\"",
      "Không cãi, không kể lỗi của khách công khai.",
      "Mời khách quay lại sửa miễn phí — nhiều khách sửa review sau khi được chăm sóc.",
      "Nhắc khách hài lòng để lại review — review tốt mới đẩy review xấu xuống.",
    ],
    cta: "🔁 Lưu mẫu câu này cho lần sau. Chia sẻ cho chủ tiệm bạn quen.",
    tags: "#ChuTiemNail #Review #MarketingTiemNail",
  }),
  t({
    id: "owner-promos", pillar: "owner", audience: "owner", market: "ALL",
    title: "📣 Khuyến mãi mà không phá giá: 5 cách tiệm đông khách hay dùng",
    bullets: [
      "Tặng thêm thay vì giảm giá: mua tay + chân tặng 1 móng design.",
      "Ưu đãi giờ vắng (đầu tuần, buổi trưa) thay vì giảm cả tuần.",
      "Thẻ tích điểm: làm 5 lần tặng 1 lần sơn thường.",
      "Giới thiệu bạn mới: cả 2 cùng được ưu đãi nhỏ.",
      "Gift card dịp lễ — có tiền trước, khách mới tự tìm tới.",
    ],
    cta: "💬 Chiêu nào hiệu quả nhất ở tiệm bạn? Bình luận để chủ tiệm khác tham khảo.",
    tags: "#ChuTiemNail #KhuyenMai #MarketingTiemNail",
  }),
  t({
    id: "owner-slow-days", pillar: "owner", audience: "owner", market: "ALL",
    title: "🌧️ Ngày vắng khách: 5 việc nên làm thay vì ngồi chờ",
    bullets: [
      "Nhắn khách cũ lâu chưa quay lại (danh sách 4–6 tuần trước).",
      "Chụp ảnh mẫu mới, đăng mạng xã hội và mục Khoe tay nghề trên PawNail.",
      "Cho thợ tập kỹ thuật mới trên tay giả.",
      "Vệ sinh tổng thể, kiểm kê supply.",
      "Cập nhật giờ mở cửa, ảnh tiệm trên Google Maps.",
    ],
    cta: "🔁 Gửi cho chủ tiệm và quản lý. Tiệm bạn vắng nhất ngày nào trong tuần?",
    tags: "#ChuTiemNail #QuanLyTiem",
  }),

  // ---------- 🛡️ An toàn ----------
  t({
    id: "safety-moving-state", pillar: "safety", audience: "tech", market: "US",
    title: "🚗 Bay sang bang khác làm nail: checklist trước khi nhận lời",
    bullets: [
      "Xin địa chỉ tiệm, gọi video xem tiệm thật — tra tên tiệm trên Google Maps và review.",
      "Hỏi rõ: chỗ ở (riêng/chung, có trừ lương không), bao lương bao lâu, chia turn sau đó.",
      "Kiểm tra giấy phép hành nghề ở bang mới — mỗi bang có quy định riêng.",
      "Không chuyển tiền cọc, không gửi giấy tờ gốc cho người lạ.",
      "Báo cho người thân địa chỉ, số điện thoại tiệm và người đón.",
    ],
    cta: "🔁 Gửi cho bạn thợ đang tính đổi bang. Xem việc có bao chỗ ở trên tab Việc gấp nha.",
    tags: "#AnToan #DoiBang #ThoNail",
  }),
  t({
    id: "safety-payment-scams", pillar: "safety", audience: "all", market: "ALL",
    title: "🔐 Lừa đảo nhắm vào tiệm nail: 4 chiêu hay gặp và cách nhận ra",
    bullets: [
      "\"Khách\" đặt gift card số lớn, nhờ chuyển dư lại tiền — thường là thẻ ăn cắp.",
      "Tin nhắn giả ngân hàng / app thanh toán đòi mã xác minh — không bao giờ đọc mã cho ai.",
      "Người tự xưng \"thanh tra\" gọi đòi đóng phạt qua chuyển khoản — gọi lại số chính thức để kiểm tra.",
      "Tuyển thợ \"lương cao bất thường\" đòi đóng phí trước — tiệm thật không thu phí.",
    ],
    cta: "🔁 Chia sẻ cho cả tiệm — một tin nhắn cảnh giác có thể giữ lại cả tháng doanh thu.",
    tags: "#AnToan #LuaDao #TiemNail",
  }),

  // ---------- 🇦🇺 Úc ----------
  t({
    id: "au-payslip", pillar: "skills", audience: "tech", market: "AU",
    title: "🇦🇺 Làm nail ở Úc: đọc payslip để biết mình được trả đúng chưa",
    bullets: [
      "Payslip nên có: tên chủ (ABN), số giờ làm, mức lương theo giờ, tổng lương, thuế đã khấu trừ.",
      "Kiểm tra dòng superannuation — tiền hưu chủ đóng cho bạn.",
      "Ghi giờ làm của mình mỗi ngày để đối chiếu.",
      "Thấy sai: hỏi chủ trước bằng tin nhắn; cần thêm thông tin thì xem trang của Fair Work.",
    ],
    cta: "🔁 Gửi cho bạn thợ mới qua Úc. Bạn được trả theo giờ hay theo tuần?",
    tags: "#LamNailOUc #Payslip #ThoNail",
  }),
];
