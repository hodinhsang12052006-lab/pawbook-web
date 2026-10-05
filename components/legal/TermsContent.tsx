"use client";

import Link from "next/link";
import { useTr } from "@/lib/i18n/useTr";

// Điều khoản dịch vụ — bản tiếng Việt và tiếng Anh đầy đủ, theo nút VI/EN.
// Bản nháp: chủ doanh nghiệp (lý tưởng là luật sư) rà lại trước khi dùng làm
// căn cứ pháp lý chính thức.
const S = "space-y-2";
const H2 = "text-lg font-bold text-white";
const B = "text-slate-100";
const MAIL = <a href="mailto:support@bitpawos.com" className="text-pink-400 underline underline-offset-2">support@bitpawos.com</a>;

function TermsVi() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-white mb-2">Điều khoản dịch vụ</h1>
        <p className="text-xs text-slate-500">Cập nhật lần cuối: 05/10/2026</p>
      </div>
      <p>Bằng việc tạo tài khoản hoặc sử dụng PawNail Jobs (website bitpawos.com và ứng dụng di động), bạn đồng ý với các điều khoản dưới đây.</p>
      <section className={S}>
        <h2 className={H2}>1. Nền tảng kết nối, không phải nhà tuyển dụng</h2>
        <p>PawNail Jobs là nền tảng trung gian kết nối chủ tiệm nail (đăng tin tuyển dụng) và thợ nail (đăng hồ sơ tay nghề). Chúng tôi không phải là nhà tuyển dụng, không tham gia vào quan hệ lao động, hợp đồng lương thưởng, hay tranh chấp phát sinh giữa chủ tiệm và thợ. Mọi thỏa thuận về công việc, lương, điều kiện làm việc là giữa các bên tự thương lượng trực tiếp.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>2. Điều kiện sử dụng</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Bạn phải từ 18 tuổi trở lên để tạo tài khoản.</li>
          <li>Thông tin bạn cung cấp (hồ sơ, tin tuyển dụng, portfolio, số điện thoại) phải chính xác, không mạo danh người khác.</li>
          <li>Không đăng nội dung vi phạm pháp luật, quấy rối, phân biệt đối xử, hoặc lừa đảo.</li>
          <li>Không sử dụng nền tảng để gửi tin nhắn rác, quảng cáo trái phép, hoặc thu thập thông tin người dùng khác trái mục đích.</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>3. Nội dung người dùng & kiểm duyệt</h2>
        <p>Bạn chịu trách nhiệm về nội dung mình đăng tải (hồ sơ, ảnh portfolio, tin nhắn). Chúng tôi có quyền gỡ nội dung vi phạm, tạm khóa hoặc xóa vĩnh viễn tài khoản vi phạm điều khoản này, dựa trên báo cáo từ người dùng khác hoặc phát hiện trực tiếp. Bạn có thể <strong className={B}>chặn</strong> và <strong className={B}>báo cáo</strong> bất kỳ người dùng nào ngay trong khung chat.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>4. Miễn phí</h2>
        <p>Toàn bộ tính năng của PawNail Jobs — đăng tin, đăng portfolio, nhắn tin, gọi thoại/video, báo việc, xác minh số điện thoại — hiện được cung cấp <strong className={B}>hoàn toàn miễn phí</strong>. Nếu sau này có tính năng trả phí, chúng tôi sẽ thông báo trước và ghi rõ giá thật.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>5. Chấm dứt tài khoản</h2>
        <p>Bạn có thể xóa tài khoản bất cứ lúc nào tại trang Tài khoản. Chúng tôi có quyền tạm khóa hoặc xóa tài khoản vi phạm điều khoản mà không cần báo trước.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>6. Giới hạn trách nhiệm</h2>
        <p>PawNail Jobs được cung cấp &quot;nguyên trạng&quot;. Chúng tôi không đảm bảo tính chính xác của thông tin do người dùng khác đăng tải (tin tuyển dụng, hồ sơ tay nghề) và không chịu trách nhiệm cho các thiệt hại phát sinh từ giao dịch/thỏa thuận giữa chủ tiệm và thợ nail.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>7. Liên hệ</h2>
        <p>Câu hỏi về điều khoản dịch vụ, vui lòng liên hệ: {MAIL}.</p>
      </section>
      <p className="text-xs text-slate-500 pt-4 border-t border-slate-850">Xem thêm <Link href="/privacy" className="text-pink-400 hover:underline">Chính sách bảo mật</Link>.</p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-xs text-slate-500">Last updated: October 5, 2026</p>
      </div>
      <p>By creating an account or using PawNail Jobs (the bitpawos.com website and mobile app), you agree to the terms below.</p>
      <section className={S}>
        <h2 className={H2}>1. A connection platform, not an employer</h2>
        <p>PawNail Jobs connects nail salon owners (who post jobs) with nail technicians (who post skill profiles). We are not an employer and are not a party to any employment relationship, pay agreement or dispute between salons and techs. All terms of work, pay and conditions are negotiated directly between the parties.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>2. Eligibility and acceptable use</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You must be at least 18 years old to create an account.</li>
          <li>Information you provide (profile, job posts, portfolio, phone number) must be accurate, and you may not impersonate anyone.</li>
          <li>Do not post illegal, harassing, discriminatory or fraudulent content.</li>
          <li>Do not use the platform to send spam, run unauthorized advertising, or collect other users&apos; information for unrelated purposes.</li>
        </ul>
      </section>
      <section className={S}>
        <h2 className={H2}>3. User content and moderation</h2>
        <p>You are responsible for what you post (profile, portfolio photos, messages). We may remove violating content and suspend or permanently delete accounts that break these terms, based on user reports or our own review. You can <strong className={B}>block</strong> and <strong className={B}>report</strong> any user directly from the chat.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>4. Free to use</h2>
        <p>All PawNail Jobs features — job posts, portfolios, messaging, voice/video calls, job alerts and phone verification — are currently <strong className={B}>completely free</strong>. If paid features are introduced later, we will announce them in advance with their real prices.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>5. Account termination</h2>
        <p>You can delete your account at any time from the Account page. We may suspend or delete accounts that violate these terms without prior notice.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>6. Limitation of liability</h2>
        <p>PawNail Jobs is provided &quot;as is&quot;. We do not guarantee the accuracy of information posted by other users (job posts, skill profiles) and are not liable for losses arising from arrangements between salons and nail techs.</p>
      </section>
      <section className={S}>
        <h2 className={H2}>7. Contact</h2>
        <p>Questions about these terms: {MAIL}.</p>
      </section>
      <p className="text-xs text-slate-500 pt-4 border-t border-slate-850">See also our <Link href="/privacy" className="text-pink-400 hover:underline">Privacy Policy</Link>.</p>
    </>
  );
}

export default function TermsContent() {
  const { locale } = useTr();
  return locale === "en" ? <TermsEn /> : <TermsVi />;
}
