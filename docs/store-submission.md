# Nộp PawNail lên Google Play & App Store

Ảnh: chạy `node scripts/store/make_screenshots.mjs` → thư mục `store-assets/`
(iPhone 1290×2796 ×6, Android 1080×1920 ×6, ảnh bìa Play 1024×500, icon 512×512).

App: **PawNail** (tên app native hiện tại: "PawNail Jobs") · Bundle/Application ID: `com.bitpawos.app`
Bản native kế tiếp: **1.1.0** — Android `versionCode 2` (hoặc số lớn nhất từng tải lên Play + 1, xem App bundle explorer; KHÔNG dùng lại số cũ), iOS build = build TestFlight mới nhất + 1 (CI tự tính). Bản 1.0 (versionCode 1 / build 1) đã dùng.
App native mở thẳng https://www.bitpawos.com (hosted mode) — sửa web là app cập nhật, chỉ build lại khi đổi icon/quyền/plugin/`native-shell/` (màn mất mạng) hoặc `capacitor.config.ts`. Trước MỌI lần build native: `npm install` rồi `npx cap sync`.

---

## 1. Thông tin hiển thị (dán vào store) — bản v2, định vị nền tảng (30/10/2026)

**Định vị:** PawNail là nền tảng cho ngành nail tại Mỹ và Úc — khách thử mẫu và đặt lịch, thợ giới thiệu tay nghề và tìm nơi làm phù hợp, tiệm tuyển thợ và kín lịch hẹn. Khán giả luôn là **vai trò** (khách, thợ nail, chủ tiệm), không bao giờ là dân tộc / quốc tịch. Ngôn ngữ chỉ nhắc ở mục LANGUAGES ("English and Tiếng Việt" / "Có tiếng Anh và tiếng Việt"). Không dùng "#1", "100%", "best", "free" dạng huy hiệu, "người Việt", "Việt kiều", "hải ngoại"; "gấp" chỉ là nhãn tin "Cần gấp".

**Thương hiệu:** **PawNail** là tên chính (tiêu đề trang, bản quyền, email). Tên app native (`capacitor.config` `appName`) giữ **PawNail Jobs** tới lần build store kế tiếp; tên hiển thị trên store dùng bảng dưới.

> Chụp lại ảnh store SAU khi bản web có hero mới, dòng giới thiệu trên màn đăng nhập và tin chào mừng mới đã lên production — nếu không, ảnh sẽ mâu thuẫn với mô tả.

| | en-US | en-AU | vi |
|---|---|---|---|
| Tên Google Play (≤30) | PawNail: Nail Tech Jobs | PawNail: Nail Try-On & Hiring | PawNail: Việc Làm Nail |
| Mô tả ngắn Play (≤80) | Nail salon jobs by state & salons hiring techs. Try nail looks on your hand. | Try nail looks on your own hand. Nail bars post job ads, technicians get found. | Việc làm nail theo bang ở Mỹ, tiệm tuyển thợ. Thử mẫu nail trên chính tay bạn. |
| Tên App Store (≤30) | PawNail: Nail Tech Jobs | PawNail: Nail Try-On & Hiring | PawNail: Việc Làm Nail |
| Phụ đề App Store (≤30) | Salon hiring & nail art try-on | Nail technicians & nail bars | Tiệm cần thợ & thử mẫu nail |
| Từ khoá App Store (≤100 byte) | `manicurist,technician,booking,spa,commission,manicure,pedicure,acrylic,gel,dip,tip,tracker,hire` | `builder,gel,dipping,powder,acrylic,manicure,pedicure,designs,ideas,salon,extensions,booking,art` | `tuyen,bao,luong,chia,turn,tim,job,nails,bot,dip,gel,chan,tay,nuoc,design,cali,salon,menu` |
| Promotional text (≤170) | Nail salon jobs by state with the pay type up front, salons hiring techs, and Try-On that paints nail looks on a photo of your own hand. In English or Tiếng Việt. | Paint nail looks on a photo of your own hand, get fresh design ideas every day, and connect salons and nail bars with technicians. In English or Tiếng Việt. | Việc làm nail theo bang, gọi trực tiếp cho tiệm, tiệm đăng tin tuyển thợ, kèm Try-On vẽ mẫu nail lên ảnh chính bàn tay bạn. Dùng bằng tiếng Việt hoặc tiếng Anh. |

