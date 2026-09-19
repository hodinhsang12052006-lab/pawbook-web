// Vị trí cố định (không random) cho hiệu ứng sparkle/glitter dùng ở nền
// "aurora" (trang auth + hero trang chủ) — nếu random mỗi lần render, HTML
// server và client sẽ lệch nhau và React báo lỗi hydration mismatch.
export const SPARKLE_DOTS = [
  { top: "12%", left: "18%", delay: "0s" },
  { top: "22%", left: "68%", delay: "-0.8s" },
  { top: "8%", left: "42%", delay: "-1.6s" },
  { top: "35%", left: "85%", delay: "-2.2s" },
  { top: "48%", left: "10%", delay: "-0.4s" },
  { top: "58%", left: "55%", delay: "-1.2s" },
  { top: "64%", left: "30%", delay: "-2.6s" },
  { top: "72%", left: "78%", delay: "-1.8s" },
  { top: "82%", left: "22%", delay: "-0.6s" },
  { top: "88%", left: "60%", delay: "-2.0s" },
  { top: "28%", left: "5%", delay: "-1.4s" },
  { top: "16%", left: "92%", delay: "-2.8s" },
  { top: "44%", left: "35%", delay: "-1.0s" },
  { top: "68%", left: "48%", delay: "-0.2s" },
];
