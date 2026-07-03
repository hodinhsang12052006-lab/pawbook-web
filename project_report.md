# Báo Cáo Kỹ Thuật Dự Án PawBook

Bản báo cáo kỹ thuật tổng hợp toàn bộ hiện trạng hệ thống mạng xã hội PawBook, cấu trúc cơ sở dữ liệu và dòng luân chuyển tài chính số PawCoin.

---

## 1. Các Tính Năng & Module Cốt Lõi Đã Hoàn Thiện

* **Hệ thống Người Dùng & Onboarding:**
  * Đăng ký tài khoản cá nhân hóa qua Onboarding Wizard 3 bước (Candidate, Employer, Business Owner).
  * Tự động tạo gian hàng dịch vụ khi đăng ký vai trò Chủ doanh nghiệp (Spa, điện lạnh, sửa chữa...).
  * Quản lý thông tin hồ sơ (Bio, Skills, Location, Website, Avatar) và đính kèm CV thực tế định dạng PDF.

* **Chợ Việc Làm & Tuyển Dụng (Job Board):**
  * Đăng tuyển dụng IT/MMO dành cho Nhà tuyển dụng (HR/Employer).
  * Ứng viên nộp CV ứng tuyển trực tuyến chống trùng lặp dữ liệu.
  * Tự động lọc và gợi ý việc làm (PawBot Matchmaker) dựa trên từ khóa kỹ năng của ứng viên.

* **Danh Bạ Dịch Vụ Cửa Hàng (Storefront Services):**
  * Đăng ký gian hàng dịch vụ kèm phân loại ngành nghề (Spa, Điện lạnh, Xây dựng, Sửa chữa).
  * Hiển thị thông tin liên hệ, bảng giá và bản đồ địa điểm.
  * Đánh giá chất lượng dịch vụ và tính điểm xếp hạng cửa hàng.

* **Chợ Đấu Thầu Thời Vụ (Gig Economy):**
  * Chủ dự án đăng thầu tự do (Gigs) kèm ngân sách.
  * Freelancer chào thầu (Bids) kèm giá thầu và lời nhắn thuyết phục.
  * Phê duyệt chào thầu, chốt tiến độ dự án.

* **Hệ thống Blog & Phễu Chuyển Đổi (Blog & Conversion Funnel):**
  * Diễn đàn chia sẻ kiến thức, kinh nghiệm MMO, IT, khởi nghiệp Spa.
  * Gắn phễu chuyển đổi (Call-to-Action) dẫn trực tiếp người đọc tới tin tuyển dụng hoặc gian hàng dịch vụ liên quan dưới cùng bài viết.

* **Hệ thống Tín Nhiệm (Paw-Trust & Reviews):**
  * Tòa án xếp hạng sau khi chốt thầu dự án.
  * Tự động tính toán điểm tín nhiệm trung bình (`trustScore`) của người dùng nhận đánh giá.
  * Tự động thu hồi tích xanh xác minh (`isVerified = false`) nếu điểm tín nhiệm trung bình giảm xuống dưới 3.0.

* **Hệ thống Thông Báo (Notifications):**
  * Nhận thông báo thời gian thực về ví tiền (nạp/trừ coin), tín nhiệm và các bình chọn bài viết.
  * Đọc thông báo riêng lẻ hoặc đánh dấu đọc toàn bộ thông báo chỉ với một chạm.

* **Ví & Lịch Sử Giao Dịch (Wallet History):**
  * Hiển thị số dư PawCoin hiện tại của tài khoản trên profile và navbar.
  * Nhật ký ghi nhận lịch sử biến động số dư ví PawCoin (Credits/Debits).

---

## 2. Cấu Trúc Cơ Sở Dữ Liệu (Prisma Schema)

* **User (Người dùng):**
  * Lưu trữ định danh, thông tin bảo mật, số dư `pawCoin`, uy tín `reputation`, độ tin cậy `trustScore`, trạng thái xác minh `isVerified`.
  * *Quan hệ:* Một người dùng có nhiều bài viết (`posts`), việc làm (`jobs`), dịch vụ (`services`), đơn ứng tuyển (`applications`), bảng lương (`payrolls`), thông báo (`notifications`), bình luận (`comments`), tin nhắn gửi/nhận (`sentMessages`/`receivedMessages`), dự án thầu (`gigs`), lượt chào thầu (`bids`), đánh giá viết/nhận (`writtenReviews`/`receivedReviews`), bài viết blog (`blogPosts`), và giao dịch ví (`transactions`).

