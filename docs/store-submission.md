# Nộp PawNail Jobs lên Google Play & App Store

Ảnh: chạy `node scripts/store/make_screenshots.mjs` → thư mục `store-assets/`
(iPhone 1290×2796 ×6, Android 1080×1920 ×6, ảnh bìa Play 1024×500, icon 512×512).

App: **PawNail Jobs** · Bundle/Application ID: `com.bitpawos.app`
Bản native kế tiếp: **1.1.0** — Android `versionCode 2` (hoặc số lớn nhất từng tải lên Play + 1, xem App bundle explorer; KHÔNG dùng lại số cũ), iOS build = build TestFlight mới nhất + 1 (CI tự tính). Bản 1.0 (versionCode 1 / build 1) đã dùng.
App native mở thẳng https://www.bitpawos.com (hosted mode) — sửa web là app cập nhật, chỉ build lại khi đổi icon/quyền/plugin/`native-shell/` (màn mất mạng) hoặc `capacitor.config.ts`. Trước MỌI lần build native: `npm install` rồi `npx cap sync`.

---

## 1. Thông tin hiển thị (dán vào store)

**Tên app (≤30):** PawNail Jobs
**Phụ đề iOS (≤30):** Việc làm nail Mỹ & Úc
**Mô tả ngắn Google Play (≤80):** Việc làm nail, tuyển thợ & tìm tiệm nail tại Mỹ, Úc — thử mẫu trên tay bạn.
> Cập nhật 23/10/2026: app có thêm phần **cho khách làm nail** (tìm tiệm, đặt lịch) và **Thử mẫu trên tay**. Cân nhắc đổi tên store thành **"PawNail: Nail Jobs & Salons"** (27 ký tự) để khách tìm thấy — tên trong app (capacitor.config `appName`) đổi thì phải build lại.

**Mô tả đầy đủ (tiếng Việt):**
```
PawNail Jobs là nơi thợ nail và chủ tiệm nail người Việt tại Mỹ và Úc gặp nhau — miễn phí, không qua môi giới.

DÀNH CHO THỢ NAIL
• Xem tin tuyển thợ mới mỗi ngày, lọc theo bang, lương, kỹ năng (bột, Gel-X, dip, design, chân tay nước…)
• Nhận thông báo ngay khi có việc gấp gần bạn
• Đăng portfolio ảnh tay nghề để tiệm tìm tới bạn
• Nhắn tin, gọi thoại / video trực tiếp với chủ tiệm
• Biết tiệm nào vừa xem hồ sơ của bạn
• Ghi thu nhập & tiền tip, xem lương trung bình theo khu vực
• Tin thuế, tip & quyền lợi thợ được tóm tắt dễ hiểu (nguồn IRS, ATO, Fair Work)

DÀNH CHO CHỦ TIỆM
• Đăng tin tuyển thợ miễn phí trong 1 phút
• Xem thợ đang rảnh quanh tiệm kèm ảnh tay nghề thật
• Nhắn tin, gọi ngay cho thợ — không phí, không trung gian

DÀNH CHO KHÁCH LÀM NAIL
• Tìm tiệm & thợ quanh bạn: ảnh tác phẩm thật, bảng giá, đánh giá của khách thật
• Đặt lịch ngay trên menu tiệm — không cần gọi điện
• Nhắn hỏi mẫu, gửi ảnh mẫu bạn thích để được báo giá đúng
• Lưu mẫu yêu thích, mẹo giữ móng đẹp mỗi ngày

THỬ MẪU TRÊN TAY (PawNail Try-On)
• Chụp mu bàn tay — máy tự nhận móng, soi tông da + dáng móng, gợi ý 10 mẫu trend hợp tay và vẽ lên chính móng bạn như ảnh chụp (glazed donut, micro French, velvet, aura, ombre, đá 3D…; giữ dáng móng hoặc đắp dài)
• Thợ & tiệm gửi 5–10 mẫu thử trên tay khách ngay trong tin nhắn, kèm giá gợi ý
• Chạy ngay trên điện thoại, không tốn phí

MẪU NAIL MỚI MỖI NGÀY
• Ý tưởng theo mùa lễ và xu hướng, giá gợi ý; thợ xem thêm vật tư & các bước làm
• Ảnh thật từ thợ & tiệm khắp Mỹ và Úc

An toàn: chặn & báo cáo người dùng, tự xoá tài khoản bất cứ lúc nào.
Song ngữ Việt – Anh.
```

