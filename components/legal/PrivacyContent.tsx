"use client";

import Link from "next/link";
import { useTr } from "@/lib/i18n/useTr";

// Chính sách bảo mật — đối chiếu đúng dữ liệu app THỰC SỰ thu thập
// (prisma/schema.prisma + API). Cập nhật 05/10/2026: xác minh SĐT qua SMS,
// đăng nhập Google/Apple, thông báo đẩy trên app, "ai đã xem hồ sơ", báo việc.
// Bản nháp: chủ doanh nghiệp điền mục [để trống] và rà lại trước khi nộp store.
const S = "space-y-2";
const H2 = "text-lg font-bold text-white";
const B = "text-slate-100";
const MAIL = <a href="mailto:support@bitpawos.com" className="text-pink-400 underline underline-offset-2">support@bitpawos.com</a>;

function PrivacyVi() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-white mb-2">Chính sách bảo mật</h1>
        <p className="text-xs text-slate-500">Cập nhật lần cuối: 05/10/2026</p>
      </div>
      <p>PawNail Jobs (&quot;chúng tôi&quot;) vận hành nền tảng kết nối chủ tiệm nail và thợ nail tại Mỹ &amp; Úc, truy cập qua website <strong className="text-white">bitpawos.com</strong> và ứng dụng di động PawNail Jobs trên App Store / CH Play. Chính sách này giải thích chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn như thế nào.</p>
      <section className={S}>
        <h2 className={H2}>1. Thông tin chúng tôi thu thập</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className={B}>Thông tin tài khoản:</strong> họ tên, email, số điện thoại, mật khẩu (mã hóa bcrypt, không bao giờ lưu dạng thô), vai trò (Chủ tiệm / Thợ Nail), khu vực (thị trường, bang, thành phố). Nếu bạn đăng nhập bằng Google hoặc Apple, chúng tôi chỉ nhận tên và email đã xác minh từ tài khoản đó.</li>
          <li><strong className={B}>Xác minh số điện thoại:</strong> khi bạn chọn xác minh, số điện thoại được gửi tới Twilio để gửi mã SMS. Chúng tôi chỉ lưu việc số đó đã được xác minh, không lưu mã.</li>
          <li><strong className={B}>Hồ sơ Chủ tiệm:</strong> câu trả lời khảo sát vận hành tiệm (không bắt buộc), tin tuyển dụng đã đăng (tiêu đề, tên tiệm, mức lương, kỹ năng, quyền lợi, ảnh/video tiệm, số điện thoại liên hệ).</li>
          <li><strong className={B}>Hồ sơ Thợ Nail:</strong> giới thiệu bản thân, số năm kinh nghiệm, chuyên môn, ảnh/video portfolio, mức lương và quyền lợi mong muốn, các tiêu chí báo việc bạn lưu.</li>
          <li><strong className={B}>Lượt xem hồ sơ:</strong> khi bạn xem hồ sơ người khác, chúng tôi ghi nhận lượt xem (tối đa 1 lần/ngày). Thợ được xem tên tiệm đã xem hồ sơ mình; thợ xem hồ sơ thợ khác thì chỉ được đếm, không hiện tên.</li>
          <li><strong className={B}>Nội dung nhắn tin:</strong> tin nhắn văn bản, ảnh, GIF/sticker bạn gửi trong cuộc trò chuyện với người dùng khác.</li>
          <li><strong className={B}>Dữ liệu cuộc gọi:</strong> tín hiệu kết nối (không phải nội dung âm thanh/hình ảnh) được truyền qua Pusher và ZegoCloud để thiết lập cuộc gọi.</li>
          <li><strong className={B}>Thông báo đẩy:</strong> nếu bạn bật thông báo, chúng tôi lưu mã thiết bị (do trình duyệt, Google Firebase hoặc Apple cấp) để gửi thông báo tới máy bạn.</li>
          <li><strong className={B}>Vị trí:</strong> ứng dụng <strong>không</strong> truy cập vị trí GPS. Khu vực chỉ là thông tin bạn tự nhập.</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>2. Chúng tôi dùng thông tin để làm gì</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Tạo và xác thực tài khoản, hiển thị hồ sơ công khai của bạn cho người dùng khác.</li>
          <li>Kết nối chủ tiệm với thợ nail phù hợp: hiển thị tin tuyển dụng, portfolio, báo việc khớp tiêu chí.</li>
          <li>Vận hành nhắn tin và gọi thoại/video thời gian thực.</li>
          <li>Gửi thông báo về hoạt động tài khoản (tin nhắn mới, việc mới khớp tiêu chí, có tiệm xem hồ sơ).</li>
          <li>Đảm bảo an toàn: xử lý báo cáo vi phạm, chặn tài khoản lạm dụng, xác minh số điện thoại.</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>3. Chia sẻ với bên thứ ba</h2>
        <p>Chúng tôi không bán dữ liệu cá nhân của bạn. Một số nhà cung cấp xử lý dữ liệu thay chúng tôi để vận hành nền tảng:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className={B}>Cloudinary</strong> — lưu ảnh/video bạn tải lên.</li>
          <li><strong className={B}>Pusher</strong> — truyền tin nhắn/tín hiệu cuộc gọi thời gian thực.</li>
          <li><strong className={B}>ZegoCloud</strong> — phòng gọi video.</li>
          <li><strong className={B}>Twilio</strong> — gửi mã SMS khi bạn xác minh số điện thoại.</li>
          <li><strong className={B}>Google Firebase, Apple Push Notification service</strong> — gửi thông báo tới app trên điện thoại.</li>
          <li><strong className={B}>Google, Apple</strong> — chỉ khi bạn chọn đăng nhập bằng tài khoản đó.</li>
          <li><strong className={B}>Giphy</strong> — thư viện GIF trong khung chat (chỉ khi bạn tìm/chọn GIF).</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>4. Quyền của bạn</h2>
        <p>Bạn có thể xem và chỉnh sửa hồ sơ bất cứ lúc nào trong mục &quot;Tài khoản&quot;, tắt thông báo, xoá tiêu chí báo việc. Bạn có thể <strong className={B}>xóa vĩnh viễn tài khoản</strong> và toàn bộ dữ liệu liên quan ngay trong ứng dụng, tại Tài khoản → Xóa tài khoản. Việc xóa không thể hoàn tác.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>5. Bảo mật</h2>
        <p>Mật khẩu được mã hóa bằng bcrypt. Phiên đăng nhập dùng JWT có thời hạn. Mọi kết nối giữa ứng dụng và máy chủ được mã hóa qua HTTPS.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>6. Trẻ em</h2>
        <p>PawNail Jobs dành cho người từ 18 tuổi trở lên. Chúng tôi không cố ý thu thập thông tin từ trẻ em dưới 18 tuổi.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>7. Liên hệ</h2>
        <p>Mọi câu hỏi về chính sách bảo mật, vui lòng liên hệ: {MAIL}.</p>
        <p className="text-xs text-slate-500">[Điền tên pháp nhân/chủ sở hữu vận hành nền tảng] · [Điền địa chỉ liên hệ nếu cần cho hồ sơ store]</p>
      </section>
      <p className="text-xs text-slate-500 pt-4 border-t border-slate-850">Xem thêm <Link href="/terms" className="text-pink-400 hover:underline">Điều khoản dịch vụ</Link>.</p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500">Last updated: October 5, 2026</p>
      </div>
      <p>PawNail Jobs (&quot;we&quot;) runs a platform connecting nail salon owners and nail technicians in the US &amp; Australia, available at <strong className="text-white">bitpawos.com</strong> and in the PawNail Jobs mobile app on the App Store / Google Play. This policy explains what personal information we collect, how we use it and how we protect it.</p>
      <section className={S}>
        <h2 className={H2}>1. Information we collect</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className={B}>Account information:</strong> name, email, phone number, password (hashed with bcrypt, never stored in plain text), role (salon owner / nail tech) and area (market, state, city). If you sign in with Google or Apple, we receive only your name and verified email from that account.</li>
          <li><strong className={B}>Phone verification:</strong> when you choose to verify, your phone number is sent to Twilio to deliver an SMS code. We store only that the number was verified, never the code.</li>
          <li><strong className={B}>Salon owner profile:</strong> optional operations survey answers and job posts (title, salon name, pay, skills, benefits, salon photos/videos, contact phone).</li>
          <li><strong className={B}>Nail tech profile:</strong> bio, years of experience, specialties, portfolio photos/videos, desired pay and benefits, and any job-alert criteria you save.</li>
          <li><strong className={B}>Profile views:</strong> when you view someone&apos;s profile we record the view (at most once a day). Techs can see which salons viewed their profile; techs viewing other techs are counted but not named.</li>
          <li><strong className={B}>Messages:</strong> text, photos and GIFs/stickers you send to other users.</li>
          <li><strong className={B}>Call data:</strong> connection signals (not the audio or video itself) pass through Pusher and ZegoCloud to set up calls.</li>
          <li><strong className={B}>Push notifications:</strong> if you turn on notifications, we store a device token (issued by your browser, Google Firebase or Apple) to deliver them.</li>
          <li><strong className={B}>Location:</strong> the app does <strong>not</strong> access GPS. Your area is only what you enter yourself.</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>2. How we use it</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Create and authenticate your account and show your public profile to other users.</li>
          <li>Connect salons with suitable techs: job posts, portfolios and matching job alerts.</li>
          <li>Run real-time messaging and voice/video calls.</li>
          <li>Send notifications about your account (new messages, matching jobs, salons viewing your profile).</li>
          <li>Keep the platform safe: handle reports, block abusive accounts, verify phone numbers.</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>3. Sharing with third parties</h2>
        <p>We do not sell your personal data. These providers process data on our behalf to run the platform:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className={B}>Cloudinary</strong> — stores photos and videos you upload.</li>
          <li><strong className={B}>Pusher</strong> — real-time messaging and call signaling.</li>
          <li><strong className={B}>ZegoCloud</strong> — video call rooms.</li>
          <li><strong className={B}>Twilio</strong> — sends SMS codes when you verify your phone.</li>
          <li><strong className={B}>Google Firebase, Apple Push Notification service</strong> — deliver notifications to the mobile app.</li>
          <li><strong className={B}>Google, Apple</strong> — only if you choose to sign in with them.</li>
          <li><strong className={B}>Giphy</strong> — GIF library in chat (only when you search for or pick a GIF).</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>4. Your rights</h2>
        <p>You can view and edit your profile at any time under &quot;Account&quot;, turn off notifications and delete job alerts. You can <strong className={B}>permanently delete your account</strong> and all related data in the app under Account → Delete account. Deletion cannot be undone.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>5. Security</h2>
        <p>Passwords are hashed with bcrypt. Sessions use expiring JWTs. All traffic between the app and our servers is encrypted with HTTPS.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>6. Children</h2>
        <p>PawNail Jobs is for people 18 and older. We do not knowingly collect information from children under 18.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>7. Contact</h2>
        <p>Questions about this policy: {MAIL}.</p>
        <p className="text-xs text-slate-500">[Legal entity / platform operator name] · [Contact address if required for store listings]</p>
      </section>
      <p className="text-xs text-slate-500 pt-4 border-t border-slate-850">See also our <Link href="/terms" className="text-pink-400 hover:underline">Terms of Service</Link>.</p>
    </>
  );
}

export default function PrivacyContent() {
  const { locale } = useTr();
  return locale === "en" ? <PrivacyEn /> : <PrivacyVi />;
}
