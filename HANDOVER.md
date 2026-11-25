# Tài liệu Bàn giao Dự án — PawNail (`bitpawos` / `pawbook-web`)

> **Cập nhật & Kiểm tra thực tế lần cuối:** 2026-11-25  
> **Nhánh hiện tại (`HEAD`):** `wip-handover` (`ba4abd9`, tách từ `main` `150a582`)  
> **Tên miền Production:** `https://www.bitpawos.com` (Vercel project: `pawbook-web`)  
> **Bundle / Application ID (iOS & Android):** `com.bitpawos.app`

---

## 1. Dự án này làm gì

**PawNail** (mã nguồn tại `c:\Users\Acer Nitro\Desktop\bitpawos`, repo GitHub `hodinhsang12052006-lab/pawbook-web`) là nền tảng công nghệ kết nối ngành nail tại **Mỹ (`US`) và Úc (`AU`)**, phục vụ 3 nhóm người dùng chính với định vị **English-first** (tiếng Anh mặc định tại `/...`, tiếng Việt hỗ trợ đầy đủ tại `/vi/...`):

1. **Thợ Nail (`TECHNICIAN`)**:
   - Tìm việc làm nail theo bang/thành phố, mức lương (bao lương tuần, chia turn, lương giờ), kỹ năng (`Gel-X`, `Acrylic/Bột`, `Dip/SNS`, `Nail Art/Design`, `Pedicure`...).
   - Tạo hồ sơ tay nghề (portfolio ảnh/video), nhận thông báo khi chủ tiệm xem hồ sơ hoặc có việc gấp gần khu vực.
   - Sử dụng công cụ theo dõi thu nhập & tiền tip (`/tools/income-tracker`), tra cứu mặt bằng lương theo bang (`/tools/radar` — Nail Radar), xu hướng mẫu móng (`/trends`).
2. **Chủ Tiệm Nail (`OWNER`)**:
   - Đăng tin tuyển thợ miễn phí (`/jobs/create`), quản lý tin đăng và xem danh sách thợ đang tìm việc (`/?tab=portfolio`).
   - Tạo menu dịch vụ kèm bảng giá & mã QR dán tại quầy (`/menu/[uid]`), nhận và quản lý yêu cầu đặt lịch của khách (`/bookings`).
   - Đăng bán/thanh lý vật tư ngành nail giá sỉ (`/supply`).
3. **Khách Làm Nail (`CLIENT`)**:
   - Khám phá ý tưởng mẫu móng mới mỗi ngày (`/designs`), lọc theo mùa lễ/dịp đặc biệt của từng thị trường Mỹ/Úc.
   - **Thử mẫu trên tay (`PawNail Try-On` — `/tryon`)**: chụp ảnh bàn tay, hệ thống tự nhận diện móng, phân tích tông da/dáng móng và vẽ 10 mẫu móng xu hướng trực tiếp lên ảnh tay thật ngay trên trình duyệt.
   - **Soi tay tư vấn (`/consult`)**: phân tích tình trạng móng/da tay và gợi ý mẫu phù hợp.
   - Tìm tiệm & thợ quanh khu vực (`/salons`), xem menu giá và gửi yêu cầu đặt lịch không cần gọi điện.
4. **Hệ thống Giao tiếp & Quản trị (`ADMIN`)**:
   - **Messenger nội bộ (`/messages`)**: chat 1-1 và nhóm theo thời gian thực qua Pusher, hỗ trợ gửi ảnh/video, ghi âm tin nhắn thoại, nhãn dán (stickers), GIF (MP4), thả cảm xúc, đổi hình nền chat (kể cả ảnh cá nhân lưu trên máy), gợi ý trả lời nhanh (`chatAssist`) và dịch tự động.
   - **Gọi thoại & Gọi video 1-1 (`WebRTC tự chủ`)**: gọi trực tiếp qua trình duyệt/WebView với Pusher signaling + STUN/Cloudflare TURN (đã gỡ bỏ hoàn toàn ZEGOCLOUD từ 11/2026).
   - **Admin & Studio (`/admin/reports`, `/admin/leads`, `/admin/studio`)**: kiểm duyệt báo cáo vi phạm, quản lý bài viết chính thức theo mùa, nhập bộ ảnh thiết kế từ Google Flow (`/api/admin/designs/flow/*`), nhận tin tuyển dụng từ bot nhóm cộng đồng (`/api/ingest/jobs`, `/api/jobs/sync`) và nguồn đối tác (`Adzuna`, `Careerjet`).
5. **Ứng dụng Di động Native (`Capacitor 8`)**:
   - Đóng gói cho **Android (`android/`)** và **iOS (`ios/`)** ở chế độ hosted WebView trỏ về `https://www.bitpawos.com`, tích hợp Push Notifications gốc (Android FCM + bong bóng chat kiểu Messenger / Android Bubbles + trả lời nhanh từ thông báo; iOS APNs).

---

## 2. Đã xong / Đang dở / Chưa làm

### 2.1. Đã hoàn thành (Đã merge vào `main` `150a582` / `wip-handover` `ba4abd9`)
- **Kiến trúc song ngữ EN-first (`app/[lang]/...`)**:
  - URL không tiền tố (`/`, `/designs`, `/auth/login`...) phục vụ tiếng Anh (`en`); URL có tiền tố `/vi/...` phục vụ tiếng Việt (`vi`).
  - `proxy.ts` và hệ thống `lib/i18n/*` (`tr()`, `useTr()`, `localeHref()`, từ điển `en.json` & `vi.json` đồng bộ 154/154 khóa) đảm bảo SSR đúng ngôn ngữ, giữ tiền tố `/vi` xuyên suốt mọi luồng điều hướng và không nháy chữ Việt khi người dùng trình duyệt tiếng Anh truy cập.
- **Giao diện V2 "Warm Luxe Dark" + Phase 1 Landing/Auth/Season**:
  - Nền tối tông ấm (`plum-charcoal`), thương hiệu đồng nhất dùng duy nhất **logo chữ B (`public/logo_b.jpg`)** trên toàn bộ bề mặt (đã gỡ toàn bộ ảnh mascot Shiba `cho1.jpg` cũ).
  - Hệ thống mùa lễ tự động theo múi giờ & thị trường (`lib/season.ts`: Mỹ có `us-harvest`, `us-holiday`, `nye`, `us-winter`, `base`; Úc có `au-jacaranda`, `au-summer-festive`, `nye`, `au-summer`, `base` — không bao giờ hiển thị tuyết hay bí ngô ở thị trường Úc).
  - Prerender tĩnh trang đăng ký theo từng vai trò (`/[lang]/auth/register/[[...role]]`) và ISR 300s cho hàng đầu trang `/designs` (`lib/designsFirstPaint.ts`) giúp giảm CLS về ~0.
- **Gọi thoại/video 1-1 bằng WebRTC tự chủ (`calls-webrtc` + `call-ready`)**:
  - Thay thế hoàn toàn ZEGOCLOUD bằng WebRTC thuần + Pusher signaling (`lib/calls/*`, `components/chat/CallManager.tsx`, `app/api/calls/route.ts`, `app/api/calls/ice/route.ts`).
  - Hỗ trợ nhiều thiết bị trên cùng tài khoản (`leg` ID), tự phục hồi kết nối khi kênh Pusher lỗi auth/rớt mạng (`lib/pusherResilience.ts`), đồng bộ lại tin nhắn khi kênh private đăng ký lại (`848217e`), thông báo cuộc gọi nhỡ sau 60s (`lib/calls/callPush.ts`).