**Mô tả đầy đủ (tiếng Việt — Play `vi` và App Store `vi`):**
```
Đang tìm việc làm nail, hay cần tuyển thợ cho tiệm? PawNail tổng hợp tin tiệm tuyển thợ ở Mỹ theo bang, ghi rõ cách trả lương và mức lương khi tiệm có ghi. Gọi trực tiếp cho tiệm chỉ với một chạm.

PawNail là nền tảng dành cho ngành nail tại Mỹ và Úc: thợ xây dựng hồ sơ tay nghề và tìm nơi làm phù hợp, chủ tiệm tuyển thợ và nhận yêu cầu đặt lịch, khách thử mẫu trước khi đặt lịch. Dùng được bằng tiếng Việt và tiếng Anh, đổi qua lại chỉ một chạm.

DÀNH CHO THỢ NAIL
• Việc làm nail (job nail) ở Mỹ: chọn bang, tìm theo thành phố, tên tiệm hoặc kỹ năng (bột, dip, Gel-X, chân tay nước, design, wax)
• Tin ghi bao lương, ăn chia hay theo giờ, có mức lương khi tiệm ghi, kèm khu vực và quyền lợi như có chỗ ở
• Tin cần gấp có nhãn riêng; lưu tin để xem lại sau
• Tin cần gấp trong bang của bạn hiện trong mục thông báo của app
• Gọi trực tiếp cho tiệm, không mất phí môi giới; nhắn tin được với các tiệm đăng tin trên PawNail
• Hồ sơ thợ: ảnh và video tay nghề, kỹ năng, số năm kinh nghiệm, trạng thái sẵn sàng nhận việc, để tiệm tìm đến bạn
• Biết tiệm nào đã xem hồ sơ của bạn
• Sổ thu nhập & tip: ghi turn và tip từng ca, tự cộng theo tuần để đối chiếu khi nhận lương (chỉ lưu trên điện thoại của bạn)
• Nail Radar: mức lương ước tính theo bang và kỹ năng, để tham khảo khi thỏa thuận lương

DÀNH CHO CHỦ TIỆM
• Tuyển thợ nail: đăng tin kèm ảnh hoặc video, gắn nhãn cần gấp khi cần người sớm
• Nhắn tin, gọi cho thợ ngay trong app
• Xem thợ đang sẵn sàng nhận việc trong bang, có ảnh tay nghề và kỹ năng
• Làm menu dịch vụ có giá và hình, chia sẻ bằng mã QR, nhận yêu cầu đặt lịch của khách trong một hộp thư
• Thợ và tiệm đánh giá lẫn nhau
• Đăng bán đồ nghề, vật tư nail; người mua nhắn tin trực tiếp với bạn

THỬ MẪU TRÊN TAY (PawNail Try-On)
• Chụp mu bàn tay, app tự nhận móng, xem tông da và dáng móng rồi vẽ 10 mẫu gợi ý lên chính móng của bạn, giữ dáng móng thật hoặc nối dài
• Xử lý ngay trên điện thoại; ảnh tay chỉ được tải lên khi bạn gửi mẫu trong tin nhắn
• Gửi mẫu ưng ý cho thợ hoặc tiệm trong tin nhắn để hỏi giá

DÀNH CHO KHÁCH LÀM NAIL
• Gửi yêu cầu đặt lịch ngay trên menu của tiệm: chọn dịch vụ, ngày và buổi sáng, chiều hay tối; tiệm sẽ gọi hoặc nhắn lại để xác nhận
• Nhắn tin hỏi tiệm, gửi ảnh mẫu bạn thích
• Lưu mẫu yêu thích, mỗi ngày một mẹo giữ móng đẹp
• Xem các tiệm và thợ trong bang đã có menu hoặc ảnh tác phẩm trên PawNail

MẪU NAIL MỖI NGÀY
• Ý tưởng mẫu nail mới mỗi ngày, là ảnh minh hoạ (có ghi rõ), kèm giá gợi ý; thợ và chủ tiệm xem thêm vật tư và các bước làm
• Lọc theo dịp hoặc kỹ thuật
• Radar xu hướng nail, cùng tác phẩm thật do thợ và tiệm đăng

BẢNG TIN, TIN NHẮN & CUỘC GỌI
• Bảng tin: ảnh, video, bình luận, thả tim, bình chọn
• Bài đăng ẩn danh được duyệt trước khi hiện
• Nhắn tin riêng hoặc nhóm: ảnh, video, tin nhắn thoại, GIF, sticker
• Gọi thoại và gọi video với người dùng PawNail ngay trong app

AN TOÀN
• Báo cáo bài đăng và người dùng, chặn người khác ngay trong khung chat
• Tự xoá tài khoản trong app bất cứ lúc nào
• Không quảng cáo, không mua hàng trong app
• Dành cho người từ 18 tuổi trở lên

Lưu ý: tin tuyển thợ và bài đăng do người dùng tự viết. Nhiều tin việc làm do PawNail đăng lại từ quảng cáo công khai của tiệm, có nhãn "Đăng hộ tiệm" và liên hệ bằng điện thoại; tiệm có thể nhận lại tin hoặc yêu cầu gỡ. Tại Úc, mục việc làm mới bắt đầu. PawNail mới ra mắt nên danh sách tiệm và thợ sẽ tăng dần khi có thêm người tham gia. PawNail không phải công ty môi giới và không thu phí thợ hay tiệm.
```

