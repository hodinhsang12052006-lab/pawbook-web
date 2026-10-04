import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { stateName } from "@/lib/stateNames";

// Tiêu đề tab + bản xem trước khi chia sẻ tin tuyển (nút Chia sẻ trên trang
// tin): "Cần thợ Gel-X · Sunny Nails — $1,300/tuần · Houston, Texas".
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: { title: true, salonName: true, salaryAmount: true, city: true, state: true, market: true } });
    if (!j) return { title: "Tin tuyển dụng — PawNail Jobs" };
    const title = `${j.title} · ${j.salonName} — PawNail Jobs`;
    const description = `${j.salaryAmount} · ${j.city}, ${stateName(j.market, j.state)}. Gọi hoặc nhắn tin trực tiếp cho tiệm trên PawNail Jobs.`;
    return { title, description, openGraph: { title, description } };
  } catch {
    return { title: "Tin tuyển dụng — PawNail Jobs" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