- **Thông báo đẩy Android kiểu Messenger (`native-push-bubbles`, `versionCode 3`)**:
  - Mã nguồn Java native trong `android/app/src/main/java/com/bitpawos/app/` (`PawNailMessagingService`, `ChatNotifications`, `BubbleActivity`, `ChatActionReceiver`, `PawNailNativePlugin`) hỗ trợ `MessagingStyle`, trả lời trực tiếp trên thanh thông báo, bong bóng chat (Android Bubbles) và đồng bộ trạng thái đã đọc (`sendChatReadSync`) cho bản build Android `versionCode >= 3`.
- **Luồng dữ liệu việc làm & thiết kế (`jobs-data`, `flow-import-bridge`, `polish-round2`)**:
  - Kiểm tra số điện thoại gọi được theo từng thị trường Mỹ/Úc (kể cả đầu số doanh nghiệp Úc `1300 / 1800 / 13 xx xx` và số cũ có dấu gạch ngang Unicode), chặn bài đăng từ nhóm UK lọt vào bảng tin US/AU.
  - Kết nối nguồn việc làm đối tác hợp lệ (`Adzuna`, `Careerjet` lưu tách biệt ở bảng `ExternalJob`) kèm nhãn ghi nguồn rõ ràng và heartbeat cảnh báo nếu bot nhóm cộng đồng ngưng gửi quá 24h.
  - Cầu nối nhập ảnh mẫu móng Google Flow có chữ ký chống giả mạo, chống trùng, hỗ trợ hoàn tác theo đợt/ngày; 183+ ảnh catalog Google Flow đã lên hệ thống.
- **Cấu hình iOS & CI/CD GitHub Actions**:
  - Đã cập nhật đầy đủ quyền tiếng Anh trong `ios/App/App/Info.plist` và workflow `.github/workflows/deploy-ios.yml` + `ios/App/fastlane/{Fastfile,Appfile}` + `ios/App/Gemfile`.

### 2.2. Đang làm dở (Bảng trạng thái các Worktree / Nhánh chưa gộp)

| Worktree / Nhánh | Commit HEAD | File đang sửa dở (`dirty`) | Nội dung & Trạng thái hiện tại |
| :--- | :--- | :--- | :--- |
| `.claude/worktrees/auth-social-cls` (`auth-social-cls`) | `e17fd54` | **8 modified + 1 untracked** (`lib/signInProviders.ts`) | **Sửa CLS khối nút đăng nhập Social**: Render sẵn các nút OAuth/Phone từ server (`signInProviderIds()`) trong HTML tĩnh của `/auth/login` và `/auth/register`, ẩn trên app native bằng `data-native-hide` + `html[data-native]`, thêm `html[data-reg-role]` giữ khung form đăng ký. **Đã code xong, chưa commit & chưa merge vào `main`.** |
| `.claude/worktrees/qa-sendchat-suites` (`qa-sendchat-suites`) | `7803db1` | **5 modified** (`scripts/qa/*.mjs`) | **Cập nhật helper `sendChat`**: Chuyển 5 bộ test (`chat_assist_test.mjs`, `messenger_ux.mjs`, `msg_latency.mjs`, `persona_deep.mjs`, `sound_test.mjs`) từ `.press("Enter")` / `input[type=text]` sang `sendChat(page, text)` + `textarea[data-chat-input]` và selector song ngữ EN/VI. **Đang sửa dở, chưa commit & chưa merge vào `main`.** |
| `.claude/worktrees/native-v4-calls` (`native-v4-calls`) | `e9477b4` | **10 commit chưa merge + 6 modified** | **Android `versionCode 4 / 1.3.0` Ongoing Call Service**: Thêm `OngoingCallService.java`, `CallAudio.java`, `CallLogic.java`, `CallNotifications.java`, `CallActionReceiver.java`, `lib/calls/nativeCallBridge.ts`, data-only call push cho `build >= 4`, giữ mic khi app xuống nền và điều hướng loa ngoài/Bluetooth. **Đang sửa dở 6 file TS/test trong worktree.** |
| `.claude/worktrees/chat-telegram-extras` (`chat-telegram-extras`) | `0f97b70` | `0 dirty` (nhánh chưa merge hoàn toàn) | Tối ưu độ trễ tìm kiếm emoji (`TG7p`), cố định vị trí cuộn khi bật/tắt dải gợi ý sticker, `chat_sw_gif_test.mjs`. *(Lưu ý: Nhánh này tách ra trước khi gỡ ZEGOCLOUD nên có vài commit `CL7` của ZEGOCLOUD — chỉ cherry-pick các commit chat/emoji, không merge thẳng cả nhánh).* |
| `.claude/worktrees/store-assets` (`store-assets`) | `e3d12c1` | `0 dirty` (nhánh tài sản store) | Chứa bộ ảnh chụp màn hình Google Play / App Store (`en-US`, `vi`, `en-AU`), ảnh bìa Facebook v2 và 30 ảnh catalog Google Flow mới (`D173` đã bỏ bí ngô). |
| `.claude/worktrees/wf_1444f68f-edf-7` | `61b2629` | **1 untracked** (`scripts/qa/_probe/`) | Worktree thử nghiệm vẽ họa tiết mẫu móng (`r2-motifs`), các thay đổi chính đã được đưa vào `main`; thư mục `scripts/qa/_probe/` chỉ là ảnh/script thử nghiệm tạm. |
| Thư mục gốc (`wip-handover`) | `ba4abd9` | `HANDOVER.md` | Chứa `playwright.config.ts` + `tests/*.spec.ts` cùng báo cáo lần chạy đầu (`playwright-report/`, `test-results/`) cần cập nhật selector EN-first và cấu hình `SHOW_DEMO_DATA=1`. |

### 2.3. Chưa làm (Cần thực hiện trước hoặc ngay khi phát hành)
- **Cấu hình khóa dịch vụ thật trên môi trường Production (Vercel `pawbook-web`)**:
  - Chưa bật **Cloudflare Realtime TURN** (`CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`) trên Vercel để cuộc gọi WebRTC xuyên qua mạng 4G/5G có NAT đối xứng.
  - Chưa đặt khóa **Firebase Cloud Messaging** (`FIREBASE_SERVICE_ACCOUNT` trên Vercel + file `android/app/google-services.json`) và khóa **Apple APNs** (`APNS_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`) trên Vercel để thông báo đẩy hoạt động trên bản cài từ CH Play / App Store.
  - Tài khoản **Twilio Verify** vẫn đang ở chế độ dùng thử (trial) nên đăng nhập bằng SĐT trong app native đang được ẩn tạm (`NEXT_PUBLIC_NATIVE_PHONE_LOGIN` chưa đặt `=1`).
- **Tạo tài khoản Demo thật trên Production & đóng gói bản nộp Store**:
  - Cần tạo 2 tài khoản demo (1 Technician, 1 Salon Owner) trên `https://www.bitpawos.com` để điền vào App Review Notes (`docs/store-submission.md`).
  - Xuất bản `.aab` ký upload key cho Google Play và cấu hình 3 GitHub Secrets (`APP_STORE_KEY_ID`, `APP_STORE_ISSUER_ID`, `APP_STORE_PRIVATE_KEY`) để chạy workflow đẩy `.ipa` lên TestFlight.

---

## 3. Các phần đang Audit hoặc Fix dở (Chi tiết kỹ thuật)

### 3.1. `Map.json` Audit (Hai ngữ cảnh trong hệ sinh thái BitPaw)
Khi tiếp nhận phần việc liên quan tới **"Map.json audit"**, cần phân biệt rõ 2 nơi đang sử dụng trên máy:

1. **Trong repo PawNail này (`c:\Users\Acer Nitro\Desktop\bitpawos`) — Bộ ánh xạ dịch thuật `scripts/i18n/maps/*.json`**:
   - Gồm **40 file JSON** (`01-layout.json` đến `40-msg-error.json`) định nghĩa ánh xạ `{"<chuỗi tiếng Việt gốc>": "<chuỗi tiếng Anh>"}` cho từng component/trang.
   - Được xử lý bởi `scripts/i18n/extract.mjs` và `scripts/i18n/apply.mjs` để tự động bọc chuỗi vào `{tr(vi, en)}` và chèn `useTr()`.
   - **Các công cụ audit đi kèm (đã chạy kiểm tra thực tế trên `HEAD` — PASS 100%)**:
     - `npm run i18n:check` (`node scripts/i18n/check-dict-parity.mjs && tsx scripts/i18n/tr_concurrency_test.mts`): kiểm tra đối xứng toàn bộ 154 khóa giữa `lib/i18n/dictionaries/en.json` và `vi.json`, phát hiện chuỗi rỗng hoặc chữ tiếng Việt còn sót trong `en.json`, kiểm tra 24 render SSR song song không bị trộn ngôn ngữ.
     - `node scripts/i18n/check-eager.mjs`: phát hiện lệnh gọi `tr()` ở cấp module (ngoài thân hàm/component) gây cố định ngôn ngữ lúc khởi động.
     - `node scripts/qa/i18n_audit.mjs en` và `node scripts/qa/i18n_audit.mjs vi`: dùng Playwright duyệt toàn bộ trang ở chế độ Khách / Thợ / Chủ tiệm để quét chữ tiếng Việt còn sót trên giao diện tiếng Anh (và ngược lại).
     - `npm run qa:ssr-locale` (`node scripts/qa/ssr_locale_check.mjs`): kiểm tra HTML trả về từ server theo header `Accept-Language`, cookie `bitpaw_locale` và đường dẫn `/vi/*`.
2. **Trong repo anh em BitPaw SaaS (`C:\Users\Acer Nitro\Downloads\Bitpawsofrware` — repo `hodinhsang12052006-lab/bitpaw-saas`, nhánh `HEAD` `5d72f7dd`)**:
   - Có file `map.json` và `graphify_map.json` ở thư mục gốc của `Bitpawsofrware` (ứng dụng đa ngành Flask + MongoDB chạy tại `http://127.0.0.1:5001`), liệt kê 23 trang public và các phân hệ ngành (`nail`, `spa`, `fnb`, `retail`, `karaoke`, `hotel`, `hr`...).
   - Được chạy bởi `node scripts/test_by_map.mjs <public|industry <code>|common>` (ghi kết quả vào `audit-results/results.json`) và `node scripts/map_latency_probe.mjs` (đo độ trễ cập nhật vị trí nhân viên qua SSE `/api/stream/hr_employees` trên `/map_dashboard`).

### 3.2. `Bitpawnetwork` Audit (Kiểm toán kết nối mạng, WebRTC Calls, Pusher & Job Feeds)
1. **Kiểm toán mạng cuộc gọi 1-1 WebRTC & tự phục hồi kênh Pusher (`lib/calls/*`, `lib/pusherResilience.ts`, `docs/calls.md`)**:
   - Đã hoàn tất chuyển đổi từ ZEGOCLOUD sang WebRTC tự chủ.
   - 4 bộ unit test mạng cuộc gọi đã chạy PASS 100% trên `HEAD`:
     - `scripts/qa/call_signal_unit.mts` (**44/44 PASS**): hàng đợi tín hiệu `signalQueue`, chia nhỏ SDP < 10KB của Pusher, chống trùng/lệch thứ tự, perfect negotiation, xác thực HMAC `callToken`.
     - `scripts/qa/call_ice_unit.mts` (**22/22 PASS**): lấy danh sách STUN/TURN từ Cloudflare Realtime hoặc coturn, ẩn token API, retry khi Cloudflare lỗi `502`/`5xx`, TTL 60s khi thiếu TURN.
     - `scripts/qa/call_ice_client_unit.mts` (**12/12 PASS**): cache danh sách ICE phía trình duyệt, tự làm mới sau 10 phút trong cuộc gọi dài, không bao giờ hạ cấp từ TURN xuống STUN giữa cuộc gọi.
     - `scripts/qa/pusher_resub_unit.mts` (**16/16 PASS**): tự động đăng ký lại kênh Pusher với jitter backoff khi `/api/pusher/auth` lỗi `500`/timeout/rớt mạng mà không gây bão request khi bị từ chối `403`.
   - Bộ test tích hợp `scripts/qa/call_test.mjs` dựng **máy chủ Pusher giả lập** (`scripts/qa/lib/pusher_mock.mjs`) và **bộ giả lập rớt mạng UDP** (`scripts/qa/lib/udp_netsim.mjs`) để kiểm thử luồng gọi thực tế giữa 2 trình duyệt, bao gồm kịch bản `authblip` (rớt socket + lỗi auth liên tiếp vẫn tự phục hồi và đổ chuông đúng 1 lần).
2. **Kiểm toán mạng lưới thu thập việc làm (`lib/jobIngest/*`, `lib/jobFeeds/*`, `docs/ingest-api.md`)**:
   - Đã bổ sung kiểm tra số điện thoại hợp lệ theo thị trường Mỹ/Úc (`lib/phoneFormat.ts`, `scripts/qa/job_phone_market_unit.mts`) và bộ lọc loại bỏ bài đăng từ các nhóm Facebook ở Anh (UK) bị lẫn vào nguồn US/AU.
   - Đã tích hợp nguồn việc làm đối tác (`Adzuna`, `Careerjet`) qua cron `/api/cron/external-jobs` và kiểm thử bằng `npm run qa:jobfeeds`.

### 3.3. Kiểm tra trước phát hành (Pre-release Verification Suites)
Dự án có 4 cổng kiểm tra tự động trước khi phát hành:
1. **`scripts/qa/launch_test.mjs`** (chạy cùng server giả lập `scripts/qa/start-launch-server.sh`):
   - Kiểm tra 5 nhóm tính năng chốt phát hành:
     - `OW1–OW6`: Chủ tiệm đăng ký tự nhận diện bang theo thành phố (VD: Dallas → `TX`), có nút bỏ qua khảo sát, nhắn tin trực tiếp với thợ không bị chặn bởi paywall `$4.99` cũ.
     - `ON1–ON4`: Thẻ hướng dẫn người mới (`0/3` bước) tự động đánh dấu hoàn thành dựa trên dữ liệu thật.
     - `SM1–SM8`: Xác minh số điện thoại qua SMS (Twilio Verify giả lập ở cổng `:4997`), chuẩn hóa E.164, che số, đổi số tự mất dấu xác minh, giới hạn chống spam 3 lần/giờ (`429`).
     - `OA1–OA10`: Đăng nhập OAuth (Google/Apple qua OAuth server giả lập `:4996`), bắt buộc hoàn tất hồ sơ (`/auth/complete`) ở lần đầu, liên kết tài khoản cũ cùng email đã xác minh, từ chối tài khoản OAuth chưa xác minh email (`?error=OAuthEmail`).
     - `NP1–NP13`: Thông báo đẩy native cho Android (FCM giả lập `:4995`, kiểm tra cả payload `data-only` 13 khóa cho `build >= 3` lẫn payload `notification` cho `build <= 2`, đồng bộ `type: "read"`) và iOS (APNs HTTP/2 + TLS giả lập `:4994`, ký JWT ES256), tự động xóa token chết (`404`/`410`).