**Full description (English, United States — Play `en-US` and App Store `en-US`):**
```
Looking for a nail salon job, or a nail tech for your salon? PawNail lists nail salon jobs by state, with the pay type and the amount when the salon lists it. Tap to call the salon.

PawNail is the platform for the nail industry in the US and Australia. Technicians build a portfolio and find their next chair, salon owners hire and take booking requests, and clients try on looks before they book.

FOR NAIL TECHS
• Nail salon jobs in the US: pick your state, then search by city, salon name or skill (acrylic, dip, Gel-X, wax, design)
• Posts show the pay type (weekly guarantee, commission split or hourly), the amount when the salon lists it, the city, and perks like housing
• Urgent openings are labeled, and you can save jobs for later
• Urgent openings in your state show up in your in-app notifications
• Tap to call the salon, with no agency fees. Chat with salons that post on PawNail
• Build a profile with a photo and video portfolio, skills, experience and availability, so salons can find you
• See which salons viewed your profile
• Income and tips tracker: log turns and tips for each shift and see your weekly total (saved on your phone only)
• Nail Radar: estimated pay ranges by state and skill, for reference when you talk pay

FOR SALON OWNERS
• Hire nail techs: post a job with photos or video, and label it urgent when you need someone soon
• Message techs and call them in the app
• Browse techs in your state who are open to work, with portfolios and skills
• Build a service menu with prices and photos, share it with a QR code, and get booking requests in one inbox
• Techs and salons can review each other
• List nail supplies for sale; buyers contact you in chat

PAWNAIL TRY-ON
• Take a photo of your hand. PawNail finds your nails, reads your skin tone and nail shape, and paints 10 suggested looks on your own nails, natural length or extensions
• It runs on your phone. Your hand photo is uploaded only if you send a look in chat
• Send the looks you like to your nail tech or salon in chat

FOR NAIL CLIENTS
• Send a booking request from a salon's menu: pick a service, a day, and morning, afternoon or evening. The salon confirms by call or message
• Message salons and share photos of the look you want
• Save designs you love and get a daily nail-care tip
• Browse salons and techs in your state that have a menu or portfolio on PawNail

NAIL DESIGN IDEAS
• New design ideas every day, labeled as illustrations, with a suggested price; techs also see materials and steps
• Filter by occasion or technique
• A nail trend radar, plus real work posted by techs and salons

FEED, CHAT AND CALLS
• A feed with photo and video posts, comments, likes and polls to vote in
• Anonymous posts are reviewed before they appear
• Private and group chats with photos, videos, voice messages, GIFs and stickers
• Voice and video calls with people on PawNail

SAFETY
• Report posts and users, and block anyone from a chat
• Delete your account in the app at any time
• No ads and no in-app purchases
• For adults 18 and over

LANGUAGES
• English and Tiếng Việt, switch in one tap
• Tiếng Việt: việc làm nail theo bang, tiệm tuyển thợ, thử mẫu nail trên chính tay bạn.

Good to know: PawNail is new, so the lists of salons and techs grow as pros join. Job posts and feed posts are written by their authors, and many job posts are in Vietnamese. Many job listings are reposted by PawNail from public salon ads; they carry a "Posted for salon" label, you reach them by phone, and salons can claim or remove them. PawNail is not a staffing agency and does not charge techs or salons.
```

