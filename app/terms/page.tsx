import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản dịch vụ — PawNail Jobs",
  description: "Điều khoản dịch vụ của PawNail Jobs — nền tảng kết nối chủ tiệm và thợ nail tại Mỹ & Úc.",
};

// Bản nháp — cần chủ sở hữu doanh nghiệp rà lại (và lý tưởng là có luật sư
// xem qua) trước khi dùng làm căn cứ pháp lý chính thức hoặc nộp store.
export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 pb-24 md:pb-10 space-y-8 text-sm leading-relaxed text-slate-300">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">Điều khoản dịch vụ</h1>
          <p className="text-xs text-slate-500">Cập nhật lần cuối: 20/09/2026</p>
        </div>

        <p>
          Bằng việc tạo tài khoản hoặc sử dụng PawNail Jobs (website bitpawos.com và ứng dụng di động),
          bạn đồng ý với các điều khoản dưới đây.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Nền tảng kết nối, không phải nhà tuyển dụng</h2>
          <p>
            PawNail Jobs là nền tảng trung gian kết nối chủ tiệm nail (đăng tin tuyển dụng) và thợ nail
            (đăng hồ sơ tay nghề). Chúng tôi không phải là nhà tuyển dụng, không tham gia vào quan hệ lao
            động, hợp đồng lương thưởng, hay tranh chấp phát sinh giữa chủ tiệm và thợ. Mọi thỏa thuận về
            công việc, lương, điều kiện làm việc là giữa các bên tự thương lượng trực tiếp.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Điều kiện sử dụng</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Bạn phải từ 18 tuổi trở lên để tạo tài khoản.</li>
            <li>Thông tin bạn cung cấp (hồ sơ, tin tuyển dụng, portfolio) phải chính xác, không mạo danh người khác.</li>
            <li>Không đăng nội dung vi phạm pháp luật, quấy rối, phân biệt đối xử, hoặc lừa đảo.</li>
            <li>Không sử dụng nền tảng để gửi tin nhắn rác, quảng cáo trái phép, hoặc thu thập thông tin người dùng khác trái mục đích.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Nội dung người dùng & kiểm duyệt</h2>
          <p>
            Bạn chịu trách nhiệm về nội dung mình đăng tải (hồ sơ, ảnh portfolio, tin nhắn). Chúng tôi có
            quyền gỡ nội dung vi phạm, tạm khóa hoặc xóa vĩnh viễn tài khoản vi phạm điều khoản này, dựa
            trên báo cáo từ người dùng khác hoặc phát hiện trực tiếp. Bạn có thể{" "}
            <strong className="text-slate-100">chặn</strong> và <strong className="text-slate-100">báo cáo</strong>{" "}
            bất kỳ người dùng nào ngay trong khung chat.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Miễn phí & tính năng "Mở khóa liên hệ"</h2>
          <p>
            Toàn bộ tính năng cốt lõi của PawNail Jobs — đăng tin, đăng portfolio, nhắn tin, gọi thoại/video,
            và tính năng "Mở khóa liên hệ trực tiếp" — hiện được cung cấp{" "}
            <strong className="text-slate-100">hoàn toàn miễn phí</strong>. Chúng tôi có thể điều chỉnh mô
            hình này trong tương lai và sẽ thông báo trước cho người dùng.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Chấm dứt tài khoản</h2>
          <p>
            Bạn có thể xóa tài khoản bất cứ lúc nào tại trang Tài khoản. Chúng tôi có quyền tạm khóa hoặc
            xóa tài khoản vi phạm điều khoản mà không cần báo trước.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Giới hạn trách nhiệm</h2>
          <p>
            PawNail Jobs được cung cấp "nguyên trạng". Chúng tôi không đảm bảo tính chính xác của thông tin
            do người dùng khác đăng tải (tin tuyển dụng, hồ sơ tay nghề) và không chịu trách nhiệm cho các
            thiệt hại phát sinh từ giao dịch/thỏa thuận giữa chủ tiệm và thợ nail.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">7. Liên hệ</h2>
          <p>
            Câu hỏi về điều khoản dịch vụ, vui lòng liên hệ:{" "}
            <a href="mailto:support@bitpawos.com" className="text-pink-400 hover:underline">support@bitpawos.com</a>.
          </p>
        </section>

        <p className="text-xs text-slate-500 pt-4 border-t border-slate-850">
          Xem thêm <Link href="/privacy" className="text-pink-400 hover:underline">Chính sách bảo mật</Link>.
        </p>
      </main>
    </div>
  );
}