2. **`scripts/qa/polish_gate.mjs`** + **`scripts/qa/polish_budget.json`**:
   - Kiểm tra ngân sách hiệu năng & giao diện trên cả mobile (`390x844`) và desktop (`1440x900`) qua 8 mốc thời gian mùa lễ US/AU: CLS, LCP, số lượng animation vô hạn (`<= 8` trên hero desktop, `0` trên mobile/auth/`prefers-reduced-motion`), kích thước bundle JS/CSS không vượt chuẩn.
3. **`npm run i18n:check` & `npm run i18n:static-routes`**:
   - Đảm bảo 100% trang tĩnh (`/en/...` và `/vi/...`) vẫn được prerender tĩnh trong `.next/prerender-manifest.json` và các trang chi tiết động (`/[lang]/jobs/[id]`, `/[lang]/menu/[uid]`, `/[lang]/profile/[uid]`...) không bị cache tĩnh sai.
4. **`npm run qa:security` (`scripts/qa/security_api.mjs`) & `npm run qa:hardening` (`scripts/qa/security_hardening.mjs`)**:
   - Kiểm tra security headers (`CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`), chống IDOR, brute-force lock theo email (5 lần sai/15 phút) và theo IP (`cf-connecting-ip`), chống giả mạo call token WebRTC, chống XSS/SQLi/SVG upload và xóa tài khoản theo chuẩn App Store Guideline 5.1.1(v).

### 3.4. Test Playwright (`tests/*.spec.ts` vs. `scripts/qa/*.mjs`)
Hiện có 2 hệ thống test dùng Playwright trong repo:
- **Bộ `@playwright/test` ở thư mục gốc (`playwright.config.ts` + `tests/*.spec.ts`)**:
  - Gồm 17 test case chia làm 3 file (`tests/home.spec.ts`, `tests/navigation.spec.ts`, `tests/forms-and-http.spec.ts`).
  - Được tạo để chạy qua lệnh chuẩn `npx playwright test --reporter=html,list` và xuất báo cáo ra `playwright-report/`.
  - **Tình trạng hiện tại:** Lần chạy đầu đạt **6 Pass / 9 Fail / 2 Flaky** (chi tiết từng test fail, nguyên nhân gốc và cách sửa nằm ở **Mục 5.1**).
- **Bộ script QA chuyên sâu trong `scripts/qa/*.mjs`**:
  - Hơn 60 script chạy trực tiếp bằng `node scripts/qa/<tên_file>.mjs` trên server production build (`next start`), sử dụng helper chung `scripts/qa/lib.mjs`.

### 3.5. `sendChat` Helper (`scripts/qa/lib.mjs` & worktree `qa-sendchat-suites`)
- **Bối cảnh kỹ thuật:** Trong giao diện Messenger V2 (`components/chat/MessagesContent.tsx`), ô nhập tin nhắn được đổi từ `input[type="text"]` sang `textarea[data-chat-input]`. Trên thiết bị di động / màn hình cảm ứng (`isMobile: true, hasTouch: true`), phím `Enter` có tác dụng **xuống dòng** chứ không gửi tin nhắn; để gửi tin phải bấm nút có `aria-label` là `"Gửi tin nhắn"` (VI) hoặc `"Send message"` (EN).
- **Giải pháp đã có trong `scripts/qa/lib.mjs` (dòng 113–117)**:
  ```js
  export async function sendChat(page, text) {
    const input = page.locator("[data-chat-input]").filter({ visible: true }).first();
    await input.fill(text);
    await page.getByRole("button", { name: /^(Gửi tin nhắn|Send message)$/ }).first().click();
  }
  ```
- **Phần đang làm dở:** Trong worktree `.claude/worktrees/qa-sendchat-suites` (nhánh `qa-sendchat-suites`, `5 files changed, 167 insertions(+), 83 deletions(-)`), có **5 file test QA đang sửa dở (uncommitted)** để chuyển từ `.press("Enter")` / `.pn-composer input[type=text]` sang dùng `sendChat(page, text)` và selector `[data-chat-input]` + hỗ trợ song ngữ EN/VI:
  1. `scripts/qa/chat_assist_test.mjs`
  2. `scripts/qa/messenger_ux.mjs`
  3. `scripts/qa/msg_latency.mjs`
  4. `scripts/qa/persona_deep.mjs`
  5. `scripts/qa/sound_test.mjs`

### 3.6. Nút đăng nhập Social (`components/auth/SocialLogin.tsx` & worktree `auth-social-cls`)
- **Vấn đề trên `main` hiện tại (`components/auth/SocialLogin.tsx`)**:
  - `SocialLogin` khởi tạo `providers = []` (render `null` ở lần paint đầu tiên), sau đó mới gọi `getProviders()` trong `useEffect` phía client. Khi API `/api/auth/providers` trả về danh sách provider (`google`, `apple`, `facebook`, `test-oauth`, `phone-otp`), khối nút OAuth bất ngờ chèn vào phía trên form email trên trang `/auth/login` và `/auth/register`, gây **độ lệch bố cục (CLS `0.11–0.16`)** trên điện thoại.
- **Giải pháp đang làm dở trong worktree `.claude/worktrees/auth-social-cls` (8 file modified + 1 file mới, chưa commit / chưa merge)**:
  - File mới `lib/signInProviders.ts`: xuất hàm `signInProviderIds()` đọc trực tiếp cấu hình provider từ biến môi trường trên server (`smsEnabled()` + `oauthProviders()`).
  - `app/[lang]/auth/login/layout.tsx` và `app/[lang]/auth/register/layout.tsx`: bọc cây con bằng `<SignInProviders ids={signInProviderIds()}>` để các nút Social có mặt ngay trong HTML tĩnh lần paint đầu tiên (`CLS = 0`).
  - `components/auth/SocialLogin.tsx`: đọc danh sách khởi tạo từ `ProvidersContext`, vẫn gọi `getProviders()` trong `useEffect` để tự cập nhật nếu server `next start` chạy với biến môi trường runtime khác lúc build; dùng `useSyncExternalStore` cho `Capacitor.isNativePlatform()` kết hợp thuộc tính `data-native-hide=""`.
  - `app/[lang]/layout.tsx`, `app/globals.css`, `components/auth/auth.css`, `app/[lang]/auth/register/page.tsx`: gắn `html[data-native]` (khi `User-Agent` chứa `"PawNailApp"`) và `html[data-reg-role]` (khi URL có `?role=client|technician|owner`) ngay từ head script trước khi vẽ, kết hợp CSS `html[data-native] [data-native-hide] { display: none !important; }` để ẩn hoàn toàn nút OAuth trên app native mà không giật khung hình.

---

## 4. File và thư mục quan trọng, vai trò từng cái

