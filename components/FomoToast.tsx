"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TOTAL_DEMAND_COUNT, DEMAND_SIGNAL } from "@/lib/nailRadarData";

interface FomoMessage {
  icon: string;
  text: string;
}

// Nội dung minh hoạ hoạt động cộng đồng — dữ liệu MÔ PHỎNG (không phải sự
// kiện thật theo thời gian thực). Trước khi đưa lên production thật, nên
// thay bằng feed lấy từ hoạt động thật gần đây (Job/TechnicianProfile mới
// nhất trong DB) để tránh hiển thị "bằng chứng xã hội" không có thật —
// FTC (Mỹ) và các quy định bảo vệ người tiêu dùng tương tự ở Úc đều coi
// social proof giả là hành vi quảng cáo gây hiểu lầm nếu dùng lâu dài.
const FOMO_MESSAGES: FomoMessage[] = [
  { icon: "💅", text: "Chị Linda (Thợ Dip/Gel-X) tại Melbourne vừa kết nối với 1 tiệm bao lương $1,500 AUD (3 phút trước)" },
  { icon: "🏪", text: "Tiệm Nail tại Houston, TX vừa nhận được 3 hồ sơ thợ bột rảnh tay (vừa xong)" },
  { icon: "✨", text: "Anh Minh (Thợ Bột Ombre) vừa cập nhật portfolio tại Garden Grove, CA" },
  { icon: "📩", text: "Một chủ tiệm tại Sydney vừa gửi lời mời phỏng vấn cho thợ bột (1 phút trước)" },
  { icon: "💬", text: "Chị Kim (Thợ Chân Tay Nước) tại San Jose, CA vừa nhắn tin với 1 tiệm đang tuyển gấp (vừa xong)" },
  { icon: "🔥", text: "Tiệm Happy Nails tại Brisbane, QLD vừa đăng tin tuyển thợ bao lương $1,300 AUD/tuần" },
  { icon: "📸", text: "Anh Tony (Thợ Gel-X/Biab) vừa tải thêm ảnh mẫu móng mới tại Dallas, TX" },
  { icon: "🎉", text: "1 thợ nail tại Perth, WA vừa được nhận việc qua PawNail Jobs (2 phút trước)" },
];

// Nhóm câu FOMO RIÊNG nhắm vào THỢ đang tìm việc — dựa trên số liệu tổng
// hợp/ẩn danh THẬT từ đợt quét cộng đồng ngành nail (xem
// lib/nailRadarData.ts, DEMAND_SIGNAL/TOTAL_DEMAND_COUNT). Data quét được
// cho thấy lệch hẳn về phía "chủ tìm thợ" (chủ tiệm đăng tin tuyển) so với
// "thợ tìm việc" — tức thợ đang là bên khan hiếm, nên đây chính là bằng
// chứng thật (không phải số bịa) để nhấn mạnh với thợ mới vào: "rất nhiều
// tiệm đang cần bạn". Không giống các câu mô phỏng ở trên, nhóm này gắn với
// con số có thật tại thời điểm quét — nếu quét lại, cập nhật số ở đây theo.
const REAL_DEMAND_MESSAGES: FomoMessage[] = [
  { icon: "📢", text: `${TOTAL_DEMAND_COUNT.US + TOTAL_DEMAND_COUNT.AU}+ tin tuyển thợ nail ghi nhận tại Mỹ & Úc — ngành đang khát nhân lực chưa từng thấy` },
  { icon: "🔥", text: `${DEMAND_SIGNAL.US?.TX?.demandCount ?? 0} tiệm tại Texas đang tranh nhau tìm thợ Bột/Acrylic ngay lúc này` },
  { icon: "🔥", text: `${DEMAND_SIGNAL.US?.CA?.demandCount ?? 0} tiệm tại California đăng tin cần tuyển thợ nail gấp` },
  { icon: "🔥", text: `${DEMAND_SIGNAL.AU?.NSW?.demandCount ?? 0} tiệm tại NSW đang cần tuyển thợ ngay bây giờ` },
  { icon: "🔥", text: `${DEMAND_SIGNAL.AU?.VIC?.demandCount ?? 0} tiệm tại Victoria đang thiếu thợ, sẵn sàng bao lương cao` },
];

// Data quét thật cho thấy thợ đang là bên khan hiếm (rất nhiều tiệm đăng
// tin tuyển, rất ít thợ đăng tin tìm việc) — nên trọng số ưu tiên nhóm câu
// dựa trên số liệu thật này (REAL_DEMAND_MESSAGES) làm nội dung CHỦ YẾU,
// nhóm câu mô phỏng ở trên chỉ xen kẽ cho đỡ lặp.
const ALL_MESSAGES: FomoMessage[] = [
  ...REAL_DEMAND_MESSAGES,
  ...REAL_DEMAND_MESSAGES,
  ...FOMO_MESSAGES,
];

const MIN_DELAY_MS = 15_000;
const MAX_DELAY_MS = 25_000;
const VISIBLE_MS = 4_000;

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export default function FomoToast() {
  const pathname = usePathname();
  const [current, setCurrent] = useState<FomoMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const lastIndexRef = useRef<number>(-1);
  const timersRef = useRef<{ show?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout> }>({});

  // Toast quảng cáo "bằng chứng xã hội" này chỉ hợp lý khi khách đang lướt
  // job board — trên các trang /auth/* nó chỉ đè lên form/chữ thương hiệu
  // (đây chính là lỗi khách báo: toast che mất chữ "Việc Làm Nail" ở góc
  // trái trang đăng ký vì toast dùng position: fixed toàn viewport).
  const isAuthRoute = pathname?.startsWith("/auth") ?? false;

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      timersRef.current.show = setTimeout(() => {
        if (cancelled) return;

        let idx = Math.floor(Math.random() * ALL_MESSAGES.length);
        if (ALL_MESSAGES.length > 1 && idx === lastIndexRef.current) {
          idx = (idx + 1) % ALL_MESSAGES.length;
        }
        lastIndexRef.current = idx;

        setCurrent(ALL_MESSAGES[idx]);
        setVisible(true);

        timersRef.current.hide = setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          scheduleNext();
        }, VISIBLE_MS);
      }, randomDelay());
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timersRef.current.show) clearTimeout(timersRef.current.show);
      if (timersRef.current.hide) clearTimeout(timersRef.current.hide);
    };
  }, []);

  if (!current || isAuthRoute) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-20 left-3 right-3 sm:left-4 sm:right-auto z-40 sm:max-w-xs pointer-events-none transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      <div className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-md px-3.5 py-3 shadow-2xl shadow-black/40">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-sm">
          {current.icon}
        </div>
        <p className="text-xs leading-relaxed text-slate-200">{current.text}</p>
      </div>
    </div>
  );
}
