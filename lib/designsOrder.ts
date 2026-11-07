// /designs grid order, shared by the server-rendered first paint (lib/designsFirstPaint.ts) and the page
// (components/designs/DesignsView.tsx) so the client never reorders what the static HTML already painted.
import { THEMES } from "@/lib/studioThemes";

/** Cards in the static HTML: one desktop row (4 columns), two phone rows (2 columns). */
export const FIRST_PAINT_CARDS = 4;

/** `pinned` (the first-paint cards, in their order) that are still in `list` go first, then the rest of `list` —
 *  the server-rendered row keeps its place when the viewer's market list arrives; a pinned card that left the list
 *  (unpublished since the page was built) is dropped. */
export function withPinned<T extends { id: string }>(pinned: readonly T[], list: readonly T[]): T[] {
  if (!pinned.length) return list.slice();
  const byId = new Map(list.map((d) => [d.id, d]));
  const head = pinned.flatMap((p) => byId.get(p.id) ?? []);
  const ids = new Set(head.map((d) => d.id));
  return [...head, ...list.filter((d) => !ids.has(d.id))];
}

const THEME_ORDER = new Map(THEMES.map((t, i) => [t.id, i]));
/** Occasion filter chips in one fixed (calendar) order — not "first seen in the list" — so the chips painted from the
 *  server's per-market sets and the ones computed from the loaded list are the same row, in the same places. */
export function occasionChips(occasions: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const o of occasions) if (o) set.add(o);
  return [...set].sort((a, b) => (THEME_ORDER.get(a) ?? 999) - (THEME_ORDER.get(b) ?? 999) || a.localeCompare(b));
}

type Card = { id: string; occasion: string | null; imageUrl: string | null };
/** First paint of /designs from the server's US + AU catalog pages: the newest cards BOTH markets show (market-neutral,
 *  kept first by withPinned whichever market the viewer turns out to be), only with an https picture (a data: URL —
 *  local demo data — would be inlined into the HTML and its RSC payload), plus each market's occasion chips. */
export function pickFirstPaint<T extends Card>(us: readonly T[], au: readonly T[]): { designs: T[]; occasions: { US: string[]; AU: string[] } } {
  const inAu = new Set(au.map((d) => d.id));
  return {
    designs: us.filter((d) => inAu.has(d.id) && /^https:\/\//.test(d.imageUrl ?? "")).slice(0, FIRST_PAINT_CARDS),
    occasions: { US: occasionChips(us.map((d) => d.occasion)), AU: occasionChips(au.map((d) => d.occasion)) },
  };
}
