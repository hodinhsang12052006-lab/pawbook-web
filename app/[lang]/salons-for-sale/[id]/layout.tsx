import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { placeLabel } from "@/lib/stateNames";
import { SITE_URL } from "@/lib/siteUrl";
import { localePath } from "@/lib/i18n/config";
import { alternates, langFrom, openGraph, trL } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/salonSale/parse";
import { parseMedia } from "@/lib/salonSale/store";

type Params = Promise<{ lang: string; id: string }>;

// Tiêu đề tab + thẻ chia sẻ: "Sang tiệm nail · Indianapolis, Indiana · $120,000".
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lang = await langFrom(params);
  const path = `/salons-for-sale/${id}`;
  const fallback: Metadata = { title: trL(lang, "Sang tiệm nail", "Nail salon for sale"), robots: { index: false, follow: true }, alternates: alternates(path, lang) };
  try {
    const s = await prisma.salonSale.findUnique({ where: { id } });
    if (!s || s.status === "removed") return { ...fallback, robots: { index: false, follow: false } };
    const market = s.market as "US" | "AU";
    const place = placeLabel(s.city, market, s.state);
    const price = s.askingPrice != null ? formatMoney(s.askingPrice, market) : trL(lang, "giá thương lượng", "price on request");
    const head = s.source === "ingest" ? trL(lang, "Sang tiệm nail", "Nail salon for sale") : s.title;
    const title = `${head} · ${place} · ${price}`;
    const bits = [
      s.chairs != null ? trL(lang, `${s.chairs} ghế spa`, `${s.chairs} pedicure chairs`) : "",
      s.tables != null ? trL(lang, `${s.tables} bàn`, `${s.tables} nail tables`) : "",
      s.monthlyRent != null ? trL(lang, `thuê ${formatMoney(s.monthlyRent, market)}/tháng`, `rent ${formatMoney(s.monthlyRent, market)}/mo`) : "",
      s.monthlyRevenue != null ? trL(lang, `doanh thu ${formatMoney(s.monthlyRevenue, market)}/tháng`, `revenue ${formatMoney(s.monthlyRevenue, market)}/mo`) : "",
    ].filter(Boolean);
    const description = `${bits.length ? bits.join(" · ") + ". " : ""}${trL(lang, "Gọi hoặc nhắn tin trực tiếp cho chủ tiệm trên PawNail.", "Call or message the owner directly on PawNail.")}`;
    const image = parseMedia(s.mediaUrls).find((u) => /^https:/.test(u));
    return {
      title,
      description,
      alternates: alternates(path, lang),
      openGraph: openGraph(lang, { title, description, url: `${SITE_URL}${localePath(path, lang)}`, type: "article", ...(image ? { images: [{ url: image }] } : {}) }),
      // Đã sang: vẫn mở được (người đã lưu link) nhưng không lập chỉ mục
      ...(s.status !== "active" || s.expiresAt.getTime() <= Date.now() ? { robots: { index: false, follow: true } } : {}),
    };
  } catch {
    return fallback;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