* **Post (Bài đăng bảng tin):**
  * Lưu trữ bài viết mạng xã hội, tệp tin đính kèm (ảnh/video).
  * *Quan hệ:* Thuộc về một tác giả (`User`), có nhiều bình luận (`Comment`).

* **Job (Tin tuyển dụng):**
  * Lưu trữ thông tin tuyển dụng việc làm IT/MMO, mức lương, trạng thái đẩy top (`isBoosted`/`boostUntil`).
  * *Quan hệ:* Thuộc về nhà tuyển dụng (`User`), liên kết với nhiều đơn ứng tuyển (`Application`) và bài viết blog (`BlogPost`).

* **Service (Gian hàng dịch vụ):**
  * Lưu trữ cửa hàng kinh doanh địa phương, phân loại ngành nghề, liên hệ, ảnh Cloudinary, đánh giá trung bình.
  * *Quan hệ:* Thuộc về một chủ sở hữu (`User`), liên kết với nhiều bài viết blog (`BlogPost`).

* **Application (Đơn ứng tuyển):**
  * Lưu trữ hồ sơ ứng tuyển của ứng viên vào tin tuyển dụng.
  * *Quan hệ:* Liên kết giữa một ứng viên (`User`) và một việc làm (`Job`).

* **Comment (Bình luận):**
  * Lưu trữ nội dung trao đổi dưới bài đăng bảng tin.
  * *Quan hệ:* Liên kết giữa tác giả (`User`) và bài đăng (`Post`).

* **Message (Tin nhắn trực tiếp):**
  * Lưu trữ cuộc trò chuyện bảo mật giữa các thành viên.
  * *Quan hệ:* Liên kết giữa người gửi (`User`) và người nhận (`User`).

* **Gig (Dự án đấu thầu):**
  * Lưu trữ thông tin thầu dự án thời vụ, ngân sách, đẩy top.
  * *Quan hệ:* Thuộc về chủ thầu (`User`), chứa nhiều lượt thầu (`Bid`).

* **Bid (Chào thầu):**
  * Lưu trữ mức giá thầu và thư xin việc của freelancer.
  * *Quan hệ:* Liên kết giữa freelancer (`User`) và dự án thầu (`Gig`).

* **Review (Đánh giá tín nhiệm):**
  * Lưu trữ điểm số sao (1-5), nội dung nhận xét sau khi hoàn tất công việc.
  * *Quan hệ:* Liên kết giữa người viết đánh giá (`User`) và người nhận đánh giá (`User`).

* **BlogPost (Bài viết chia sẻ):**
  * Lưu trữ tiêu đề, nội dung chia sẻ, lượt upvotes, liên kết phễu.
  * *Quan hệ:* Thuộc về tác giả (`User`), liên kết tùy chọn với việc làm (`Job`) hoặc gian hàng dịch vụ (`Service`).

* **Transaction (Giao dịch ví):**
  * Lưu trữ biến động ví, số tiền, phân loại giao dịch (INCOME/EXPENSE) và nội dung giải trình.
  * *Quan hệ:* Thuộc về một người dùng (`User`).

---

## 3. Luồng Luân Chuyển Của PawCoin

### Các Hành Động Được Cộng Coin (INCOME):
* **Tự động Crawler:** Khi dữ liệu doanh nghiệp ngoài luồng được nạp qua Webhook, hệ thống tự động khởi tạo hoặc cấp thêm coin cho crawler.
* **Bình Chọn Bài Viết (Upvotes):** Khi một bài viết Blog của người dùng nhận được 1 Upvote từ thành viên khác, tác giả bài viết được cộng **+5 PawCoin**.

### Các Hành Động Bị Trừ Coin (EXPENSE):
* **Đẩy Top Tuyển Dụng (Job Boost):** Nhà tuyển dụng sử dụng tính năng đẩy bài viết tuyển dụng IT/MMO lên đầu trang sẽ bị khấu trừ **-500 PawCoin**.
* **Đẩy Top Gian Hàng Dịch Vụ (Service Boost):** Chủ cơ sở kinh doanh sử dụng tính năng đẩy nổi bật gian hàng spa/điện lạnh lên trang đầu sẽ bị khấu trừ **-500 PawCoin**.
* **Đẩy Top Đấu Thầu (Gig Boost):** Chủ thầu sử dụng tính năng đẩy nổi bật tin tuyển dụng thời vụ lên đầu danh sách thầu sẽ bị khấu trừ **-500 PawCoin**.
