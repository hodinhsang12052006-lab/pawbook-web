import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Hỗ trợ · Support — PawNail Jobs",
  description: "Liên hệ hỗ trợ PawNail Jobs, câu hỏi thường gặp · Contact PawNail Jobs support and read common questions.",
  alternates: { canonical: "/support" },
};

const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawos.com";

const link = "text-pink-300 underline";

// "Support URL" của App Store Connect / Google Play (Apple 1.5: phải có cách liên hệ thật).
// Song ngữ hiện CÙNG LÚC như /data-deletion: người duyệt store đọc tiếng Anh, không
// phụ thuộc nút đổi ngôn ngữ. Chỉ ghi những gì app thật sự có.
export default function Page() {
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 pb-24 text-sm leading-relaxed text-slate-300 md:pb-10">
        <section className="space-y-3">
          <h1 className="text-2xl font-black text-white">Hỗ trợ PawNail Jobs</h1>
          <p>
            Cần giúp đỡ, muốn báo lỗi hay góp ý? Gửi email tới{" "}
            <a href={`mailto:${SUPPORT}?subject=Ho%20tro%20PawNail`} className={link}>{SUPPORT}</a>. Ghi kèm email hoặc số điện thoại bạn dùng để đăng nhập, mô tả
            sự cố và ảnh chụp màn hình nếu có. Chúng tôi trả lời qua email.
          </p>
          <h2 className="pt-2 font-bold text-white">Câu hỏi thường gặp</h2>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold text-white">Quên mật khẩu?</dt>
              <dd>Vào <Link href="/auth/forgot" className={link}>Quên mật khẩu</Link>, nhập email của tài khoản để nhận hướng dẫn đặt lại.</dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Báo cáo hoặc chặn một người dùng?</dt>
              <dd>Trong cuộc trò chuyện, bấm nút ⋮ ở đầu khung chat rồi chọn Báo cáo người dùng hoặc Chặn người dùng. Với bài đăng, bấm nút ••• trên bài rồi chọn Báo cáo.</dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Xoá tài khoản?</dt>
              <dd>Vào Hồ sơ → Tài khoản → Tôi muốn xóa tài khoản. Xem thêm tại <Link href="/data-deletion" className={link}>Xoá dữ liệu</Link>.</dd>
            </div>
          </dl>
          <p className="text-slate-400">
            Chính sách: <Link href="/privacy" className={link}>Bảo mật</Link> · <Link href="/terms" className={link}>Điều khoản</Link> ·{" "}
            <Link href="/data-deletion" className={link}>Xoá dữ liệu</Link>
          </p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-3" lang="en">
          <h1 className="text-2xl font-black text-white">PawNail Jobs Support</h1>
          <p>
            Need help, found a bug or have feedback? Email{" "}
            <a href={`mailto:${SUPPORT}?subject=PawNail%20support`} className={link}>{SUPPORT}</a>. Include the email or phone number you sign in with, what
            happened, and a screenshot if you have one. We reply by email.
          </p>
          <h2 className="pt-2 font-bold text-white">Common questions</h2>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold text-white">Forgot your password?</dt>
              <dd>Go to <Link href="/auth/forgot" className={link}>Forgot password</Link> and enter your account email to get reset instructions.</dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Report or block a user?</dt>
              <dd>In a conversation, tap the ⋮ button at the top of the chat and choose Report user or Block user. For a post, tap the ••• button on the post and choose Report.</dd>
            </div>
            <div>
              <dt className="font-semibold text-white">Delete your account?</dt>
              <dd>Go to Profile → Account → Delete my account. More details on <Link href="/data-deletion" className={link}>Data deletion</Link>.</dd>
            </div>
          </dl>
          <p className="text-slate-400">
            Policies: <Link href="/privacy" className={link}>Privacy</Link> · <Link href="/terms" className={link}>Terms</Link> ·{" "}
            <Link href="/data-deletion" className={link}>Data deletion</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
