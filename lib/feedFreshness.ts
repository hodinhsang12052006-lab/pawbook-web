// Freshness rules for OFFICIAL posts on the feed (GET /api/posts) — testable with a forced `now`
// (scripts/qa/catalog_read_test.mjs).
//   • never again an official post mentioning Halloween / 🎃 (Halloween retired, lib/season.ts);
//   • general feed: the official "✨ 4 mẫu nail" gallery posts live 72 h;
//   • "<emoji> Bộ sưu tập <theme> đã lên PawNail" posts disappear once that theme is no longer running or upcoming
//     (≤ 21 days) for the post's market (or the viewer's, or the US);
//   • gallery posts whose pictures are no longer published designs disappear (one batched query per page).
import type { Market, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { GALLERY_PREFIX } from "@/lib/designGallery";
import { THEMES } from "@/lib/studioThemes";
import { activeOccasions } from "@/lib/season";

export const GALLERY_TTL_MS = 72 * 3_600_000;
const COLLECTION_RE = /^\S+ Bộ sưu tập (.+?) đã lên PawNail/;

/** Prisma `NOT` list for the posts query. `general` = the shared feed (not one person's profile). */
export function officialPostNot(now: Date, general: boolean): Prisma.PostWhereInput[] {
  return [
    { author: { role: "ADMIN" }, content: { contains: "Halloween" } },
    { author: { role: "ADMIN" }, content: { contains: "🎃" } },
    ...(general ? [{ author: { role: "ADMIN" as const }, content: { startsWith: GALLERY_PREFIX }, createdAt: { lt: new Date(now.getTime() - GALLERY_TTL_MS) } }] : []),
  ];
}

const parseUrls = (raw: string | null) => {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) ? a.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
};

/** Post-filter on one page: drop out-of-window theme-collection posts and gallery posts with no published picture. */
export async function dropStaleOfficial<P extends { author: { role: string }; content: string; mediaUrls: string | null; market: Market | null }>(
  posts: P[],
  viewerMarket: "US" | "AU" | null,
  now: Date = new Date(),
): Promise<P[]> {
  const windows = new Map<string, Set<string>>();
  const live = (m: "US" | "AU") => {
    if (!windows.has(m)) {
      const o = activeOccasions(m, now, { upcomingDays: 21 });
      windows.set(m, new Set([...o.active, ...o.upcoming.map((u) => u.id)]));
    }
    return windows.get(m)!;
  };
  const gallery = posts.filter((p) => p.author.role === "ADMIN" && p.content.startsWith(GALLERY_PREFIX));
  const urls = [...new Set(gallery.flatMap((p) => parseUrls(p.mediaUrls)))];
  const published = urls.length
    ? new Set((await prisma.nailDesign.findMany({ where: { status: "published", imageUrl: { in: urls } }, select: { imageUrl: true } })).map((d) => d.imageUrl))
    : new Set<string | null>();
  return posts.filter((p) => {
    if (p.author.role !== "ADMIN") return true;
    const m = COLLECTION_RE.exec(p.content.split("\n", 1)[0]);
    if (m) {
      const theme = THEMES.find((t) => t.title === m[1].trim());
      if (theme && !live((p.market as "US" | "AU" | null) ?? viewerMarket ?? "US").has(theme.id)) return false;
    }
    if (p.content.startsWith(GALLERY_PREFIX)) {
      const own = parseUrls(p.mediaUrls);
      if (own.length && !own.some((u) => published.has(u))) return false;
    }
    return true;
  });
}
