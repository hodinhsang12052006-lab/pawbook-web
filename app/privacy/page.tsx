import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách bảo mật — PawNail Jobs",
  description: "Chính sách bảo mật của PawNail Jobs — nền tảng kết nối chủ tiệm và thợ nail tại Mỹ & Úc.",
};

// Nội dung này là bản nháp dựa đúng trên dữ liệu app thực sự thu thập (đối
// chiếu trực tiếp với prisma/schema.prisma + các API route) — vẫn cần chủ sở
// hữu doanh nghiệp điền các mục [để trống] (tên pháp nhân, địa chỉ, email hỗ
// trợ thật) và rà lại trước khi dùng làm căn cứ nộp App Store/CH Play chính
// thức.
export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 pb-24 md:pb-10 space-y-8 text-sm leading-relaxed text-slate-300">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">Chính sách bảo mật</h1>
          <p className="text-xs text-slate-500">Cập nhật lần cuối: 20/09/2026</p>
        </div>

        <p>
          PawNail Jobs ("chúng tôi") vận hành nền tảng kết nối chủ tiệm nail và thợ nail tại Mỹ &amp; Úc,
          truy cập qua website <strong className="text-white">bitpawos.com</strong> và ứng dụng di động
          PawNail Jobs trên App Store / CH Play. Chính sách này giải thích chúng tôi thu thập, sử dụng và
          bảo vệ thông tin cá nhân của bạn như thế nào.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Thông tin chúng tôi thu thập</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-slate-100">Thông tin tài khoản:</strong> họ tên, email, số điện thoại, mật khẩu (được mã hóa bcrypt, chúng tôi không bao giờ lưu mật khẩu dạng thô), vai trò (Chủ tiệm / Thợ Nail), khu vực (thị trường, bang, thành phố).</li>
            <li><strong className="text-slate-100">Hồ sơ Chủ tiệm:</strong> câu trả lời khảo sát vận hành tiệm (dùng để cá nhân hoá gợi ý giải pháp), tin tuyển dụng đã đăng (tiêu đề, tên tiệm, mức lương, kỹ năng, quyền lợi, số điện thoại liên hệ).</li>
            <li><strong className="text-slate-100">Hồ sơ Thợ Nail:</strong> giới thiệu bản thân, số năm kinh nghiệm, chuyên môn, ảnh/video portfolio, mức lương và quyền lợi mong muốn.</li>
            <li><strong className="text-slate-100">Nội dung nhắn tin:</strong> tin nhắn văn bản, ảnh, GIF/sticker bạn gửi trong cuộc trò chuyện với người dùng khác trên nền tảng.</li>
            <li><strong className="text-slate-100">Dữ liệu cuộc gọi:</strong> khi bạn gọi thoại/video qua app, dữ liệu tín hiệu kết nối (không phải nội dung âm thanh/hình ảnh cuộc gọi) được truyền qua hạ tầng của Pusher và ZegoCloud để thiết lập kết nối trực tiếp giữa hai máy.</li>
            <li><strong className="text-slate-100">Vị trí (GPS):</strong> nếu bạn cấp quyền vị trí trên ứng dụng di động, chúng tôi có thể dùng để gợi ý tiệm/thợ gần bạn hoặc hỗ trợ tính năng chấm công theo vị trí trong tương lai. Bạn có thể từ chối/thu hồi quyền này bất cứ lúc nào trong cài đặt thiết bị.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Chúng tôi dùng thông tin để làm gì</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Tạo và xác thực tài khoản, hiển thị hồ sơ công khai của bạn cho người dùng khác trên nền tảng.</li>
            <li>Kết nối chủ tiệm với thợ nail phù hợp (hiển thị tin tuyển dụng, portfolio, gợi ý giải pháp vận hành).</li>
            <li>Vận hành tính năng nhắn tin và gọi thoại/video thời gian thực giữa các thành viên.</li>
            <li>Gửi thông báo liên quan tới hoạt động tài khoản của bạn (tin nhắn mới, cập nhật hồ sơ).</li>
            <li>Đảm bảo an toàn nền tảng: xử lý báo cáo vi phạm, chặn tài khoản lạm dụng.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Chia sẻ với bên thứ ba</h2>
          <p>Chúng tôi không bán dữ liệu cá nhân của bạn. Một số nhà cung cấp dịch vụ xử lý dữ liệu thay chúng tôi để vận hành nền tảng:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-slate-100">Cloudinary</strong> — lưu trữ ảnh/video bạn tải lên (portfolio, ảnh đính kèm tin nhắn).</li>
            <li><strong className="text-slate-100">Pusher</strong> — hạ tầng truyền tin nhắn/tín hiệu cuộc gọi thời gian thực.</li>
            <li><strong className="text-slate-100">ZegoCloud</strong> — hạ tầng phòng gọi video.</li>
            <li><strong className="text-slate-100">Giphy</strong> — cung cấp thư viện GIF trong khung chat (chỉ khi bạn chủ động tìm/chọn GIF).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Quyền của bạn</h2>
          <p>
            Bạn có thể xem và chỉnh sửa thông tin hồ sơ bất cứ lúc nào trong mục "Tài khoản". Bạn có thể{" "}
            <strong className="text-slate-100">xóa vĩnh viễn tài khoản</strong> và toàn bộ dữ liệu liên quan
            (hồ sơ, tin tuyển dụng, tin nhắn) ngay trong ứng dụng, tại trang Tài khoản → Xóa tài khoản.
            Việc xóa không thể hoàn tác.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Bảo mật</h2>
          <p>
            Mật khẩu được mã hóa bằng bcrypt trước khi lưu trữ. Phiên đăng nhập dùng JWT có thời hạn.
            Toàn bộ kết nối giữa ứng dụng và máy chủ được mã hóa qua HTTPS.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Trẻ em</h2>
          <p>
            PawNail Jobs là nền tảng việc làm dành cho người từ 18 tuổi trở lên. Chúng tôi không cố ý thu
            thập thông tin từ trẻ em dưới 18 tuổi.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">7. Liên hệ</h2>
          <p>
            Mọi câu hỏi về chính sách bảo mật, vui lòng liên hệ:{" "}
            <a href="mailto:support@bitpawos.com" className="text-pink-400 hover:underline">support@bitpawos.com</a>.
          </p>
          <p className="text-xs text-slate-500">
            [Điền tên pháp nhân/chủ sở hữu vận hành nền tảng] · [Điền địa chỉ liên hệ nếu cần cho hồ sơ store]
          </p>
        </section>

        <p className="text-xs text-slate-500 pt-4 border-t border-slate-850">
          Xem thêm <Link href="/terms" className="text-pink-400 hover:underline">Điều khoản dịch vụ</Link>.
        </p>
      </main>
    </div>
  );
}
