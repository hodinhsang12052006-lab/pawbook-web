import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/bookings", {
    title: ["Lịch hẹn", "Bookings"],
    noindex: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