**Full description (English, Australia — Play `en-AU` and App Store `en-AU`):**
```
Try nail looks on a photo of your own hand, get new nail design ideas every day, and connect nail salons and nail bars with technicians. PawNail's Australian job board is new: salons can post job ads now, and technicians can build a profile that salons can find.

PawNail is the platform for the nail industry in Australia and the US, for clients, technicians and salon owners alike.

PAWNAIL TRY-ON
• Take a photo of your hand. PawNail finds your nails, reads your skin tone and nail shape, and paints 10 suggested looks in full colour on your own nails, natural length or extensions
• It runs on your phone. Your hand photo is uploaded only if you send a look in chat
• Send the looks you like to your technician or salon in chat

NAIL DESIGN IDEAS
• New design ideas every day, labelled as illustrations, with a suggested price; technicians also see materials and steps
• Filter by occasion or technique
• A nail trend radar, plus real work posted by technicians and salons

FOR SALON AND NAIL BAR OWNERS
• Hire nail technicians: post a job ad with photos or video, and label it urgent when you need someone soon
• Message technicians and call them in the app
• Browse technicians in your state who are open to work, with portfolios and skills
• Build a service menu with prices and photos, share it with a QR code, and organise booking requests in one inbox
• Technicians and salons can review each other
• List nail supplies for sale; buyers contact you in chat

FOR NAIL TECHNICIANS
• Build a profile with a photo and video portfolio, skills, experience and availability, so salons and nail bars can find you
• See which salons viewed your profile
• Job ads by state or territory as salons post them, with the pay type (hourly or weekly), the rate when the salon lists it, and the suburb
• Search by suburb, salon name or skill (acrylic, dip/SNS, Gel-X, wax, design); urgent ads are labelled and you can save ads for later
• Earnings tracker: log the clients and earnings for each shift and see your weekly total (saved on your phone only)
• Nail Radar: estimated pay ranges by state and skill, for reference when you discuss pay

FOR NAIL CLIENTS
• Send a booking request from a salon's menu: pick a service, a day, and morning, afternoon or evening. The salon confirms by phone or message
• Message salons and share photos of the look you want
• Save your favourite designs and get a daily nail-care tip
• Browse salons and technicians in your state that have a menu or portfolio on PawNail

FEED, CHAT AND CALLS
• A feed with photo and video posts, comments, likes and polls to vote in
• Anonymous posts are reviewed before they appear
• Private and group chats with photos, videos, voice messages, GIFs and stickers
• Voice and video calls with people on PawNail

SAFETY
• Report posts and users, and block anyone from a chat
• Delete your account in the app at any time
• No ads and no in-app purchases
• For adults 18 and over

LANGUAGES
• English and Tiếng Việt, switch in one tap
• Tiếng Việt: thử mẫu nail trên chính tay mình, tiệm nail ở Úc đăng tin tuyển thợ, thợ làm hồ sơ để tiệm tìm đến.

Good to know: PawNail is new in Australia, so job ads and the lists of salons and technicians grow as salons and nail bars join. Job ads and feed posts are written by their authors, in English or Vietnamese. PawNail is not a recruitment agency and does not charge technicians or salons.
```

**Chú thích ảnh chụp (tiêu đề | dòng phụ):**

