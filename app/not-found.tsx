import Link from "next/link";
import { SearchX, Home } from "lucide-react";

// Thay trang 404 trắng mặc định của Next.js — trong app native (WebView nền
// tối), 1 link hỏng/tin đã bị xóa từng hiện ra trang trắng trơn không có
// đường quay lại, trông như app bị lỗi.
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[100px]" />
      <div className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10">
          <SearchX className="h-6 w-6 text-pink-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-white">Không tìm thấy trang</h1>
          <p className="text-sm text-slate-400">
            Trang này không tồn tại hoặc tin đã bị gỡ. Page not found.
          </p>
        </div>

        <Link
          href="/"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 px-6 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
        >
          <Home className="h-4 w-4" /> Về trang chủ
        </Link>
      </div>
    </div>
  );
}
