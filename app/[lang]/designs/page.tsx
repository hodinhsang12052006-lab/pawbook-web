import { preload } from "react-dom";
import DesignsView from "@/components/designs/DesignsView";
import { loadDesignsFirstPaint } from "@/lib/designsFirstPaint";
import { cdnImage } from "@/lib/cdnImage";

// /designs — static HTML per language with the first grid row + the "real work" blocks rendered on the server
// (lib/designsFirstPaint.ts), regenerated in the background every 5 minutes (ISR; the catalog changes ~18 times a day
// and its seasonal window by date). The viewer's market list, saved flags and later pages load in the browser
// (components/designs/DesignsView.tsx).
export const revalidate = 300;

export default async function DesignsPage() {
  const initial = await loadDesignsFirstPaint();
  // The phone's first row (2 cards) is the LCP: fetch those pictures at high priority from the <head>, in parallel with
  // the CSS (the layout already preconnects to Cloudinary). Same URL as DesignVisual (cdnImage(…, 480)).
  for (const d of initial?.designs.slice(0, 2) ?? []) if (d.imageUrl) preload(cdnImage(d.imageUrl, 480), { as: "image", fetchPriority: "high" });
  return <DesignsView initial={initial} />;
}