| Đường dẫn | Vai trò chi tiết |
| :--- | :--- |
| `app/[lang]/` | Toàn bộ cây giao diện App Router theo ngôn ngữ (`lang = "en" \| "vi"`): trang chủ (`page.tsx`), đăng nhập/đăng ký (`auth/`), việc làm (`jobs/`), mẫu móng (`designs/`), thử mẫu (`tryon/`), soi tay (`consult/`), danh bạ tiệm (`salons/`), menu QR (`menu/[uid]/`), hồ sơ (`profile/`), tin nhắn (`messages/`), đặt lịch (`bookings/`), công cụ (`tools/`), chợ vật tư (`supply/`), hỗ trợ (`support/`), xóa dữ liệu (`data-deletion/`), quản trị (`admin/`). |
| `app/api/` | Hơn 75 API Route Handlers: xác thực (`auth/`), việc làm & đồng bộ (`jobs/`, `ingest/jobs/`), tin nhắn & dịch (`messages/`, `conversations/`), gọi WebRTC (`calls/`, `calls/ice/`), thông báo đẩy (`push/native/`, `push/subscribe/`, `pusher/auth/`), menu & đặt lịch (`menu/`, `bookings/`), mẫu móng & Flow (`designs/`, `admin/designs/flow/`), cron jobs (`cron/`). |
| `proxy.ts` | Middleware cấp cao của Next.js 16: điều hướng/rewrite ngôn ngữ EN-first (`/` → `/en`, `/vi` → `/vi`), rewrite trang đăng ký theo vai trò (`?role=` → `/[lang]/auth/register/[role]`), và giới hạn tần suất (rate-limit) theo IP thực (`cf-connecting-ip`) cho các API nhạy cảm. |
| `next.config.ts` | Cấu hình Next.js 16 + `next-pwa` (chiến lược `NetworkOnly` cho `/api/*` để không lưu cache PII trên đĩa, không precache `.map`, trang fallback `/offline`) + `@sentry/nextjs` + bộ header bảo mật (`CSP`, `HSTS`, `X-Frame-Options`). |
| `prisma/schema.prisma` | Schema cơ sở dữ liệu (SQLite local `prisma/dev.db` / Turso LibSQL production): `User`, `TechnicianProfile`, `Job`, `ExternalJob`, `Post`, `PostComment`, `Conversation`, `Message`, `MenuItem`, `BookingRequest`, `NailDesign`, `SupplyProduct`, `PushSubscription`, `Report`, `Block`, v.v. |
| `prisma/sql/` | Các bản vá SQL tăng trưởng/chỉ mục (`add_fk_and_filter_indexes.sql`, `2026-11-07_external_jobs.sql`, `2026-11-06_hide_demo_digest_posts.sql`, `2026-11-08_hide_bad_jobs.sql`) chạy qua `scripts/apply-sql.ts`. |
| `lib/prisma.ts` | Khởi tạo Prisma Client: tự động dùng `@prisma/adapter-libsql` (Turso) khi có `TURSO_DATABASE_URL` (ngoài pha build) và fallback về SQLite `file:./dev.db` ở local. |
| `lib/authOptions.ts` & `lib/authProviders.ts` | Cấu hình NextAuth (chiến lược JWT thuần, khóa tạm 15 phút sau 5 lần sai mật khẩu, tích hợp Credentials, Phone OTP Twilio Verify, Google, Apple, Facebook và Test OAuth cho QA). |
| `lib/i18n/` | Hạ tầng đa ngôn ngữ: `config.ts`, `server.ts`, `LanguageProvider.tsx`, `tr.ts`, `useTr.ts`, `localeHref.ts` (giữ tiền tố `/vi` khi điều hướng), `dataEn.ts` / `dtEn.ts` (dịch dữ liệu lưu DB), và từ điển `dictionaries/{en,vi}.json`. |
| `lib/calls/` & `components/chat/CallManager.tsx` | Toàn bộ ngăn xếp gọi thoại/video 1-1 WebRTC tự chủ: `peer.ts`, `signalQueue.ts`, `signalWire.ts`, `callToken.ts` (HMAC 3 giờ), `iceServers.ts` (STUN + Cloudflare TURN), `iceClient.ts`, `callPush.ts`. |
| `lib/tryon/` & `lib/designEngine.ts` | Động cơ đồ họa vẽ mẫu móng lên ảnh bàn tay thật (`engine.ts`, `finder.ts`, `patterns.ts`, `sets.ts`, `tryon.worker.ts`) chạy hoàn toàn phía client. |
| `lib/jobIngest/` & `lib/jobFeeds/` | Bộ phân tích cú pháp tin tuyển thợ từ văn bản tự do (tách SĐT Mỹ/Úc, ZIP → bang/thành phố, lương, kỹ năng) và đồng bộ nguồn việc làm đối tác (`Adzuna`, `Careerjet`). |
| `lib/fcm.ts`, `lib/apns.ts`, `lib/push.ts` | Gửi thông báo đẩy Web Push (VAPID), Android Native (FCM HTTP v1 ký JWT RS256, hỗ trợ data-only payload cho build 3+) và iOS Native (APNs HTTP/2 ký JWT ES256). |
| `components/` | Các nhóm component giao diện theo miền: `auth/`, `booking/`, `chat/`, `client/`, `designs/`, `feed/`, `home/`, `jobs/`, `layout/`, `menu/`, `onboarding/`, `profile/`, `pwa/`, `season/`, `settings/`, `supply/`, `technicians/`, `tools/`, `tryon/`, `ui/`. |
| `android/` | Dự án Capacitor Android (`com.bitpawos.app`), gồm mã Java tùy chỉnh trong `android/app/src/main/java/com/bitpawos/app/` xử lý FCM data-only, bong bóng chat (Android Bubbles), trả lời nhanh và App Links. |
| `ios/` | Dự án Capacitor iOS dùng Swift Package Manager (`ios/App/App.xcodeproj`, `CapApp-SPM`), cấu hình quyền trong `ios/App/App/Info.plist` và tự động hóa build/upload TestFlight trong `ios/App/fastlane/Fastfile`. |
| `.github/workflows/deploy-ios.yml` | GitHub Actions workflow (`macos-14`, `workflow_dispatch`) tự động cài Node 22, build Next.js, `npx cap sync ios` và chạy Fastlane xuất `.ipa` đẩy lên TestFlight. |
| `docs/` | Tài liệu vận hành quan trọng: `docs/store-submission.md` (hướng dẫn nộp CH Play & App Store), `docs/calls.md` (kiến trúc WebRTC & cách bật Cloudflare TURN), `docs/ingest-api.md` (API nối bot nhóm Facebook). |
| `scripts/qa/` & `scripts/i18n/` | Hơn 60 kịch bản kiểm thử tự động (Playwright E2E, bảo mật, hiệu năng CLS/LCP, WebRTC calls, push notifications, try-on unit tests) và công cụ kiểm tra đa ngôn ngữ. |
| `playwright.config.ts` & `tests/` | Cấu hình `@playwright/test` và 3 file test E2E cơ bản (`home.spec.ts`, `navigation.spec.ts`, `forms-and-http.spec.ts`). |
| `.claude/worktrees/` | Các git worktree độc lập chứa các nhánh tính năng/sửa lỗi đang phát triển (`auth-social-cls`, `qa-sendchat-suites`, `native-v4-calls`, `chat-telegram-extras`, `store-assets`...). |

---

## 5. Test nào đang Fail, Kết quả Unit Test thực tế & Các lỗi đã biết

### 5.1. Kết quả kiểm tra Unit Test & Kiểm tra tĩnh vừa chạy trên `HEAD` (`ba4abd9`)
Tất cả các bộ kiểm tra tĩnh và unit test cốt lõi dưới đây đã được chạy kiểm chứng trực tiếp và **PASS 100%**:
- `npx tsc --noEmit -p .`: **PASS (`exit code 0`)** *(Lưu ý: cần xóa `.next/types` và `.next/dev/types` cũ nếu chuyển từ nhánh trước khi có `app/[lang]`, xem mục 5.3)*.
- `npm run i18n:check`: **PASS** (`154 keys`, 0 thiếu, 0 rỗng, 0 chữ Việt trong `en.json`, `tr_concurrency_test` 24/24 PASS).
- `node scripts/i18n/check-eager.mjs`: **PASS** (0 lỗi gọi `tr()` sớm ở cấp module).
- `npx tsx scripts/qa/call_signal_unit.mts`: **44/44 PASS**.
- `npx tsx scripts/qa/call_ice_unit.mts`: **22/22 PASS**.
- `npx tsx scripts/qa/call_ice_client_unit.mts`: **12/12 PASS**.
- `npx tsx scripts/qa/pusher_resub_unit.mts`: **16/16 PASS**.
- `npx tsx scripts/qa/safe_redirect_unit.mts`: **27/27 PASS**.
- `npx tsx scripts/qa/season_unit.mts`: **19/19 PASS**.
- `npx tsx scripts/qa/designs_first_paint_unit.mts`: **16/16 PASS**.
- `npx tsx scripts/qa/fcm_payload_unit.mts`: **38/38 PASS**.
- `npx tsx scripts/qa/stickers_unit.mts`: **67/67 PASS**.
- `npx tsx scripts/qa/chat_assist_unit.mts`: **23/23 PASS**.

