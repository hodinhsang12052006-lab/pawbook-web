// Bảng dịch THUẦN (không đọc ngôn ngữ đang chọn) — an toàn cho route handler và
// mọi code máy chủ: app/api/** chỉ import file này, không import lib/i18n/tr.
// Bản tiếng Anh cho NỘI DUNG do app sinh ra (chủ đề Studio, mẹo mỗi ngày, câu
// hỏi Nhịp đau, khảo sát chủ tiệm, dữ liệu Nail Radar…). Dữ liệu gốc giữ
// tiếng Việt (máy chủ, DB, Lead Radar dùng); chỉ lúc HIỂN THỊ mới đổi:
//   dt("Mùa Halloween") → "Halloween season" khi đang ở chế độ EN.
// Chuỗi không có trong bảng hiển thị nguyên văn.
const EN: Record<string, string> = {
  // ---- Chủ đề Studio theo mùa (lib/contentEngine.ts) ----
  "Mùa Halloween": "Halloween season",
  'Tháng khách thích móng "chơi" nhất năm — đen nhám, cam bí ngô, mắt mèo, nhện mạng.': "The month clients want their most playful nails — matte black, pumpkin orange, cat eye, spider webs.",
  "Đen nhám + mạng nhện bạc": "Matte black + silver spider web",
  "Cam bí ngô ombre": "Pumpkin orange ombre",
  "Mắt mèo xanh rêu": "Moss green cat eye",
  "Ma trắng 3D mini": "Mini 3D white ghosts",
  'Làm "Spooky set" cố định 3 mẫu, giá trọn gói — khách chọn nhanh, thợ làm nhanh, tăng vòng khách cuối tuần.': 'Offer a fixed 3-design "Spooky set" at one price — clients choose fast, techs work fast, more weekend turns.',
  "Móng mùa thu": "Fall nails",
  "Burgundy, nâu caramel, đồi mồi (tortoise) và nhũ vàng đồng đang lên ngôi.": "Burgundy, caramel brown, tortoiseshell and bronze shimmer are trending.",
  "Burgundy bóng gương": "Glossy burgundy",
  "Đồi mồi tortoise": "Tortoiseshell",
  "Nâu caramel + viền vàng": "Caramel brown + gold trim",
  "Ombre cam cháy": "Burnt orange ombre",
  "Đổi bảng màu trưng bày sang tông ấm — khách nhìn thấy màu mới là muốn đổi màu.": "Switch your color display to warm tones — when clients see new colors, they want to change.",
  "Lễ Tạ Ơn & Black Friday": "Thanksgiving & Black Friday",
  "Tuần đông khách nhất trước mùa lễ — khách đặt lịch sớm cho tiệc gia đình.": "The busiest week before the holidays — clients book early for family gatherings.",
  "Nâu kem + lá phong": "Cream brown + maple leaf",
  "French viền vàng đồng": "Bronze-tip French",
  "Nhũ champagne": "Champagne shimmer",
  "Bán gift card Black Friday (mua $100 tặng $15) — có tiền trước, khách quay lại sau lễ.": "Sell Black Friday gift cards (buy $100, get $15) — cash up front, clients return after the holidays.",
  "Giáng Sinh": "Christmas",
  "Đỏ nhung, xanh thông, nhũ vàng và bông tuyết — mùa cao điểm tip của năm.": "Velvet red, pine green, gold shimmer and snowflakes — the year's peak tip season.",
  "Đỏ nhung velvet": "Velvet red",
  "Bông tuyết trắng trên nền xanh": "White snowflakes on green",
  "Nhũ vàng full": "Full gold glitter",
  "Kẹo gậy sọc đỏ": "Candy cane stripes",
  "Mở thêm giờ tối thứ 6–7 trong 2 tuần trước Noel; nhắc khách đặt lịch sớm qua tin nhắn.": "Add Friday–Saturday evening hours in the 2 weeks before Christmas; remind clients to book early by text.",
  "Năm Mới": "New Year",
  'Chrome bạc, nhũ lấp lánh và đá nhỏ — móng "đi tiệc" đếm ngược.': "Silver chrome, glitter and tiny gems — countdown party nails.",
  "Chrome bạc gương": "Mirror silver chrome",
  "Nhũ khói (smoky glitter)": "Smoky glitter",
  "Đen + đá nhỏ": "Black + tiny gems",
  "Đăng ảnh mẫu đếm ngược mỗi ngày trên bảng tin — khách lưu ảnh mang tới tiệm.": "Post a countdown design every day on the feed — clients save the photo and bring it in.",
  "Tết Nguyên Đán": "Lunar New Year",
  "Đỏ may mắn, vàng sang, hoa mai — hoa đào: mẫu được yêu thích dịp Tết Nguyên đán.": "Lucky red, rich gold, apricot and peach blossoms — a Lunar New Year favorite.",
  "Đỏ son + nhũ vàng": "Lacquer red + gold shimmer",
  "Hoa mai vẽ tay": "Hand-painted apricot blossoms",
  "Hoa đào hồng phấn": "Blush peach blossoms",
  "Bao lì xì mini": "Mini red envelopes",
  "Lì xì nhỏ (voucher $5) cho khách quen dịp Tết — rẻ mà khách nhớ tiệm cả năm.": "Give regulars a small lucky envelope ($5 voucher) for Lunar New Year — cheap, and they remember you all year.",
  "Valentine": "Valentine's Day",
  "Hồng, đỏ, trái tim và french màu — tuần đặt lịch cặp đôi & bạn thân.": "Pink, red, hearts and colored French tips — the week couples and besties book together.",
  "French hồng + tim nhỏ": "Pink French + tiny hearts",
  "Đỏ cherry bóng": "Glossy cherry red",
  "Tráng gương hồng (glazed)": "Glazed pink",
  'Gói "Bestie set" 2 người giảm 10% — khách tự rủ thêm khách mới.': 'A "Bestie set" for 2 at 10% off — clients bring new clients themselves.',
  "Pastel mùa xuân": "Spring pastels",
  "Pastel sữa, hoa nhí, french màu — nhẹ nhàng, dễ bán cho khách văn phòng.": "Milky pastels, tiny flowers, colored French — soft and easy to sell to office clients.",
  "Pastel 5 ngón 5 màu": "Five-color pastel set",
  "Hoa cúc nhí": "Tiny daisies",
  "Đặt mẫu pastel ngay quầy lễ tân — mẫu dễ, thợ mới cũng làm đẹp, tăng công suất.": "Display pastel samples at the front desk — easy designs even new techs do well, more capacity.",
  "Mùa Prom": "Prom season",
  "Học sinh cuối cấp đi prom — móng dài, đá, phối màu theo váy.": "Seniors heading to prom — long nails, gems, colors matched to the dress.",
  "Coffin dài + đá": "Long coffin + gems",
  "Phối màu theo váy": "Matched to the dress",
  "Nhận đặt lịch nhóm (3–5 bạn) giờ chiều sau giờ học — lấp giờ vắng.": "Take group bookings (3–5 friends) after school — fills slow afternoon hours.",
  "Ngày của Mẹ": "Mother's Day",
  "Tuần gift card bán chạy nhất năm — con cái mua tặng mẹ.": "The best gift-card week of the year — kids buy them for mom.",
  "Nude sang + hoa nhỏ": "Elegant nude + small flowers",
  "French cổ điển": "Classic French",
  "Hồng đất thanh lịch": "Elegant dusty rose",
  "Gift card in đẹp để sẵn ở quầy + nhắc trên bảng tin: khách mua tặng là khách mới cho tiệm.": "Keep nicely printed gift cards at the desk and mention them on the feed — every gift is a new client.",
  "Mùa cưới": "Wedding season",
  "Cô dâu, phù dâu và khách dự tiệc — đặt lịch trước, làm theo nhóm.": "Brides, bridesmaids and guests — booked ahead, done as a group.",
  "French ngọc trai": "Pearl French",
  "Trắng sữa + đá": "Milky white + gems",
  "Nude bóng gương": "Glossy nude",
  'Gói "Bridal party" trọn nhóm, đặt cọc trước — doanh thu chắc, ít huỷ lịch.': 'A full-group "Bridal party" package with a deposit — reliable revenue, fewer cancellations.',
  "Móng mùa hè": "Summer nails",
  "Neon, trái cây, sóng biển — khách đi du lịch làm móng chân nhiều gấp đôi.": "Neon, fruit, ocean waves — traveling clients book twice as many pedicures.",
  "Trái cây vẽ tay": "Hand-painted fruit",
  "Sóng biển xanh ngọc": "Turquoise waves",
  "Pedicure màu kẹo": "Candy-color pedicure",
  "Combo tay + chân mùa hè — khách đi biển gần như luôn làm cả chân.": "Summer mani + pedi combo — beachgoers almost always do both.",
  "Tựu trường": "Back to school",
  "Móng ngắn gọn gàng, màu trơn bền — học sinh, sinh viên & phụ huynh.": "Short, neat nails in long-lasting solids — students and parents.",
  "Ngắn tròn màu trơn": "Short round solids",
  "Kẻ caro nhỏ": "Mini plaid",
  "Nude bền màu": "Long-wear nude",
  "Ưu đãi sinh viên giờ vắng (thứ 2–4) — lấp lịch trống, tạo khách quen dài hạn.": "Student deals on slow days (Mon–Wed) — fills the schedule and builds regulars.",
  // Mẹo Studio
  "Chụp ảnh móng dưới ánh sáng tự nhiên gần cửa sổ — lên đúng màu, chuyên nghiệp hơn đèn vàng.": "Shoot nails in natural light near a window — colors look true and more professional than under warm lamps.",
  "Đăng ít nhất 3 ảnh tay nghề rõ nét — chủ tiệm xem ảnh trước khi nhắn tin.": "Post at least 3 sharp photos of your work — salons look at your photos before they message.",
  "Bật trạng thái \"Sẵn sàng nhận việc ngay\" khi cần việc — hồ sơ của bạn được hiện trước cho chủ tiệm.": "Turn on \"Available now\" when you're looking — your profile is listed first for salons.",
  "Trước khi nhận việc, hỏi rõ cách chia turn và tip tiền mặt hay qua thẻ — ghi lại bằng tin nhắn.": "Before accepting, ask how turns are split and whether tips are cash or card — keep it in writing.",
  'Không chuyển tiền đặt cọc cho bất kỳ ai để "giữ chỗ làm" — tiệm thật không bao giờ yêu cầu.': 'Never pay anyone a deposit to "hold a job" — real salons never ask for one.',
  "Ghi turn + tip mỗi tối trong \"Thu nhập & tip\" — cuối tuần đối chiếu với phiếu lương.": "Log turns + tips each night in \"Income & tips\" — then check them against your paycheck at the end of the week.",
  "Thêm hashtag kỹ năng (#GelX #Dip #Bot) khi đăng bài — chủ tiệm tìm thợ theo đúng kỹ năng đó.": "Add skill hashtags (#GelX #Dip #Acrylic) to your posts — salons search for techs by those skills.",
  'Trả lời tin nhắn tiệm trong 1 giờ — bạn sẽ nhận huy hiệu "Phản hồi nhanh" trên hồ sơ.': 'Reply to salons within an hour — you\'ll earn the "Fast replies" badge on your profile.',
  "Xem Nail Radar trước khi chuyển sang bang mới — biết mức bao lương để thương lượng tự tin.": "Check Nail Radar before moving to a new state — know the going pay and negotiate with confidence.",
  "Video ngắn 10 giây quay tay đang làm mẫu cho tiệm thấy rõ kỹ thuật của bạn.": "A 10-second video of you working shows salons your technique.",
  "Ghi rõ lương + chia turn ngay trong tin tuyển — thợ biết ngay tin có phù hợp hay không.": "State pay and commission right in the job post — techs can tell right away if it's a fit.",
  "Gắn nhãn \"Cần gấp\" khi thiếu thợ — thợ cùng bang nhận thông báo trên điện thoại.": "Label your post \"Urgent\" when you're short-staffed — techs in your state get a notification.",
  "Trả lời thợ trong 1 giờ để có huy hiệu \"Phản hồi nhanh\" — thợ giỏi thường cân nhắc nhiều lời mời cùng lúc.": "Reply to techs within an hour to earn \"Fast replies\" — good techs often weigh several offers at once.",
  'Đăng 3–5 ảnh "Khoe tiệm" (không gian, ghế, đèn) — thợ chọn tiệm bằng mắt trước khi gọi.': "Post 3–5 salon photos (space, chairs, lighting) — techs choose with their eyes before calling.",
  'Điền "Chính sách tiệm" (chia turn, loại khách, chỗ ở) — trả lời trước câu hỏi thợ nào cũng hỏi.': 'Fill in "Salon policy" (commission, clientele, housing) — answer what every tech asks before they ask.',
  "So mức lương với Nail Radar của bang trước khi đăng — để đặt mức lương cạnh tranh.": "Compare pay with your state's Nail Radar before posting, so your rate is competitive.",
  "Đánh giá thợ sau khi làm việc — đánh giá 2 chiều giúp thợ và tiệm tin nhau hơn.": "Review techs after working together — two-way reviews help techs and salons trust each other.",
  "Thêm ảnh hoặc video tiệm vào tin tuyển — thợ hình dung được nơi làm trước khi gọi.": "Add salon photos or a video to your job post — techs can picture the workplace before they call.",
  "Ghi quyền lợi cụ thể (bao ăn ở, đưa đón) — thợ ở xa quyết định dựa trên chỗ ở.": "List concrete benefits (housing, meals, rides) — out-of-town techs decide on housing.",
  "Nhắn tin chào thợ bằng tên + 1 câu về tiệm — lời chào riêng tự nhiên hơn tin nhắn chung chung.": "Greet techs by name plus one line about your salon — a personal note reads better than a generic message.",

  // ---- Mẹo hôm nay (lib/dailyTips.ts) ----
  "Ảnh tay nghề là ấn tượng đầu tiên": "Your photos make the first impression",
  "Chụp móng dưới ánh sáng tự nhiên, nền trơn, cận cảnh 1 bàn tay. Chủ tiệm lướt rất nhanh — ảnh rõ nét giúp tay nghề của bạn nổi bật.": "Shoot in natural light on a plain background, one hand up close. Salons scroll fast — sharp photos make your work stand out.",
  "Hỏi rõ cách chia turn": "Ask how turns are split",
  "Trước khi nhận việc, hỏi tiệm chia turn theo thứ tự hay theo khách quen, tip trả tiền mặt hay qua thẻ, và trừ phí thẻ bao nhiêu %.": "Before accepting, ask whether turns go in order or by regulars, whether tips are cash or card, and what card fee is deducted.",
  "Ghi thu nhập mỗi tối": "Log your earnings nightly",
  "Dùng Bảng tính thu nhập để ghi turn + tip ngay sau ca. Cuối tuần đối chiếu phiếu lương sẽ biết ngay có bị tính thiếu không.": "Use the income tracker to log turns + tips after each shift. At week's end you'll spot any underpayment right away.",
  "Bật trạng thái \"Sẵn sàng nhận việc ngay\"": "Turn on \"Available now\"",
  "Hồ sơ ở trạng thái này được hiện trước cho chủ tiệm đang tìm thợ trong khu vực của bạn.": "Profiles with this status are listed first for salons looking for techs in your area.",
  "Xem Nail Radar trước khi dời bang": "Check Nail Radar before moving states",
  "So mức bao lương và tỉ lệ chia giữa các bang để thương lượng có cơ sở, tránh nhận mức thấp hơn mặt bằng.": "Compare guaranteed pay and commission across states so you negotiate from facts, not below market.",
  "Trả lời tin nhắn trong 1 giờ": "Reply within an hour",
  "Tiệm đang cần người thường liên hệ thợ trả lời sớm. Bật thông báo để không lỡ tin.": "Salons that need someone soon tend to follow up with techs who reply early. Turn on notifications so you don't miss a message.",
  "Giữ an toàn khi đi làm xa": "Stay safe working out of town",
  "Hỏi kỹ chỗ ở, xe đưa đón và thoả thuận lương bằng tin nhắn trong app để có bằng chứng khi cần.": "Confirm housing, rides and pay by in-app message so you have a record if needed.",
  "Ghi rõ mức lương": "Show the pay",
  "Ghi cụ thể \"$1,200–1,500/tuần\" hoặc \"60/40\" thay vì \"thoả thuận\" — thợ biết ngay tin có phù hợp hay không.": "Write \"$1,200–1,500/week\" or \"60/40\" instead of \"negotiable\" — techs can tell right away if it's a fit.",
  "Nêu rõ quyền lợi": "Spell out the benefits",
  "Chỗ ở, xe đưa đón, hỗ trợ đổi bang là lý do lớn để thợ chọn tiệm của bạn thay vì tiệm bên cạnh.": "Housing, rides and relocation help are big reasons techs pick your salon over the one next door.",
  "Đăng ảnh tiệm thật": "Post real salon photos",
  'Bài "Khoe tay nghề / tiệm" với ảnh không gian tiệm sạch đẹp giúp thợ tin tưởng trước khi gọi.': "A showcase post with clean, bright salon photos builds trust before techs call.",
  "Phản hồi trong ngày": "Reply the same day",
  "Thợ giỏi thường nhận nhiều lời mời cùng lúc. Nhắn lại trong vài giờ đầu giúp bạn giữ được người.": "Great techs get several offers at once. Replying within a few hours keeps them with you.",
  "Tham khảo Nail Radar": "Check Nail Radar",
  "Đặt mức lương sát mặt bằng bang của bạn để tin không bị lướt qua.": "Set pay close to your state's going rate so your post doesn't get skipped.",
  "Cập nhật chính sách tiệm": "Update your salon policy",
  "Chính sách chia turn và loại khách hiển thị trên hồ sơ — thợ hợp ý sẽ tự tìm đến.": "Your commission policy and clientele show on your profile — the right techs will come to you.",
  "Đánh giá thợ sau khi làm việc": "Review techs after working together",
  "Đánh giá công bằng giúp cộng đồng minh bạch và tăng uy tín cho chính tiệm của bạn.": "Fair reviews keep the community transparent and build your salon's reputation.",

  // ---- Nhịp đau tuần (lib/painPulse.ts) ----
  "Điều làm thợ mệt nhất tuần này": "What wore techs out most this week",
  "Tuần này điều gì làm bạn mệt nhất ở tiệm?": "What wore you out most at the salon this week?",
  "Chia turn không công bằng": "Unfair turn sharing",
  "Lương / tip trả trễ": "Late pay / tips",
  "Ít khách, ngồi chờ": "Few clients, lots of waiting",
  "Làm quá giờ, không nghỉ": "Overtime, no breaks",
  "Đồng nghiệp khó chịu": "Difficult coworkers",
  "Mọi thứ ổn 👍": "All good 👍",
  "Kỹ năng thợ muốn học nhất": "Skills techs most want to learn",
  "Bạn muốn học thêm kỹ năng nào nhất?": "Which skill do you most want to learn?",
  "Design vẽ tay": "Hand-painted art",
  "Lý do thợ đổi tiệm": "Why techs switch salons",
  "Điều gì sẽ khiến bạn chuyển sang tiệm mới?": "What would make you move to a new salon?",
  "Lương cao hơn": "Higher pay",
  "Chia turn công bằng": "Fair turn sharing",
  "Gần nhà / có chỗ ở": "Close to home / housing",
  "Chủ tiệm tôn trọng": "A respectful owner",
  "Khách sang, tip cao": "Upscale clients, high tips",
  "Không muốn đổi": "Not looking to switch",
  "Kiểu móng khách chọn nhiều nhất tuần này": "Most-requested nails this week",
  "Tuần này khách hay chọn kiểu móng nào nhất?": "Which nails did clients ask for most this week?",
  "Gel-X dài": "Long Gel-X",
  "Dip màu trơn": "Solid dip",
  "Chrome / mắt mèo": "Chrome / cat eye",
  "Design theo mùa": "Seasonal designs",
  "Móng ngắn tự nhiên": "Short natural nails",
  "Điều làm chủ tiệm đau đầu nhất tuần này": "Owners' biggest headache this week",
  "Tuần này tiệm đau đầu nhất chuyện gì?": "What was your salon's biggest headache this week?",
  "Thiếu thợ giỏi": "Not enough skilled techs",
  "Thợ nghỉ ngang": "Techs quitting suddenly",
  "Khách vắng đầu tuần": "Slow early-week traffic",
  "Giá vật tư tăng": "Rising supply costs",
  "Review xấu online": "Bad online reviews",
  "Giấy tờ / thuế": "Paperwork / taxes",
  "Kỹ năng chủ tiệm đang thiếu thợ nhất": "Skills salons are shortest on",
  "Tiệm bạn đang thiếu thợ kỹ năng nào nhất?": "Which skill is your salon shortest on?",
  "Bột / Acrylic": "Acrylic",
  "Chân tay nước": "Mani-pedi",
  "Cách chủ tiệm giữ chân thợ": "How owners keep their techs",
  "Bạn đang giữ chân thợ bằng cách nào?": "How do you keep your techs?",
  "Tăng % ăn chia": "Higher commission %",
  "Bao lương": "Guaranteed pay",
  "Chia turn tự động": "Automatic turn sharing",
  "Lo chỗ ở": "Providing housing",
  "Thưởng theo doanh số": "Sales bonuses",
  "Chưa có cách nào": "Nothing yet",
  "Kênh mang khách mới nhiều nhất": "Top channels for new clients",
  "Kênh nào mang khách mới cho tiệm nhiều nhất?": "Which channel brings your salon the most new clients?",
  "Khách quen giới thiệu": "Referrals from regulars",
  "Khách vãng lai": "Walk-ins",
  "Kênh khác": "Other channels",

  // ---- Khảo sát chủ tiệm (lib/ownerSurvey.ts) ----
  "Đặt lịch tự động": "Auto booking",
  "Chia turn & tip": "Turns & tips",
  "Vật tư & hóa đơn": "Supplies & receipts",
  "Chấm công & hoàn tiền": "Time clock & refunds",
  "Chăm sóc khách & QR": "Client care & QR",
  "Đặt lịch thông minh & tự khóa lịch": "Smart booking & automatic slot locking",
  "Cuối tuần đông khách, lịch hẹn có hay bị trùng giờ khiến khách phải chờ lâu không?": "On busy weekends, do appointments overlap and leave clients waiting?",
  "Có, ghi sổ hoặc nhắn tin dễ bị sót lịch.": "Yes — paper books and text messages make it easy to miss bookings.",
  "Tiệm đã có hệ thống tự khóa lịch khi thợ bận, không bị trùng giờ.": "We already use a system that locks a tech's slot while they're busy.",
  "Chia turn & tính tip minh bạch": "Fair turn sharing & clear tip records",
  "Chia turn và tip trong tiệm có rõ ràng, công bằng với thợ không?": "Is turn sharing and tip tracking at your salon clear and fair for techs?",
  "Chưa, đang chia bằng tay nên dễ nhầm và mất thời gian.": "Not yet — we split by hand, which takes time and leads to mistakes.",
  "Có, tiệm dùng bảng chia turn tự động, thợ tự xem được.": "Yes — we use an automatic turn board that techs can check themselves.",
  "Theo dõi chi phí vật tư & in hóa đơn": "Supply cost tracking & printed receipts",
  "Bạn có theo dõi được chi phí vật tư (bột, gel, đá…) theo từng dịch vụ không?": "Can you see what supplies (powder, gel, gems…) each service costs you?",
  "Chưa, đang ghi tay nên tốn thời gian và khó biết chính xác.": "Not yet — we track it by hand, which is slow and hard to get right.",
  "Có, tiệm theo dõi chi phí vật tư và in hóa đơn cho từng khách.": "Yes — we track supply costs and print a receipt for every client.",
  "Chấm công & xử lý hoàn tiền": "Time clock & refund handling",
  "Tiệm theo dõi giờ làm của thợ và xử lý yêu cầu hoàn tiền của khách thế nào?": "How does your salon track techs' hours and handle refund requests?",
  "Chưa có cách theo dõi rõ ràng; hoàn tiền xử lý tùy từng trường hợp.": "No clear system yet — refunds are handled case by case.",
  "Thợ chấm công tại tiệm; có mã hóa đơn rõ ràng khi khách yêu cầu hoàn tiền.": "Techs clock in at the salon, and every receipt has a clear code for refund requests.",
  "Check-in bằng mã QR, chăm sóc khách & nhắc lịch dặm": "QR check-in, client care & refill reminders",
  "Những ngày vắng khách (Thứ 2 – Thứ 4), tiệm làm gì để mời khách cũ quay lại?": "On slow days (Mon–Wed), how do you invite past clients back?",
  "Chủ yếu chờ khách vãng lai, chưa có ai nhắn tin cho khách cũ.": "Mostly we wait for walk-ins — nobody has time to message past clients.",
  "Có hệ thống tự gửi tin nhắn nhắc khách hẹn dặm lại sau 3 tuần (khách đồng ý nhận tin).": "We have a system that texts clients a refill reminder after 3 weeks (with their consent).",
  "Lịch hẹn hay bị trùng": "Overlapping appointments",
  "Lịch hẹn giờ cao điểm dễ bị trùng, thợ quá tải hoặc khách phải chờ lâu.": "Peak-hour appointments overlap, techs get overloaded and clients wait too long.",
  "Đặt lịch trực tuyến tự khóa giờ khi thợ đang có khách và gửi tin nhắn xác nhận lịch hẹn.": "Online booking that locks a tech's slot while they're with a client and texts an accurate confirmation.",
  "Báo tôi khi tính năng đặt lịch thông minh ra mắt": "Notify me when smart booking launches",
  "Chia turn & tip chưa rõ ràng": "Turn sharing and tips aren't clear",
  "Chia turn bằng tay và tính tip dễ nhầm, ảnh hưởng đến sự gắn bó của thợ.": "Manual turn sharing and tip mistakes make it harder to keep good techs.",
  "Hệ thống chia turn công bằng theo giá trị hóa đơn, tách riêng tip tiền mặt và tip thẻ trên màn hình. Thợ tự xem được.": "A system that shares turns fairly by ticket value and separates cash and card tips on screen, so techs can check for themselves.",
  "Báo tôi khi bảng chia turn ra mắt": "Notify me when the turn board launches",
  "Chưa theo dõi được chi phí vật tư": "Supply costs aren't tracked",
  "Khó biết chi phí vật tư thực tế của từng dịch vụ, tốn thời gian cộng sổ cuối tuần.": "It's hard to know what each service really costs in supplies, and weekly bookkeeping takes hours.",
  "Theo dõi chi phí vật tư theo từng dịch vụ để biết lãi thực tế; in hóa đơn cho khách bằng một chạm.": "Track supply costs per service to see your real margin, and print client receipts in one tap.",
  "Báo tôi khi tính năng theo dõi chi phí vật tư ra mắt": "Notify me when supply cost tracking launches",
  "Chấm công & hoàn tiền chưa rõ ràng": "No clear time clock or refund process",
  "Khó theo dõi giờ làm của thợ; yêu cầu hoàn tiền của khách chưa có quy trình rõ ràng.": "Techs' hours are hard to track, and refund requests have no clear process.",
  "Chấm công ngay tại tiệm; hoàn tiền và hủy dịch vụ theo mã hóa đơn rõ ràng.": "Clock in at the salon, with refunds and cancellations tied to clear receipt codes.",
  "Báo tôi khi tính năng chấm công & mã hóa đơn ra mắt": "Notify me when the time clock & receipt codes launch",
  "Chưa chăm sóc khách cũ": "Past clients aren't followed up",
  "Khách làm xong ít quay lại; những ngày Thứ 2 – Thứ 4 tiệm vắng khách.": "Clients rarely come back on their own, and Mon–Wed are slow.",
  "Check-in bằng mã QR, tích điểm theo số điện thoại và tự gửi tin nhắn nhắc khách hẹn dặm lại sau 3 tuần (khách đồng ý nhận tin).": "QR check-in with phone-number rewards, plus refill reminders after 3 weeks for clients who opt in.",
  "Báo tôi khi check-in QR & nhắc lịch dặm ra mắt": "Notify me when QR check-in & refill reminders launch",

  // ---- Nail Radar (lib/nailRadarData.ts) ----
  "Thợ Bột/Acrylic": "Acrylic tech",
  "Thợ Dip/SNS": "Dip/SNS tech",
  "Thợ Chân Tay Nước": "Mani-pedi tech",
  "Bột/Acrylic": "Acrylic",
  "Chân Tay Nước": "Mani-pedi",
  "6/4 (thợ nhận 60%) — phổ biến nhất": "6/4 (tech keeps 60%) — most common",
  "7/3 nếu thợ có sẵn khách quen đông": "7/3 if the tech brings many regulars",
  "Bao lương cố định, không chia turn theo doanh thu": "Fixed guaranteed pay, no commission split",
  "6/4 (thợ nhận 60%)": "6/4 (tech keeps 60%)",
  "Trả theo giờ + tip 100% cho thợ": "Hourly pay + 100% of tips to the tech",
  "Chủ tiệm thường lo vật tư cơ bản (bột, dung dịch); thợ tự sắm đồ nghề tay (giũa, cọ, máy mài riêng).": "Owners usually cover basic supplies (powder, liquids); techs bring their own hand tools (files, brushes, drill).",
  "Chủ tiệm thường lo vật tư cơ bản (bột dip, top/base); thợ tự sắm đồ nghề tay.": "Owners usually cover basic supplies (dip powder, top/base); techs bring their own hand tools.",
  "Chủ thường bao toàn bộ supply (sơn, dụng cụ ngâm/tẩy tế bào chết dùng chung).": "Owners usually cover all supplies (polish, shared soak and scrub tools).",
  "Xin xem ảnh/video tiệm thật (không phải ảnh mạng) trước khi quyết định bay xa.": "Ask for real photos/videos of the salon (not stock images) before flying out.",
  "Hỏi rõ được bao lương trong bao nhiêu tuần đầu và sau đó có thay đổi không.": "Ask how many weeks the guaranteed pay lasts and whether it changes after that.",
  "Xác nhận bằng tin nhắn/văn bản mức chia turn và ai bao supply — tránh thỏa thuận miệng.": "Confirm the commission split and who pays for supplies in writing — avoid verbal deals.",
  "Hỏi thẳng: tiệm đông khách loại nào (walk-in, khách hẹn, khách sang) để ước lượng tip thực tế.": "Ask directly what clients the salon gets (walk-ins, appointments, upscale) to estimate real tips.",
  "Nếu được bao chỗ ở, hỏi rõ: ở chung hay riêng, có tính phí trừ lương không.": "If housing is included, ask: shared or private, and is it deducted from pay?",
  "Hỏi lịch nghỉ, số ngày làm/tuần trước khi nhận lời — tránh hiểu lầm giờ giấc.": "Ask about days off and days per week before saying yes — avoid schedule surprises.",
  "Bao lương $___/tuần trong bao nhiêu tuần đầu?": "Guaranteed $___/week for how many weeks?",
  "Chia turn tỉ lệ bao nhiêu (6/4, 7/3...) sau giai đoạn bao lương?": "What's the commission split (6/4, 7/3…) after the guarantee ends?",
  "Ai trả tiền vật tư — chủ hay thợ?": "Who pays for supplies — owner or tech?",
  "Có chỗ ở/bao ăn ở cho thợ ở xa không? Có trừ vào lương không?": "Is housing/meals provided for out-of-town techs? Is it deducted from pay?",
  "Tiệm đông khách loại nào — walk-in hay khách hẹn trước?": "Mostly walk-ins or appointments?",
  "Lịch làm việc: mấy ngày/tuần, giờ mở-đóng cửa cụ thể?": "Schedule: how many days a week, and exact opening/closing hours?",

  // ---- Huy hiệu (lib/badges.ts) ----
  "Thành viên sáng lập": "Founding member",
  "Tham gia PawNail trước 01/01/2027": "Joined PawNail before Jan 1, 2027",
  "Phản hồi nhanh": "Fast replies",
  "Hồ sơ đầy đủ": "Complete profile",
  "Đã điền đầy đủ thông tin hồ sơ": "All profile details filled in",
  "Được yêu thích": "Community favorite",

  // ---- Nhãn vai trò, tin mồi khi đăng ký chủ tiệm ----
  "💅 Thợ Nail": "💅 Nail tech",
  "🏪 Chủ tiệm": "🏪 Salon owner",
  "Cần thợ Nail gấp": "Nail tech needed urgently",
  "Chị Linda": "Linda",
  "Anh Tony": "Tony",
  "Chị Kim": "Kim",

  // ---- Tin tuyển dụng (tiêu đề mẫu, lương) ----
  "Thỏa thuận": "Negotiable",
  "Thoả thuận": "Negotiable",
  "Tuyển thợ Gel-X kinh nghiệm": "Experienced Gel-X tech wanted",
  "Cần thợ làm ca tối/cuối tuần": "Evening/weekend tech needed",
  "Tuyển thợ chuyên Ombre/Aura": "Ombre/Aura specialist wanted",
  "Cần thợ mới ra trường, được đào tạo thêm": "New grad tech wanted — training provided",
  "Tuyển thợ kinh nghiệm lâu năm": "Seasoned nail tech wanted",
  "Cần thợ đa năng gấp": "All-round tech needed urgently",
  "Cần thợ biết Wax + Nail": "Wax + nail tech needed",
  "Tuyển thợ Design giỏi": "Skilled nail art tech wanted",
  "Cần thợ chân tay nước full-time": "Full-time mani-pedi tech needed",

  // ---- Sản phẩm Chợ Supply do PawNail đăng sẵn ----
  "Combo bao tay + khẩu trang y tế tiệm nail (100 cái)": "Salon gloves + medical masks combo (100 pcs)",
  "Đạt chuẩn y tế, bảo vệ thợ và khách khi làm bột/mài.": "Medical grade — protects techs and clients during acrylic and filing work.",
  "Khay đựng đồ nghề nail đa năng 3 tầng": "3-tier multipurpose nail tool tray",
  "Sắp xếp gọn gàng dụng cụ, khay trượt êm, dễ vệ sinh.": "Keeps tools tidy, smooth sliding trays, easy to clean.",
  "Bộ cọ vẽ nail 15 cây lông mềm cao cấp": "Premium soft nail art brush set (15 pcs)",
  "Đủ size từ vẽ chi tiết đến tô nền, cầm cân tay chuyên nghiệp.": "Every size from fine detail to base fill, professionally balanced.",
  "Bình xịt khử trùng dụng cụ nail 500ml": "Nail tool disinfectant spray 500ml",
  "Diệt khuẩn nhanh, an toàn cho da tay, mùi nhẹ dễ chịu.": "Fast-acting, gentle on hands, light pleasant scent.",
  "Miếng dán nail art 3D họa tiết mix": "Mixed 3D nail art stickers",
  "Hơn 200 họa tiết/hộp, dán nhanh không cần vẽ tay.": "200+ designs per box — quick to apply, no hand painting needed.",
  "Bộ tay giả luyện tập vẽ nail (silicone)": "Silicone practice hand for nail art",
  "Chất liệu mềm dẻo như tay thật, có thể tháo rời từng ngón.": "Soft and flexible like a real hand, with detachable fingers.",
  "Set 6 màu sơn Gel Ombre Aura Trend 2026": "6-color Ombre Aura gel set — 2026 trend",
  "Lên màu loang tự nhiên, chuẩn hiệu ứng aura đang hot.": "Natural blended color for the trending aura effect.",
  "Bàn hút bụi nail mini để bàn": "Mini tabletop nail dust collector",
  "Hút sạch bụi mài, chạy êm, tiết kiệm điện, gọn nhẹ để bàn.": "Clears filing dust, runs quiet, energy-saving, compact.",
  "Nước rửa cọ vẽ nail chuyên dụng 250ml": "Nail brush cleaner 250ml",
  "Làm sạch cọ nhanh, giữ lông cọ mềm, không xơ cứng.": "Cleans brushes fast and keeps bristles soft.",
  "Bộ cây đẩy da + kìm cắt da inox cao cấp": "Premium stainless cuticle pusher + nipper set",
  "Thép phẫu thuật, bén đều, không gỉ sau nhiều lần tiệt trùng.": "Surgical steel, evenly sharp, rust-free after repeated sterilizing.",
  "Khăn giấy lau nail + Cotton pad (Combo 500 tờ)": "Lint-free nail wipes + cotton pads (500 combo)",
  "Không xơ vải, thấm hút tốt, dùng cho tẩy trang/lau cọ.": "Lint-free and absorbent — for removing polish and wiping brushes.",
  "Sơn Chrome Mirror Powder 6 màu": "Chrome mirror powder, 6 colors",
  "Hiệu ứng gương bóng loáng, dễ lên màu, ít bụi bay.": "High-shine mirror effect, easy to apply, low dust.",
  "Máy mài nail mini không dây": "Mini cordless nail drill",
  "Pin sạc 4 tiếng, êm tay, kèm 6 đầu mài đổi được.": "4-hour rechargeable battery, smooth, with 6 interchangeable bits.",
  "Bột Dip SNS 10 màu Basic": "Basic dip (SNS) powder, 10 colors",
  "Màu basic dễ phối, bền màu 3 tuần không sứt mẻ.": "Easy-to-match basics that last 3 weeks without chipping.",
  "Bộ giũa & cọ vẽ nail chuyên nghiệp (10 món)": "Professional file & brush set (10 pcs)",
  "Thép không gỉ, cầm chắc tay, dùng bền nhiều năm.": "Stainless steel, firm grip, lasts for years.",
  "Top Coat + Base Coat Combo": "Top coat + base coat combo",
  "Bộ đôi bóng gương không ố vàng, khô nhanh trong 60s.": "Mirror-shine duo that won't yellow, dries in 60 seconds.",
  "Đèn UV/LED sấy gel 54W": "54W UV/LED gel lamp",
  "Sấy nhanh 30s, cảm ứng tự động, bảo hành 6 tháng.": "30-second cure, auto sensor, 6-month warranty.",
  "Set 50 đầu charm 3D Nail Art": "50-piece 3D nail art charm set",
  "Charm kim loại + đá pha lê, đủ hình trái tim/hoa/ngôi sao.": "Metal charms + crystals in hearts, flowers and stars.",
  "Bột Acrylic cao cấp 500g": "Premium acrylic powder 500g",
  "Bám dính tốt, không ố vàng, dùng được cho cả đắp form dài.": "Strong adhesion, non-yellowing, works for long sculpted sets.",
  "Bộ sơn Gel 12 màu Trend 2026": "12-color gel polish set — 2026 trends",
  "12 màu hot nhất mùa này, chuẩn bảng màu chrome/pastel, hàng chính hãng.": "12 popular chrome and pastel shades this season, authentic brand.",
};

