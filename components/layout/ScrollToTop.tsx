"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Nút cuộn lên đầu — xuất hiện sau khi cuộn xuống đủ xa (feed/job board có
// thể rất dài). Nổi phía trên BottomNav trên mobile, góc phải dưới desktop.
export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Lên đầu trang"
      className="fixed right-4 bottom-24 md:bottom-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700/60 bg-slate-900/80 text-slate-200 shadow-xl shadow-black/40 backdrop-blur-md transition-all hover:border-pink-500/50 hover:text-white active:scale-90 animate-fadeIn"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