| # | en-US | en-AU | vi |
|---|---|---|---|
| 1 | Find your next nail job \| Salon jobs by state, in English or Tiếng Việt | Try looks on your own hand \| Snap a photo, see 10 on-trend looks | Việc làm nail theo bang \| Gọi trực tiếp cho tiệm chỉ một chạm |
| 2 | Try looks on your own hand \| Snap a photo, see 10 on-trend looks | Nail bar hiring? Post a job ad \| Add photos, mark it urgent, chat with technicians | Thử mẫu trên chính tay bạn \| Chụp tay, xem 10 mẫu trend hợp tay |
| 3 | Know the job before you call \| Pay, housing & skills, when the salon lists them | Let salons find your work \| Portfolio, skills & experience in one profile | Biết rõ việc trước khi gọi \| Lương, chỗ ở, kỹ năng khi tiệm có ghi |
| 4 | Chat & call on PawNail \| Messages, voice & video calls with salons & techs | Chat & call on PawNail \| Messages, voice & video calls in the app | Nhắn tin, gọi ngay trong app \| Gọi thoại & video với tiệm, thợ trên PawNail |
| 5 | Hiring? Post a nail job \| Add photos, label it urgent, chat with techs | Fresh nail ideas, daily \| Illustrated looks with suggested prices | Tuyển thợ nail \| Đăng tin kèm ảnh, nhắn tin và gọi cho thợ |
| 6 | Let salons find your work \| Portfolio, skills & experience in one profile | Share your menu by QR \| Clients send booking requests, you confirm | Khoe tay nghề, tiệm tự tìm tới \| Ảnh mẫu, kỹ năng, kinh nghiệm trên 1 hồ sơ |
| 7 | Track turns, tips & pay \| Log each shift, see your weekly total | Track your earnings \| Log each shift, check it against your payslip | Ghi turn, tip, thu nhập \| Ghi mỗi ca, cuối tuần đối chiếu check lương |
| 8 | Fresh nail ideas, daily \| Illustrated looks with suggested prices | Meet technicians open to work \| Portfolios & skills, message in one tap | Ý tưởng mẫu nail mỗi ngày \| Ảnh minh hoạ kèm giá gợi ý |
| 9 | Share your menu by QR \| Clients send booking requests, you confirm | Know the going rate \| Estimated pay by state & skill, for reference | Menu tiệm có mã QR \| Khách gửi yêu cầu đặt lịch, tiệm xác nhận lại |
| 10 | Meet techs open to work \| Portfolios & skills, message in one tap | English or Tiếng Việt \| Switch language in one tap | Thợ sẵn sàng nhận việc \| Ảnh tay nghề, kỹ năng, nhắn tin một chạm |

**What's new / Có gì mới:**
```
<en-US>
First public release of PawNail.
• Nail salon jobs by state, with urgent jobs and saved jobs
• Salons can post jobs and chat with techs in the app
• PawNail Try-On: nail looks painted on a photo of your own hand
• Salon menus with booking requests
• English and Vietnamese
• Photo, video and voice uploads now work on Android
Thank you to our closed-test testers for their feedback.
</en-US>
<en-AU>
First public release of PawNail.
• PawNail Try-On: nail looks painted on a photo of your own hand
• New nail design ideas every day
• Salons and nail bars can post job ads and chat with technicians
• Salon menus with booking requests
• English and Vietnamese
• Photo, video and voice uploads now work on Android
Thank you to our closed-test testers for their feedback.
</en-AU>
<vi>
Bản phát hành chính thức đầu tiên của PawNail.
• Tin tiệm cần thợ nail theo bang, có việc gấp và lưu tin
• Chủ tiệm đăng tin tuyển thợ, nhắn tin với thợ ngay trong app
• Thử mẫu (Try-On): vẽ mẫu nail lên ảnh chính bàn tay bạn
• Menu tiệm, khách gửi yêu cầu đặt lịch
• Giao diện tiếng Việt và tiếng Anh
• Sửa lỗi gửi ảnh, video, tin nhắn thoại trên Android
Cảm ơn các bạn đã tham gia thử nghiệm kín và góp ý.
</vi>
```