### 5.2. Bộ test `@playwright/test` ở thư mục gốc (`npx playwright test`)
Trong lần chạy lưu tại `test-results/` và `playwright-report/` (17 test: **6 Pass, 9 Fail, 2 Flaky**), danh sách cụ thể và nguyên nhân như sau:

| Test Case | File | Trạng thái | Nguyên nhân gốc rễ & Cách sửa |
| :--- | :--- | :--- | :--- |
| `TC-HOME-01`, `TC-HOME-02` | `tests/home.spec.ts` | **FAIL** | 1) Chạy trên `next dev --webpack` với `workers: 2` bị race condition khi ghi `.next/*-manifest.json` (`SyntaxError: Unexpected end of JSON input`), gây HTTP `500` tạm thời ở `/api/studio`, `/api/radar`, `/api/supply`, `/api/posts`, `/api/jobs`.<br>2) Giao diện `/` cho khách chưa đăng nhập đã chuyển sang trang Landing EN-first mới (không hiển thị Sidebar 3 tab `Bảng Tin / Cần Thợ Gấp / Thợ Đang Rảnh` của thành viên). |
| `TC-HOME-03`, `TC-HOME-04`, `TC-HOME-05` | `tests/home.spec.ts` | **PASS** | Đã chạy xanh. |
| `TC-NAV-01` | `tests/navigation.spec.ts` | **PASS** | Đã chạy xanh. |
| `TC-NAV-02`, `TC-NAV-03` | `tests/navigation.spec.ts` | **FAIL** | Server dev khởi động qua `playwright.config.ts` chưa truyền `SHOW_DEMO_DATA=1`. Khi không có `SHOW_DEMO_DATA=1`, hàm `realOnly()` (`lib/demo.ts`) lọc bỏ toàn bộ tài khoản mẫu `@pawnailjobs.demo` trong `prisma/dev.db`, làm `/api/salons` và `/api/technicians` trả về `[]`. |
| `TC-NAV-04`, `TC-NAV-05` | `tests/navigation.spec.ts` | **FAIL** | Timeout 60s do `next dev --webpack` biên dịch lần đầu các route `/auth/login`, `/profile`, `/trends` quá chậm khi chạy song song 2 worker; ngoài ra khách chưa đăng nhập ở `/` không có `aside a[href="/designs"]`. |
| `TC-FORM-01`, `TC-FORM-02` | `tests/forms-and-http.spec.ts` | **FAIL** | Timeout khi chờ `/api/auth/callback/credentials` do `next dev --webpack` đang bận biên dịch route ở worker bên cạnh (nút đăng nhập kẹt ở trạng thái `"Đang xử lý..."`). |
| `TC-FORM-03` | `tests/forms-and-http.spec.ts` | **FAIL** | Truy cập `/auth/register?role=technician` (mặc định tiếng Anh) nhưng tìm `getByPlaceholder("ban@email.com")` (placeholder tiếng Việt chỉ xuất hiện trên `/vi/auth/register?role=technician`). |
| `TC-FORM-04`, `TC-FORM-05` | `tests/forms-and-http.spec.ts` | **PASS** | Đã chạy xanh. |
| `TC-HTTP-01`, `TC-HTTP-02` | `tests/forms-and-http.spec.ts` | **FLAKY** (Fail lần 1, Pass ở retry #1) | Lần chạy đầu bị timeout 60s do chờ `next dev --webpack` biên dịch; đến lần retry #1 khi route đã biên dịch xong thì PASS 100%. |

### 5.3. Các lưu ý / lỗi môi trường đã biết (Bắt buộc đọc để tránh mất thời gian)
1. **Lỗi giả `TS2307` trong `.next/types` và `.next/dev/types` khi chạy `npx tsc --noEmit`**:
   - Nếu thư mục `.next/types` hoặc `.next/dev/types` còn chứa file stub cũ từ trước đợt chuyển cấu trúc `app/` sang `app/[lang]/` (hoặc route cũ `app/api/zego/token/route.js`), `tsc` sẽ báo hàng loạt lỗi `TS2307: Cannot find module '.../app/page.js'`.
   - **Cách xử lý:** Xóa `.next/types` và `.next/dev/types` trước khi chạy `npx tsc --noEmit -p .` (đã kiểm chứng: sau khi xóa, `tsc` trả về `exit code 0`).
2. **Đặc thù trên Windows với biến môi trường `TURSO_DATABASE_URL` và lệnh `bash`**:
   - **Về `TURSO_DATABASE_URL`**: File `.env` ở thư mục gốc đang trỏ tới **Turso Production**. Các script test DB (`external_jobs_unit.mts`, `job_phone_market_unit.mts`, `_temp_sqlite.ts`) có chốt chặn:
     ```ts
     if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local...");
     ```
     Trên Windows, gán `$env:TURSO_DATABASE_URL = ""` trong PowerShell sẽ **xóa** biến đó khỏi environment block; khi `@prisma/client` được `import` (hoisted lên đầu file ESM), thấy biến chưa định nghĩa nên Prisma **tự động đọc lại file `.env` ở thư mục gốc** và nạp lại URL Turso Production!
     **Cách chạy đúng trên Windows:** Chạy các test chạm DB từ bên trong một worktree không có file `.env` (ví dụ `.claude/worktrees/call-ready`), hoặc tạm thời đổi tên `.env` / tạo `.env.production.local` ghi đè `TURSO_DATABASE_URL=""` khi chạy `next start`.
   - **Về lệnh `bash` trên Windows**: `C:\Windows\System32\bash.exe` là WSL (máy hiện chưa cài distro WSL nên chạy `bash` trần sẽ báo `Windows Subsystem for Linux has no installed distributions`). Phải gọi **Git Bash** tại đường dẫn `"C:\Program Files\Git\bin\bash.exe"`.
3. **`ios/App/App/ViewController.swift` chưa nằm trong `PBXSourcesBuildPhase` của `ios/App/App.xcodeproj/project.pbxproj`**:
   - `Main.storyboard` trỏ `customClass="ViewController" customModule="App"`, nhưng `project.pbxproj` hiện mới liệt kê `AppDelegate.swift` và `SceneDelegate.swift` trong `PBXSourcesBuildPhase`. Trên Capacitor 8, `WebViewDelegationHandler.swift` của Capacitor đã tự xử lý `requestMediaCapturePermissionFor` -> `.grant`, nhưng khi mở Xcode trên macOS cần thêm `ViewController.swift` vào target `App` (hoặc đặt lại `customClass="CAPBridgeViewController" customModule="Capacitor"` trong `Main.storyboard`).
4. **Báo cáo cũ `scripts/qa/reports/calls.json`**:
   - File `scripts/qa/reports/calls.json` (ghi nhận 8/14 lỗi timeout ZEGOCLOUD) là báo cáo lịch sử từ tháng 10/2026 trước khi gỡ ZEGOCLOUD, không phản ánh hệ thống WebRTC hiện tại.

---

## 6. Cách cài đặt, chạy dự án và chạy Test

### 6.1. Yêu cầu môi trường
- **Node.js:** `>= 22.0.0` (máy hiện tại đang dùng `Node.js v24.16.0`; bắt buộc `>= 22` cho `@capacitor/cli@^8.5.2`).
- **Cơ sở dữ liệu local:** SQLite (`prisma/dev.db` đã có sẵn dữ liệu seed).

### 6.2. Cài đặt & Chạy dự án ở Local
```bash
# 1. Cài đặt dependencies (tự động chạy postinstall: prisma generate)
npm install

# 2. Xóa cache kiểu cũ (nếu có) và kiểm tra TypeScript
rm -rf .next/types .next/dev/types
npx tsc --noEmit -p .

# 3. Chạy máy chủ phát triển (Development mode — http://localhost:3000)
npm run dev

# 4. Build và chạy máy chủ Production ở Local (khuyên dùng khi chạy E2E test)
# Luôn đảm bảo TURSO_DATABASE_URL="" trong .env.production.local để chỉ dùng SQLite local!
SHOW_DEMO_DATA=1 npm run build
SHOW_DEMO_DATA=1 npm run start
```

**Tài khoản mẫu có sẵn trong `prisma/dev.db` (cần bật `SHOW_DEMO_DATA=1` để hiển thị trên các API danh sách công khai):**
- Chủ tiệm 1: `owner1.us@pawnailjobs.demo`
- Chủ tiệm 2: `owner2.us@pawnailjobs.demo`
- Thợ nail 1: `tech1.us@pawnailjobs.demo`
- Thợ nail 2..5: `tech2.us@pawnailjobs.demo` … `tech5.us@pawnailjobs.demo`
- Mật khẩu dùng chung cho tài khoản demo: xem hằng số `DEMO_PASSWORD` trong `scripts/qa/lib.mjs`.

### 6.3. Danh sách toàn bộ Biến môi trường trong mã nguồn (Chỉ ghi tên biến, KHÔNG ghi giá trị khóa)

| Nhóm chức năng | Tên biến môi trường (`process.env.*`) | Mô tả / Nơi sử dụng |
| :--- | :--- | :--- |
| **Cơ sở dữ liệu** | `DATABASE_URL` | Đường dẫn SQLite local (mặc định `file:./dev.db`). |
| | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Kết nối Turso LibSQL Cloud trên Production (đặt bằng `""` khi chạy test local). |
| **Xác thực & Phiên** | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Khóa ký JWT NextAuth và URL gốc của ứng dụng (`https://www.bitpawos.com`). |
| | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Đăng nhập OAuth qua Google (`lib/authProviders.ts`). |
| | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Đăng nhập OAuth qua Facebook. |
| | `APPLE_ID`, `APPLE_SECRET` (hoặc `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`) | Đăng nhập Sign in with Apple. |
| | `SESSION_RECHECK_MS` | Chu kỳ kiểm tra lại phiên đăng nhập (đặt `=0` khi chạy QA tốc độ cao). |
| **SMS & Điện thoại** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Xác minh SĐT và đăng nhập OTP qua Twilio Verify (`lib/sms.ts`). |
| | `SMS_LIVE`, `NEXT_PUBLIC_NATIVE_PHONE_LOGIN` | Bật đăng nhập/xác minh SMS thật (`1`) và hiển thị đăng nhập SĐT trong app native (`1`). |
| **Lưu trữ & Media** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Tải ảnh/video/ghi âm lên Cloudinary (`app/api/upload/*`). |
| | `NEXT_PUBLIC_GIPHY_API_KEY` | Tìm kiếm GIF trong Messenger (`app/api/gifs/route.ts`). |
| **Realtime (Pusher)** | `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Kênh realtime cho Messenger, trạng thái online/đang gõ và signaling cuộc gọi WebRTC. |
| **Gọi WebRTC (TURN/STUN)** | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | **(Khuyên dùng trên Vercel)** Cấp thông tin xác thực TURN động từ Cloudflare Realtime (`app/api/calls/ice/route.ts`). |
| | `TURN_URLS`, `TURN_SECRET`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `CALL_STUN_URLS`, `CALL_SIGNING_SECRET` | Tùy chọn cấu hình máy chủ coturn riêng hoặc STUN/khóa ký call token. |
| **Thông báo đẩy (Push)** | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push (PWA Service Worker). |
| | `FIREBASE_SERVICE_ACCOUNT`, `NATIVE_RICH_CHAT_MIN_BUILD` | Chuỗi JSON Service Account gửi thông báo đẩy Android qua FCM HTTP v1 (`lib/fcm.ts`) và ngưỡng `versionCode` nhận data-only chat (mặc định `3`). |
| | `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` | Khóa `.p8` để gửi thông báo đẩy iOS qua APNs HTTP/2 (`lib/apns.ts`). |
| **AI & Nội dung** | `GEMINI_API_KEY`, `AI_DESIGNS_DAILY_LIMIT`, `AI_IMAGES_DAILY` | Phân tích soi tay tư vấn (`/consult`), gợi ý thiết kế và dịch thuật (`lib/gemini.ts`). |
| | `CF_ACCOUNT_ID`, `CF_AI_TOKEN` | Cloudflare Workers AI tạo ảnh/văn bản phụ trợ (`lib/cfImage.ts`, `lib/cfText.ts`). |
| **Email & Hỗ trợ** | `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SUPPORT_EMAIL` | Gửi email đặt lại mật khẩu và bản tin tuần qua Resend (`lib/email.ts`). |
| **Thu thập Việc làm & Đối tác** | `PAWNAIL_INGEST_KEY`, `INGEST_KEY`, `CRAWLER_KEY`, `INGEST_AGGREGATED`, `INGEST_TTL_DAYS`, `JOB_TTL_DAYS`, `JOB_TTL_ROLLOUT` | Khóa xác thực và cấu hình thời hạn cho bot nhóm cộng đồng gửi tin về `/api/ingest/jobs` & `/api/jobs/sync`; đặt `INGEST_AGGREGATED=off` để ngắt khẩn cấp. |
| | `EXTERNAL_JOBS_ADZUNA`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_ATTRIBUTION_LABEL`, `ADZUNA_LICENSE_REF`, `ADZUNA_MAX_PAGES` | Cấu hình đồng bộ nguồn việc làm đối tác Adzuna (`lib/jobFeeds/adzuna.ts`). |
| | `EXTERNAL_JOBS_CAREERJET`, `CAREERJET_API_KEY`, `CAREERJET_AFFID`, `CAREERJET_TERMS_CONFIRMED`, `EXTERNAL_JOBS_PURGE_DAYS`, `EXTERNAL_JOBS_REFERRAL_FEE`, `EXTERNAL_JOBS_SEEN_TTL_HOURS` | Cấu hình nguồn việc làm đối tác Careerjet (`lib/jobFeeds/careerjet.ts`). |
| | `CRON_SECRET` | Khóa bảo vệ các route `/api/cron/*`. |
| **App Links & Giới hạn** | `ANDROID_APP_LINK_SHA256`, `JOBS_PER_DAY`, `COLD_DM_DAILY` | Fingerprint SHA-256 bổ sung cho `/.well-known/assetlinks.json` và giới hạn chống spam mỗi ngày (`lib/abuseGuard.ts`). |
| **Giám sát & CI/CD** | `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN` | Báo lỗi và tải source map lên Sentry. |
| | `APP_STORE_KEY_ID`, `APP_STORE_ISSUER_ID`, `APP_STORE_PRIVATE_KEY` | GitHub Actions Secrets dùng cho Fastlane ký và đẩy bản build iOS `.ipa` lên TestFlight. |
| **Cờ kiểm thử Local** | `SHOW_DEMO_DATA`, `QA_DB_URL` | Chỉ dùng ở local để hiển thị tài khoản `@pawnailjobs.demo` và trỏ file SQLite QA tạm. *(Các cờ `*_ALLOW_TEST*` trong `start-launch-server.sh` chỉ dùng cho mock server local, tuyệt đối không đặt trên Vercel).* |

### 6.4. Cách chạy các bộ Test
```bash
# 1. Kiểm tra TypeScript & Đa ngôn ngữ (không cần chạy server)
npx tsc --noEmit -p .
npm run i18n:check
node scripts/i18n/check-eager.mjs

# 2. Chạy các bộ Unit Test không chạm DB
npx tsx scripts/qa/call_signal_unit.mts
npx tsx scripts/qa/call_ice_unit.mts
npx tsx scripts/qa/call_ice_client_unit.mts
npx tsx scripts/qa/pusher_resub_unit.mts
npx tsx scripts/qa/safe_redirect_unit.mts
npx tsx scripts/qa/season_unit.mts
npx tsx scripts/qa/designs_first_paint_unit.mts
npx tsx scripts/qa/fcm_payload_unit.mts
npx tsx scripts/qa/stickers_unit.mts
npx tsx scripts/qa/chat_assist_unit.mts
npm run qa:tryon

# 3. Chạy các Unit Test dùng SQLite tạm (trên Windows nên chạy từ worktree không có .env)
cd .claude/worktrees/call-ready
npx tsx scripts/qa/job_phone_market_unit.mts
npm run qa:jobfeeds

# 4. Kiểm tra danh sách route tĩnh sau khi chạy `npm run build`
npm run i18n:static-routes

# 5. Chạy bộ kiểm thử E2E bằng Playwright CLI và xem báo cáo HTML trực quan
PLAYWRIGHT_HTML_OPEN=never npx playwright test --reporter=html,list
npx playwright show-report

# 6. Chạy các bộ QA chuyên sâu (cần server local đang chạy ở http://localhost:3000 với SHOW_DEMO_DATA=1)
npm run qa:security
npm run qa:hardening
npm run qa:ui
npm run qa:flows
npm run qa:ssr-locale

# 7. Chạy bộ kiểm thử đợt chốt phát hành (dùng Git Bash trên Windows)
"C:\Program Files\Git\bin\bash.exe" scripts/qa/start-launch-server.sh &
node scripts/qa/launch_test.mjs

# 8. Chạy bộ kiểm thử cuộc gọi WebRTC 1-1 tích hợp
"C:\Program Files\Git\bin\bash.exe" scripts/qa/start-call-server.sh &
BASE_URL=http://localhost:3210 node scripts/qa/call_test.mjs
```

---

## 7. Các bước tiếp theo theo thứ tự ưu tiên

### Ưu tiên P0 — Hoàn tất các bản vá đang dở trong Worktree & Làm xanh toàn bộ Test
1. **Commit và gộp bản vá CLS nút đăng nhập Social từ `.claude/worktrees/auth-social-cls`**:
   - Kiểm tra 8 file đã sửa + `lib/signInProviders.ts` trong `.claude/worktrees/auth-social-cls`.
   - Chạy `npm run build`, `node scripts/qa/polish_gate.mjs --quick` và `node scripts/qa/launch_test.mjs` (mục `OA1–OA10`), sau đó commit và merge vào `main`.
2. **Commit và gộp 5 bộ test `sendChat` từ `.claude/worktrees/qa-sendchat-suites`**:
   - Kiểm tra 5 file test đã cập nhật `sendChat(page, text)` trong `.claude/worktrees/qa-sendchat-suites` (`chat_assist_test.mjs`, `messenger_ux.mjs`, `msg_latency.mjs`, `persona_deep.mjs`, `sound_test.mjs`), chạy thử trên server local và merge vào `main`.
3. **Cập nhật `playwright.config.ts` và `tests/*.spec.ts` để đạt 17/17 PASS ổn định**:
   - Trong `playwright.config.ts`: thêm `env: { SHOW_DEMO_DATA: "1", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", DATABASE_URL: "file:./dev.db" }` vào `webServer`, đặt `workers: 1` (hoặc dùng `npm run start` sau khi build) để triệt tiêu lỗi race condition của `next dev --webpack`.
   - Trong `tests/home.spec.ts`, `tests/navigation.spec.ts`, `tests/forms-and-http.spec.ts`: cập nhật selector khớp với giao diện **EN-first** mới (hoặc điều hướng vào `/vi/...` khi kiểm tra giao diện tiếng Việt).

### Ưu tiên P1 — Cấu hình Hạ tầng Production trước khi ra mắt
4. **Bật Cloudflare Realtime TURN trên Vercel (`pawbook-web`)**:
   - Tạo TURN key trên Cloudflare Dashboard (`Realtime → TURN Server`), thêm `CLOUDFLARE_TURN_KEY_ID` và `CLOUDFLARE_TURN_API_TOKEN` vào Vercel Production, redeploy và kiểm tra `GET /api/calls/ice` trả về `hasTurn: true` (theo `docs/calls.md`).
5. **Cấu hình Push Notifications thật cho Android (FCM) & iOS (APNs)**:
   - Tạo project Firebase cho `com.bitpawos.app`, đặt `android/app/google-services.json` vào repo và cài `FIREBASE_SERVICE_ACCOUNT` lên Vercel.
   - Tạo khóa APNs `.p8` trên Apple Developer Portal và cài `APNS_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID=com.bitpawos.app` lên Vercel (theo `docs/store-submission.md`).

### Ưu tiên P2 — Hoàn thiện Native App & Nộp lên Google Play / App Store
6. **Hoàn tất nhánh `.claude/worktrees/native-v4-calls` (Android `versionCode 4 / 1.3.0`)**:
   - Kiểm tra 6 file đang sửa dở trong worktree `native-v4-calls`, chạy `fcm_payload_unit.mts`, `native_call_unit.mts` và `call_test.mjs` (phần `native`), commit và merge vào `main` trước khi build file `.aab` nộp Google Play.
7. **Kiểm tra `ViewController.swift` trên Xcode / GitHub Actions iOS**:
   - Khai báo `APP_STORE_KEY_ID`, `APP_STORE_ISSUER_ID`, `APP_STORE_PRIVATE_KEY` trong GitHub Repository Secrets và kích hoạt workflow `.github/workflows/deploy-ios.yml` (`workflow_dispatch`) để xuất `.ipa` lên TestFlight.
   - Tạo 2 tài khoản demo thật trên `https://www.bitpawos.com` và điền thông tin vào mục App Review Notes khi gửi duyệt App Store / Google Play.

### Ưu tiên P3 — Dọn dẹp sau bàn giao
8. **Dọn dẹp nhánh `wip-handover` và các worktree đã merge**:
   - Không đưa các thư mục báo cáo tạm (`playwright-report/`, `test-results/`, `.claude/wf-scripts/`) vào nhánh `main`; thêm `playwright-report/` và `test-results/` vào `.gitignore`.
   - Sau khi gộp xong `auth-social-cls`, `qa-sendchat-suites` và `native-v4-calls`, chạy `git worktree prune` để dọn các worktree đã hoàn thành.
