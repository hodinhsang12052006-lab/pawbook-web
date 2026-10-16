import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soi tay tư vấn — PawNail Jobs",
  description: "Chụp tay khách → tình trạng móng & da, quy trình nên làm và những mẫu nail hợp nhất. Công cụ cho thợ nail và chủ tiệm.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