**Danh mục:** App Store: **Business** (phụ: Lifestyle) · Google Play: **Business** · Thẻ Play: Job search, Recruiting, Beauty, Social networking, Communication
**URL hỗ trợ:** https://www.bitpawos.com/support (trang song ngữ, phần tiếng Anh hiện trước, có email support@bitpawsoftware.com + câu hỏi thường gặp; Apple 1.5 cần cách liên hệ thật, không dùng trang hồ sơ cá nhân)
**URL marketing:** https://www.bitpawos.com
**Chính sách bảo mật:** https://www.bitpawos.com/privacy
**Xoá dữ liệu / tài khoản (Google Play bắt buộc):** https://www.bitpawos.com/data-deletion
**Email liên hệ:** support@bitpawsoftware.com
**Bản quyền:** © 2026 PawNail

---

## 2. Khai báo dữ liệu (App Privacy của Apple / Data safety của Google)

| Dữ liệu | Thu thập? | Mục đích | Gắn với danh tính | Theo dõi quảng cáo |
|---|---|---|---|---|
| Tên, email, số điện thoại | Có | Tài khoản, liên hệ | Có | Không |
| Thành phố / bang (người dùng tự nhập, KHÔNG dùng GPS) | Có | Hiển thị việc/thợ gần | Có | Không |
| Ảnh / video (portfolio, bài đăng) | Có | Nội dung người dùng | Có | Không |
| Ảnh tay — **Thử mẫu (Try-On)** | Xử lý NGAY TRÊN MÁY; chỉ tải lên khi người dùng bấm Gửi trong tin nhắn | Tạo ảnh mẫu thử | Có (khi gửi) | Không |
| Ảnh tay — **Soi tay tư vấn** | Gửi tới dịch vụ AI (Google Gemini / Cloudflare) để phân tích, PawNail không lưu ảnh | Gợi ý chăm sóc + mẫu hợp | Không | Không |
| Lịch hẹn (tên, SĐT khách, dịch vụ, ngày giờ) | Có | Đặt lịch với tiệm | Có | Không |
| Tin nhắn trong app | Có | Nhắn tin giữa người dùng | Có | Không |
| Âm thanh/hình ảnh cuộc gọi | Truyền trực tiếp, KHÔNG lưu | Gọi thoại/video | — | Không |
| Mã thiết bị nhận thông báo đẩy | Có | Gửi thông báo | Có | Không |
| Báo lỗi / chẩn đoán (Sentry) | Có | Sửa lỗi app | Không | Không |

- **Không** bán dữ liệu, **không** quảng cáo, **không** theo dõi (Apple: "Data Not Used to Track You").
- Dữ liệu được mã hoá khi truyền (HTTPS). Người dùng tự xoá tài khoản trong app (Hồ sơ → Tài khoản → Xóa tài khoản).

**Độ tuổi:** Apple — chọn "Unrestricted Web Access: Không", "User-Generated Content: Có" → thường ra **12+**. Google — bảng IARC: có tương tác người dùng / chia sẻ nội dung → thường **Teen / 12+**.

---

## 3. Ghi chú cho người duyệt (App Review Notes)

```
PawNail is the platform for the nail industry in the US and Australia: nail try-on, salon menus with booking requests,
portfolios for nail technicians, and nail tech jobs. The app is available in English and Vietnamese.

Demo account (technician):  email: <TẠO TRÊN WEB rồi điền>   password: <…>
Demo account (salon owner): email: <…>   password: <…>

Native features: camera / photo library capture for PawNail Try-On (paint nail looks on a photo of your hand)
and portfolio photos, microphone/camera for in-app voice & video calls between users, Android back-button
navigation, an offline screen when there is no connection, and job/salon/design links that open in the app.
User-generated content is moderated: users can report and block other users (chat screen menu → Report / Block,
or the ••• menu on any post); reports are reviewed by the PawNail team.
Account deletion: Profile → Account → Delete my account (deletes immediately).
Sign-in inside the app is by email/password only (Google, Facebook and phone sign-in exist on the website
but are hidden in the native app), so Sign in with Apple is not required (guideline 4.8).
```

