import "./season-effects.css";

// Season layer: decorative light INSIDE the photo stage only (landing hero stack / auth plate), z-index 0 under the
// cards — never under the H1, lede or CTAs. Server-safe static markup; colours + visibility come from
// html[data-season] (lib/season.ts SEASON_BOOT) via CSS, so it is right before first paint on static pages.
// No snow, no fireworks, no falling petals: bokeh, one flare, hand-placed glints and dust (never a tiled pattern).

// 22 hand-placed motes in a 520×560 field (r .6–1.4, opacity .25–.6)
const DUST: [number, number, number, number][] = [
  [34, 48, 1.2, 0.5], [92, 20, 0.8, 0.35], [148, 66, 1.0, 0.45], [212, 18, 0.7, 0.3], [286, 40, 1.4, 0.55], [352, 14, 0.9, 0.4],
  [430, 52, 1.1, 0.5], [496, 30, 0.6, 0.3], [20, 168, 0.9, 0.4], [506, 150, 1.3, 0.6], [16, 300, 1.1, 0.45], [500, 286, 0.8, 0.35],
  [40, 420, 0.7, 0.3], [488, 410, 1.2, 0.5], [72, 516, 1.0, 0.4], [150, 548, 0.6, 0.25], [236, 530, 1.3, 0.55], [318, 552, 0.8, 0.35],
  [398, 522, 1.1, 0.45], [470, 540, 0.7, 0.3], [262, 4, 0.9, 0.4], [120, 120, 0.6, 0.25],
];

export default function SeasonLayer({ variant }: { variant: "hero" | "auth" }) {
  const glints = variant === "hero" ? ["g1", "g2", "g3", "g4", "g5", "g6"] : ["g1", "g2", "g4", "g5", "g6"];
  return (
    <div className="pn-season" data-variant={variant} aria-hidden="true">
      {variant === "hero" && (
        <>
          <span className="fx-bokeh" />
          <span className="fx-flare" />
          <svg className="fx-dust" viewBox="0 0 520 560" preserveAspectRatio="xMidYMid slice" focusable="false">
            {DUST.map(([cx, cy, r, o], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} opacity={o} />
            ))}
          </svg>
          <span className="fx-petal p1" />
          <span className="fx-petal p2" />
          <span className="fx-petal p3" />
        </>
      )}
      {glints.map((g) => (
        <span key={g} className={`fx-glint ${g}`} />
      ))}
    </div>
  );
}
