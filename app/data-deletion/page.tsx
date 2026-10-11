import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Xoá dữ liệu · Data Deletion — PawNail Jobs",
  description: "Cách xoá tài khoản và dữ liệu PawNail Jobs (kể cả khi đăng nhập bằng Facebook/Google) · How to delete your PawNail Jobs data.",
  alternates: { canonical: "/data-deletion" },
};

const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawos.com";

// Trang "Data deletion instructions URL" cho Facebook Login (Meta bắt buộc trước khi app được Live).
// Song ngữ hiện CÙNG LÚC (người duyệt của Meta đọc tiếng Anh, không phụ thuộc nút đổi ngôn ngữ).
export default function Page() {
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 pb-24 text-sm leading-relaxed text-slate-300 md:pb-10">
        <section className="space-y-3">
          <h1 className="text-2xl font-black text-white">Xoá dữ liệu của bạn</h1>
          <p>Bạn có thể xoá tài khoản PawNail Jobs và toàn bộ dữ liệu bất cứ lúc nào — kể cả khi bạn đăng nhập bằng Facebook, Google hoặc số điện thoại.</p>
          <h2 className="pt-2 font-bold text-white">Cách 1 — Tự xoá ngay trong ứng dụng (nhanh nhất)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Đăng nhập tại <Link href="/auth/login" className="text-pink-300 underline">bitpawos.com/auth/login</Link> (bằng cách bạn đã dùng: Facebook, Google, SĐT hoặc email).</li>
            <li>Vào <b>Hồ sơ</b> → kéo xuống mục <b>Tài khoản</b> → <b>Tôi muốn xóa tài khoản</b> → xác nhận.</li>
            <li>Hồ sơ, tin tuyển dụng / portfolio, bài đăng, tin nhắn bạn đã gửi và dữ liệu liên quan bị xoá vĩnh viễn ngay lập tức.</li>
          </ol>
          <h2 className="pt-2 font-bold text-white">Cách 2 — Gửi yêu cầu qua email</h2>
          <p>Gửi email tới <a href={`mailto:${SUPPORT}?subject=Xoa%20du%20lieu%20PawNail`} className="text-pink-300 underline">{SUPPORT}</a> với tiêu đề “Xoá dữ liệu”, kèm email / số điện thoại / tên Facebook bạn dùng để đăng nhập. Chúng tôi xoá trong vòng <b>30 ngày</b> và trả lời xác nhận.</p>
          <h2 className="pt-2 font-bold text-white">Gỡ kết nối Facebook</h2>
          <p>Trên Facebook: <b>Cài đặt &amp; quyền riêng tư → Cài đặt → Ứng dụng và trang web</b> → chọn <b>BitPawOS / PawNail Jobs</b> → <b>Gỡ</b>. Việc này ngừng chia sẻ dữ liệu Facebook mới; để xoá dữ liệu đã lưu ở PawNail hãy làm Cách 1 hoặc 2.</p>
          <p className="text-slate-400">PawNail chỉ dùng từ Facebook: tên và địa chỉ email — để tạo/đăng nhập tài khoản (không lưu ảnh đại diện Facebook). Chúng tôi không đăng gì lên Facebook của bạn.</p>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-3" lang="en">
          <h1 className="text-2xl font-black text-white">Delete your data</h1>
          <p>You can delete your PawNail Jobs account and all of its data at any time — including if you signed in with Facebook, Google or your phone number.</p>
          <h2 className="pt-2 font-bold text-white">Option 1 — Delete it yourself in the app (fastest)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Sign in at <Link href="/auth/login" className="text-pink-300 underline">bitpawos.com/auth/login</Link> (with the method you used: Facebook, Google, phone or email).</li>
            <li>Go to <b>Profile</b> → scroll to <b>Account</b> → <b>Delete my account</b> → confirm.</li>
            <li>Your profile, job posts / portfolio, posts, messages you sent and related data are permanently deleted immediately.</li>
          </ol>
          <h2 className="pt-2 font-bold text-white">Option 2 — Request by email</h2>
          <p>Email <a href={`mailto:${SUPPORT}?subject=Data%20deletion%20request`} className="text-pink-300 underline">{SUPPORT}</a> with the subject “Data deletion request” and the email / phone / Facebook name you signed in with. We delete it within <b>30 days</b> and reply to confirm.</p>
          <h2 className="pt-2 font-bold text-white">Remove the Facebook connection</h2>
          <p>On Facebook: <b>Settings &amp; privacy → Settings → Apps and websites</b> → select <b>BitPawOS / PawNail Jobs</b> → <b>Remove</b>. This stops sharing new Facebook data; to delete data already stored by PawNail use Option 1 or 2.</p>
          <p className="text-slate-400">From Facebook, PawNail only uses your name and email address — to create and sign in to your account (your Facebook profile picture is not stored). We never post to your Facebook.</p>
        </section>
      </main>
    </div>
  );
}