> ⚠️ Người duyệt PHẢI đăng nhập được. Tạo 2 tài khoản demo trên bitpawos.com (1 thợ, 1 chủ tiệm), điền đủ hồ sơ + vài ảnh, rồi dán vào ô trên. Đừng dùng tài khoản thật/admin.
> Chỉ ghi tính năng đã chạy thật trên máy. Thêm "push notifications for new jobs & messages" vào dòng Native features CHỈ KHI mục 4 đã xong và đã thử nhận thông báo trên bản build đó. "Links open in the app" chỉ đúng khi mục 4 (App Links / Universal Links) đã cấu hình.

---

## 4. ⚠️ BẮT BUỘC trước khi nộp: thông báo đẩy cho app native

Hiện production CHƯA có khoá Firebase/APNs → app CH Play/App Store không nhận thông báo (web vẫn nhận).
Code đã viết sẵn (lib/push.ts, lib/nativePush.ts). Bản app cũ / thiếu cấu hình tự báo "chưa hỗ trợ" thay vì crash:
Android kiểm tra bản build có Firebase (plugin `PawNailNative` trong MainActivity), iOS kiểm tra số build (mặc định ≥ 2).

**Android (Firebase, miễn phí):**
1. console.firebase.google.com → Tạo dự án "PawNail Jobs" → Thêm app **Android**, package `com.bitpawos.app`.
2. Tải `google-services.json` → đặt vào `android/app/google-services.json` → build bản Android mới (bản không có file này không bao giờ bật push, kể cả khi máy chủ đã bật).
3. Project settings → Service accounts → **Generate new private key** → cài vào Vercel `FIREBASE_SERVICE_ACCOUNT` (đặt SAU khi bản có google-services.json đã lên store).

**iOS (APNs):**
1. developer.apple.com → Identifiers → `com.bitpawos.app` → bật **Push Notifications** và **Associated Domains** (app đã có `ios/App/App/App.entitlements`).
2. **Keys** → tạo key bật **Apple Push Notifications service (APNs)** → tải file `.p8` (chỉ tải được 1 lần).
3. Cài vào Vercel `APNS_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID=com.bitpawos.app`.
4. Nếu số build TestFlight đầu tiên có entitlement lớn hơn 2: đặt Vercel `NATIVE_PUSH_MIN_BUILD_IOS` = số build đó (bản cũ hơn sẽ không hiện nút bật thông báo).

**Link mở thẳng trong app (App Links / Universal Links):**
- Android: Vercel `ANDROID_APP_LINK_SHA256` = SHA-256 của **App signing key** (Play Console → Test and release → App integrity). Kiểm tra: https://www.bitpawos.com/.well-known/assetlinks.json
- iOS: Vercel `APPLE_TEAM_ID` (hoặc dùng `APNS_TEAM_ID` ở trên). Kiểm tra: https://www.bitpawos.com/.well-known/apple-app-site-association (trả 404 khi chưa có Team ID).

---

## 5. Checklist sáng mai

**Google Play (Android Studio trên Windows):**
1. `npm install` → `npx cap sync android` → mở thư mục `android/` bằng Android Studio → chờ Gradle đồng bộ.
2. Ký bằng **upload key ĐÃ ĐĂNG KÝ** với Play — KHÔNG "Create new…" (khoá mới sẽ bị Play từ chối). So SHA-1 của khoá với Play Console → Test and release → **App integrity** → *Upload key certificate*. Khoá hiện có trên máy: `android/app/pawos-release.keystore` (SHA-1 `1D:53:83:4C:CE:4E:16:51:12:C2:1F:16:1B:A6:FE:09:2E:E0:29:34`). Khác nhau → tìm khoá gốc, mất thì dùng *Request upload key reset*.
   - Chép `android/keystore.properties.example` thành `android/keystore.properties` (đã gitignore), điền mật khẩu → `cd android && ./gradlew bundleRelease` ra `android/app/build/outputs/bundle/release/app-release.aab`. (Hoặc Android Studio → Build → Generate Signed App Bundle → **Choose existing…**.)
   - Sao lưu file `.keystore` + mật khẩu ra ngoài máy này (Drive riêng / trình quản lý mật khẩu). **Mất khoá = phải xin Google reset.** Không gửi khoá cho ai, không commit.