// Kỹ năng trong tiêu đề tự sinh "Cần thợ Bột/Acrylic/Dip/SNS gấp" — tên kỹ năng
// có sẵn dấu "/" nên tách theo cụm dài nhất trước.
const SKILL_EN: [string, string][] = [
  ["Bột (Acrylic/Ombre)", "Acrylic/Ombre"],
  ["Bột/Acrylic", "Acrylic"],
  ["Chân tay nước", "Mani-pedi"],
  ["Chân Tay Nước", "Mani-pedi"],
  ["Mi/Lông mày", "Lashes/Brows"],
  ["Design nghệ thuật", "Nail art"],
  ["Design", "Nail art"],
  ["Dip/SNS", "Dip/SNS"],
  ["Gel-X/Biab", "Gel-X/BIAB"],
  ["Bột", "Acrylic"],
  ["Dip", "Dip"],
  ["Gel-X", "Gel-X"],
  ["Nail", "Nail"],
];

function skillsEn(s: string): string | null {
  const out: string[] = [];
  let rest = s;
  while (rest) {
    const hit = SKILL_EN.find(([vi]) => rest === vi || rest.startsWith(vi + "/"));
    if (!hit) return null;
    out.push(hit[1]);
    rest = rest.slice(hit[0].length + 1);
  }
  return out.join("/");
}

