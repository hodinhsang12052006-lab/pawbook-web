import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { toPublic } from "@/lib/aiDesigns";
import { SITE_URL } from "@/lib/siteUrl";
import { cdnImage } from "@/lib/cdnImage";
import DesignPageView from "@/components/designs/DesignPageView";
import type { Design } from "@/components/designs/DesignViews";
import { localePath } from "@/lib/i18n/config";
import { alternates, langFrom, openGraph, trL } from "@/lib/i18n/server";

// TRANG RIÊNG TỪNG MẪU NAIL (/designs/[id]): link chia sẻ được (thợ gửi khách "mẫu này nè", khách gửi bạn — dán vào
// chat có ảnh xem trước), Google tìm thấy (mỗi ngày ~18 mẫu mới: tên mẫu, vật tư, các bước, thời gian, giá gợi ý),
// dẫn sang mẫu cùng xu hướng / dịp lễ. Chỉ mẫu ĐÃ ĐĂNG.
export const revalidate = 600;

const SELECT = {
  id: true, day: true, occasion: true, title: true, titleEn: true, description: true, descriptionEn: true, skills: true, difficulty: true, minutes: true,
  priceHint: true, materials: true, steps: true, imageUrl: true, videoUrl: true, palette: true, shape: true, finish: true, pattern: true, provider: true,
  prompt: true, status: true, publishedAt: true, _count: { select: { saves: true } },
} as const;

async function load(id: string) {
  try {
    const r = await prisma.nailDesign.findFirst({ where: { id, status: "published" }, select: SELECT });
    return r ? (toPublic(r) as unknown as Design) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const lang = await langFrom(params);
  const d = await load(id);
  if (!d) return { title: trL(lang, "Mẫu nail", "Nail design") };
  // Mỗi ngôn ngữ 1 tiêu đề (trước đây trộn "EN · VI" trong cùng 1 tiêu đề).
  const name = lang === "vi" ? d.title : d.titleEn || d.title;
  const title = trL(lang, `${name} — Mẫu nail`, `${name} — Nail design idea`);
  const description = (
    lang === "vi"
      ? `${d.description} Vật tư, các bước, ~${d.minutes} phút, giá gợi ý ${d.priceHint}.`
      : `${d.descriptionEn || d.description} Materials, steps, ~${d.minutes} min, suggested price ${d.priceHint}.`
  ).slice(0, 300);
  const path = `/designs/${d.id}`;
  const image = d.imageUrl ? cdnImage(d.imageUrl, 1200) : null;
  return {
    title,
    description,
    alternates: alternates(path, lang),
    openGraph: openGraph(lang, { title, description, url: `${SITE_URL}${localePath(path, lang)}`, type: "article", ...(image ? { images: [{ url: image, width: 1200, height: 1200, alt: name }] } : {}) }),
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function DesignPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const lang = await langFrom(params);
  const d = await load(id);
  if (!d) notFound();
  // mẫu liên quan: cùng dịp lễ / cùng hoạ tiết trước, thiếu thì mẫu mới nhất
  let related: Design[] = [];
  try {
    const same = await prisma.nailDesign.findMany({
      where: { status: "published", imageUrl: { not: null }, id: { not: d.id }, OR: [...(d.occasion ? [{ occasion: d.occasion }] : []), { pattern: d.pattern }] },
      select: SELECT, orderBy: { publishedAt: "desc" }, take: 8,
    });
    const more = same.length < 8 ? await prisma.nailDesign.findMany({
      where: { status: "published", imageUrl: { not: null }, id: { notIn: [d.id, ...same.map((x) => x.id)] } },
      select: SELECT, orderBy: { publishedAt: "desc" }, take: 8 - same.length,
    }) : [];
    related = [...same, ...more].map((r) => toPublic(r) as unknown as Design);
  } catch {}
  // HowTo (schema.org): tên mẫu, ảnh, thời gian, vật tư, các bước — cùng ngôn ngữ với trang.
  const vi = lang === "vi";
  const ld = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    inLanguage: vi ? "vi-VN" : "en-US",
    name: vi ? d.title : d.titleEn || d.title,
    description: vi ? d.description : d.descriptionEn || d.description,
    ...(d.imageUrl ? { image: [cdnImage(d.imageUrl, 1200)] } : {}),
    totalTime: `PT${d.minutes}M`,
    supply: d.materials.map((m) => ({ "@type": "HowToSupply", name: vi ? m.vi || m.en : m.en || m.vi })),
    step: d.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: vi ? s.vi || s.en : s.en || s.vi })),
    url: `${SITE_URL}${localePath(`/designs/${d.id}`, lang)}`,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <DesignPageView d={d} related={related} />
    </>
  );
}
