// Server-rendered first paint of /designs (app/[lang]/designs/page.tsx, ISR): the first grid row + the "real work"
// blocks, so a phone paints the cards from the static HTML instead of after hydration + 3 API calls (LCP ~8 s on a
// throttled phone, a Cloudinary card picture).
//
// The viewer's market (US / AU: seasonal + occasion rules, lib/designCatalog.ts) is only known in the browser, so the
// pinned cards are MARKET-NEUTRAL: the newest designs that both the US and the AU catalog show right now. The page keeps
// them first when its own market list arrives (lib/designsOrder.ts withPinned) — no reflow of what is already painted.
// Occasion chips are sent per market and the page hides the other market's chips before paint (html[data-mkt],
// SEASON_BOOT) until its list arrives.
import { queryCatalog } from "@/lib/designCatalog";
import { communityShowcase, menuShowcase } from "@/lib/designsShowcase";
import { pickFirstPaint } from "@/lib/designsOrder";
import type { Design } from "@/components/designs/DesignViews";
import type { CommunityFirstPage } from "@/components/designs/CommunityDesigns";
import type { MenuShowcaseItem } from "@/components/designs/MenuShowcase";

export interface DesignsFirstPaint {
  designs: Design[];
  occasions: { US: string[]; AU: string[] };
  community: CommunityFirstPage;
  menu: MenuShowcaseItem[];
}

// Same page sizes as the client (components/designs/DesignsView.tsx PAGE, CommunityDesigns, MenuShowcase).
const PAGE = 48;

/**
 * A production build reads lib/prisma's local SQLite file (the repo's dev.db), not the runtime database (Turso): never
 * bake that into the page — return null (the page loads everything client-side, as before) and let the first ISR
 * regeneration at runtime fill it in. A local QA build (no Turso, no Vercel) builds from the same file DB it serves.
 */
const buildWithoutRuntimeDb = () =>
  process.env.NEXT_PHASE === "phase-production-build" && !!(process.env.TURSO_DATABASE_URL || process.env.VERCEL || process.env.CI);

export async function loadDesignsFirstPaint(): Promise<DesignsFirstPaint | null> {
  if (buildWithoutRuntimeDb()) return null;
  try {
    const [us, au, community, menu] = await Promise.all([
      queryCatalog({ market: "US", limit: PAGE, offset: 0 }),
      queryCatalog({ market: "AU", limit: PAGE, offset: 0 }),
      communityShowcase(12, 0).catch(() => ({ items: [], hasMore: false })),
      menuShowcase(12).catch(() => []),
    ]);
    const { designs, occasions } = pickFirstPaint(us.designs, au.designs);
    return {
      designs: designs as unknown as Design[],
      occasions,
      community: community as CommunityFirstPage,
      menu: menu as unknown as MenuShowcaseItem[],
    };
  } catch (err) {
    console.error("designs first paint:", err);
    return null;
  }
}