const PER_EN: Record<string, string> = { "giờ": "hr", "tuần": "wk", "tháng": "mo", "ngày": "day", "năm": "yr" };

/** Bản EN không phụ thuộc ngôn ngữ đang chọn — dùng ở máy chủ khi trả về cả 2 thứ tiếng. */
export function dtEn(vi: string): string {
  const hit = EN[vi];
  if (hit) return hit;
  // Mẫu có số: "Uy tín 4.8★", "Trung bình 4.8★ từ 12 đánh giá thật", "23 lượt thích bài đăng trong 30 ngày", "Thường trả lời tin nhắn trong ~5 phút"
  let m = vi.match(/^Uy tín ([\d.]+)★$/);
  if (m) return `Rated ${m[1]}★`;
  m = vi.match(/^Trung bình ([\d.]+)★ từ (\d+) đánh giá thật$/);
  if (m) return `Average ${m[1]}★ from ${m[2]} real reviews`;
  m = vi.match(/^(\d+) lượt thích bài đăng trong 30 ngày$/);
  if (m) return `${m[1]} post likes in 30 days`;
  m = vi.match(/^Thường trả lời tin nhắn (.+)$/);
  if (m) return `Usually replies ${responseEnText(m[1])}`;
  // Tiêu đề tin tự sinh: "Cần thợ Bột/Acrylic/Dip/SNS gấp" → "Urgent: Acrylic/Dip/SNS tech needed"
  // Mô tả tin tự tạo lúc chủ tiệm đăng ký nhanh (mẫu mới + mẫu cũ còn trên production):
  // "Audit Nails tại Dallas, TX đang tuyển thợ nail." · "… đang cần tuyển thợ nail gấp."
  m = vi.match(/^(.+?) tại (.+?), ([A-Za-z]{2,3}) đang (?:cần )?tuyển thợ nail( gấp)?\.?$/);
  if (m) return `${m[1]} in ${m[2]}, ${m[3]} is ${m[4] ? "urgently " : ""}hiring nail technicians.`;
  m = vi.match(/^Cần thợ (.+?)( gấp)?$/);
  if (m) {
    const sk = skillsEn(m[1]);
    if (sk) return m[2] ? `Urgent: ${sk} tech needed` : `${sk} tech needed`;
  }
  // Lương: "$28-32/giờ" → "$28-32/hr", "$1,300-1,600/tuần" → "$1,300-1,600/wk"
  m = vi.match(/^(Bao lương )?([$A-Z\d][^/]*)\/\s*(giờ|tuần|tháng|ngày|năm)$/);
  if (m && /\d/.test(m[2])) return `${m[1] ? "Guaranteed " : ""}${m[2]}/${PER_EN[m[3]]}`;
  // Ăn chia: "60/40 ăn chia", "Chia 6/4" → "60/40 split"
  m = vi.match(/^(?:Chia |Ăn chia )?(\d{1,2}\/\d{1,2})(?: ăn chia| chia)?$/i);
  if (m && vi !== m[1]) return `${m[1]} split`;
  return vi;
}

/** Bản EN thuần (không phụ thuộc ngôn ngữ đang chọn): "trong vài phút" / "trong ~40 phút" / "trong ~3 giờ" / "trong 1 ngày" → tiếng Anh. */
export function responseEnText(vi: string): string {
  if (vi === "trong vài phút") return "within minutes";
  if (vi === "trong 1 ngày") return "within a day";
  let m = vi.match(/^trong ~(\d+) phút$/);
  if (m) return `in ~${m[1]} min`;
  m = vi.match(/^trong ~(\d+) giờ$/);
  if (m) return `in ~${m[1]} h`;
  return vi;
}