**Full description (English):**
```
PawNail Jobs connects Vietnamese-speaking nail technicians and nail salon owners across the US and Australia — free, with no middlemen.

FOR NAIL TECHS
• Fresh salon job posts every day, filtered by state, pay and skills (acrylic, Gel-X, dip, nail art, pedicure…)
• Instant alerts when an urgent job opens near you
• A photo portfolio so salons can find you
• Message, voice and video call salon owners directly
• See which salons viewed your profile
• Track income & tips, see average pay in your area
• Plain-language tax, tip and worker-rights updates (sources: IRS, ATO, Fair Work)

FOR SALON OWNERS
• Post a job for free in a minute
• Browse available techs near your salon with real work photos
• Message or call techs instantly — no fees, no agency

FOR NAIL CLIENTS
• Find salons and techs near you: real work photos, prices and genuine client reviews
• Book straight from the salon's menu — no phone call needed
• Message salons about a look and send photos for an exact quote
• Save looks you love, plus a daily nail-care tip

TRY LOOKS ON YOUR OWN HAND (PawNail Try-On)
• Snap the back of your hand — PawNail finds your nails, reads your skin tone and nail shape, suggests 10 trending looks that suit you and paints them on your real nails like a photo (glazed donut, micro French, velvet, aura, ombre, 3D gems…; natural shape or extensions)
• Techs and salons send 5–10 try-on looks with suggested prices right inside the chat
• Runs on your phone, free

NEW NAIL DESIGNS DAILY
• Seasonal and trending ideas with suggested prices; techs also see materials and steps
• Real work from techs and salons in the US and Australia

Safety: block & report users, delete your account any time.
Vietnamese and English.
```

**Từ khoá iOS (≤100, cách nhau bằng dấu phẩy, không dấu cách):**
`nail,việc làm nail,thợ nail,tiệm nail,tuyển thợ,nail salon,nail tech,manicure,viec lam,vietnamese`

**Danh mục:** App Store: **Business** (phụ: Lifestyle) · Google Play: **Business**
**URL hỗ trợ:** https://www.bitpawos.com/support (trang song ngữ có email support@bitpawos.com + câu hỏi thường gặp; Apple 1.5 cần cách liên hệ thật, không dùng trang hồ sơ cá nhân)
**URL marketing:** https://www.bitpawos.com
**Chính sách bảo mật:** https://www.bitpawos.com/privacy
**Xoá dữ liệu / tài khoản (Google Play bắt buộc):** https://www.bitpawos.com/data-deletion
**Bản quyền:** © 2026 PawNail Jobs

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
PawNail Jobs is a job marketplace for nail technicians and nail salon owners in the US and Australia.

Demo account (technician):  email: <TẠO TRÊN WEB rồi điền>   password: <…>
Demo account (salon owner): email: <…>   password: <…>

Native features: camera / photo library capture for PawNail Try-On (paint nail looks on a photo of your hand)
and portfolio photos, microphone/camera for in-app voice & video calls between users, Android back-button
navigation, an offline screen when there is no connection, and job/salon/design links that open in the app.
User-generated content is moderated: users can report and block other users (chat screen menu → Report / Block,
or the ••• menu on any post); reports are reviewed by our team within 24 hours.
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
- Ảnh chụp có câu "#1" trên trang chủ — nếu Apple hỏi, đổi câu đó trên web (không cần build lại app).