3. Play Console → **Closed testing** (hoặc Internal) tải `.aab` → thử trên máy Android 14–16 thật: chọn ảnh (Try-On, portfolio, đính kèm chat), chụp ảnh Try-On, gọi thoại + gọi video, bật chế độ máy bay (phải hiện màn "Không có kết nối mạng"), mở 1 link việc làm → rồi mới xin **Production**.
   - Quyền app (manifest sau khi gộp): INTERNET, ACCESS_NETWORK_STATE, CAMERA, RECORD_AUDIO + MODIFY_AUDIO_SETTINGS (gọi thoại/video), POST_NOTIFICATIONS, WAKE_LOCK + com.google.android.c2dm.permission.RECEIVE (thông báo đẩy), READ_EXTERNAL_STORAGE (chỉ Android ≤ 12). Không có READ_MEDIA_IMAGES/VIDEO, không có vị trí → không phải nộp tờ khai "Photo and video permissions" hay vị trí.
   - Quốc gia phát hành: Hoa Kỳ + Úc (có thể thêm Việt Nam cho người nhà test).
5. Tài khoản Play cá nhân mới: Google bắt **chạy thử kín với ≥12 người trong 14 ngày** trước khi được lên Production. (Tài khoản tổ chức/doanh nghiệp thì không.)

**App Store (cần máy Mac + Xcode + tài khoản Apple Developer $99/năm):**
1. `npm install` → `npx cap sync ios` → mở `ios/App/App.xcodeproj` bằng **Xcode 26+** (Capacitor 8 dùng Swift Package Manager, không có `.xcworkspace`; Apple chỉ nhận bản build bằng Xcode 26 / iOS 26 SDK).
2. Signing & Capabilities: chọn Team; **Push Notifications** và **Associated Domains** đã khai trong `App.entitlements` — App ID trên developer.apple.com phải bật cả 2.
3. Phiên bản 1.1.0 đã đặt sẵn (MARKETING_VERSION). Build tự tăng: chạy GitHub Actions **Deploy iOS to TestFlight** (ô `app_version` = 1.1.0; cần secrets `IOS_DIST_P12_BASE64` + `IOS_DIST_P12_PASSWORD` = chứng chỉ Apple Distribution hiện có, xuất .p12). Archive tay trong Xcode thì tự tăng CURRENT_PROJECT_VERSION lên hơn build TestFlight mới nhất.
4. App Store Connect: điền mục 1, 2, 3, tải 6 ảnh `store-assets/ios_*.png` → Submit for Review.
5. App chỉ chạy iPhone (đã tắt iPad cho lần đầu — iPad vẫn cài được ở chế độ iPhone).

**Rủi ro bị từ chối & cách đã xử lý:**
- 4.2 "chỉ là web bọc lại": camera/thư viện ảnh (Try-On, portfolio), gọi thoại/video trong app, nút Back Android, màn mất mạng riêng, link mở thẳng trong app; thông báo đẩy native khi mục 4 xong → chỉ nêu trong Review Notes những gì đã chạy thật.
- 4.8 Sign in with Apple: trong app native chỉ có email + mật khẩu (Google/Facebook/SĐT ẩn — components/auth/SocialLogin.tsx) → không bắt buộc Sign in with Apple.
- Đăng nhập SĐT ẩn trong app vì Twilio còn bản dùng thử (người duyệt không nhận được mã). Nâng cấp Twilio xong → đặt `NEXT_PUBLIC_NATIVE_PHONE_LOGIN=1` trên Vercel để bật lại.
- 5.1.1(v) Xoá tài khoản: có trong app.
- 1.2 Nội dung người dùng: có báo cáo + chặn.
- Ảnh chụp cũ có câu "#1" / "100% free" trên trang chủ — trang chủ đã đổi sang định vị nền tảng (30/10/2026); chụp lại ảnh từ bản web mới trước khi nộp (không cần build lại app).
