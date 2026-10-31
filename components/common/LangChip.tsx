// Nhãn nhỏ cho nội dung người dùng viết bằng tiếng Việt, chỉ hiện khi đang xem bằng tiếng Anh.
import { Languages } from "lucide-react";
import { showVietnameseChip } from "@/lib/i18n/contentLang";

export default function VietnameseChip({ text, className = "" }: { text: (string | null | undefined)[]; className?: string }) {
  if (!showVietnameseChip(...text)) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-white/10 ${className}`}>
      <Languages className="h-3 w-3" aria-hidden />
      Written in Vietnamese
    </span>
  );
}
