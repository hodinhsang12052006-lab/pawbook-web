"use client";

import React from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { Sparkles, HelpCircle, Navigation, Info, ShieldCheck, HeartHandshake } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          <Sidebar />

          {/* Central Guide Content */}
          <div className="flex-1 space-y-8 animate-fadeIn">
            {/* Header Banner */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-500/5 blur-2xl"></div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-2xs font-semibold text-blue-400 border border-blue-500/20">
                <Info className="h-3 w-3" />
                Hướng dẫn sử dụng
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-tight">
                Bản Hướng Dẫn "Bình Dân Học Vụ" Cho Người Lao Động
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Chào mừng cô bác, anh chị em tài xế và thợ thuyền đến với PawBook! Dưới đây là những chỉ dẫn siêu ngắn gọn, dễ hiểu để mọi người kiếm tiền hiệu quả nhất.
              </p>
            </div>

            {/* Q&A Cards */}
            <div className="space-y-6">
              {/* Question 1 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Làm sao để đăng tin chạy xe 0% chiết khấu hoặc đăng tiệm sửa chữa?
                  </h3>
                </div>
                <div className="pl-11 text-xs text-slate-400 space-y-2 leading-relaxed">
                  <p>Để đăng tin quảng bá dịch vụ của mình, cô bác anh chị em chỉ cần thực hiện 3 bước cực kỳ đơn giản:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-2 font-medium text-slate-350">
                    <li>
                      <strong className="text-slate-200">Đăng nhập tài khoản:</strong> Đăng ký một tài khoản bằng Họ và Tên cùng số điện thoại của mình.
                    </li>
                    <li>
                      <strong className="text-slate-200">Vào trang cá nhân:</strong> Bấm vào Avatar góc trên cùng bên phải hoặc chọn "Trang cá nhân".
                    </li>
                    <li>
                      <strong className="text-slate-200">Bấm nút đăng việc:</strong> Điền tên công việc (Ví dụ: "Xe dịch vụ 4 chỗ gia đình", "Nhận sửa máy giặt tận nhà"), ghim tọa độ của mình trên bản đồ và bấm nút đăng tin là xong!
                    </li>
                  </ol>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-400 font-semibold text-2xs mt-2">
                    💡 Mẹo nhỏ: Đăng ảnh thật của xe hoặc tiệm của mình lên sẽ thu hút khách gọi điện nhiều hơn gấp đôi đó!
                  </div>
                </div>
              </div>

              {/* Question 2 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Navigation className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Cách tìm thợ sửa chữa, tiệm gội đầu dưỡng sinh hoặc đặt xe gần mình nhất?
                  </h3>
                </div>
                <div className="pl-11 text-xs text-slate-400 space-y-2 leading-relaxed">
                  <p>Mọi người muốn tìm bất kỳ dịch vụ nào quanh khu vực mình đang đứng chỉ cần:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-2 font-medium text-slate-350">
                    <li>
                      Chọn mục <strong className="text-slate-200">🗺️ Bản đồ Radar</strong> trên menu bên trái.
                    </li>
                    <li>
                      Xem các ghim màu trên bản đồ. Ghim xe taxi màu vàng 🚕, ghim thợ sửa chữa 🛠️, ghim tiệm làm đẹp 💅, quán ăn cafe ☕.
                    </li>
                    <li>
                      Bấm vào ghim để xem tên tài xế/tiệm, số điện thoại, đánh giá sao. Thấy ưng ý thì bấm nút <strong className="text-blue-400">Chat ngay</strong> hoặc gọi điện trực tiếp để hẹn việc luôn!
                    </li>
                  </ol>
                </div>
              </div>

              {/* Question 3 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Tại sao nên chọn đăng tin trên PawBook thay vì ứng dụng khác?
                  </h3>
                </div>
                <div className="pl-11 text-xs text-slate-400 space-y-3.5 leading-relaxed">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <HeartHandshake className="h-4 w-4 text-emerald-500" />
                        0% phí chiết khấu
                      </h4>
                      <p className="text-3xs text-slate-500">
                        Cô bác chạy xe dịch vụ hoặc sửa máy lạnh nhận trọn vẹn 100% số tiền khách trả. Chúng tôi không cắt một đồng phần trăm nào.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Không qua trung gian
                      </h4>
                      <p className="text-3xs text-slate-500">
                        Khách và thợ, tài xế tự thương lượng giá cả trực tiếp qua khung Chat hoặc điện thoại. Thuận mua vừa bán, làm chủ thu nhập của chính mình.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
