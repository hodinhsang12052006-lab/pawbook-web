import "./season-effects.css";

// Season layer: decorative light INSIDE the landing hero photo stage only, z-index 0 under the cards — never under
// the H1, lede or CTAs, and never next to a form (/auth/* shows the season only as the plate's tinted halo).
// Server-safe static markup; colours + visibility come from html[data-season] (lib/season.ts SEASON_BOOT) via CSS,
// so it is right before first paint on static pages.
// No snow, no fireworks, no falling petals, no clip-art stars: soft bokeh, one soft flare glow, 6 lens glints
// (soft point + faint cross, like a highlight on lacquer) and dust (never a tiled pattern). The season's main cue
// is the tinted halo behind the cards (.pn-stack::before, --s-halo*) + the photo set + the H1 foil.

// 22 hand-placed motes in a 520×560 field (r .6–1.4, opacity .25–.6)
const DUST: [number, number, number, number][] = [
  [34, 48, 1.2, 0.5], [92, 20, 0.8, 0.35], [148, 66, 1.0, 0.45], [212, 18, 0.7, 0.3], [286, 40, 1.4, 0.55], [352, 14, 0.9, 0.4],
  [430, 52, 1.1, 0.5], [496, 30, 0.6, 0.3], [20, 168, 0.9, 0.4], [506, 150, 1.3, 0.6], [16, 300, 1.1, 0.45], [500, 286, 0.8, 0.35],
  [40, 420, 0.7, 0.3], [488, 410, 1.2, 0.5], [72, 516, 1.0, 0.4], [150, 548, 0.6, 0.25], [236, 530, 1.3, 0.55], [318, 552, 0.8, 0.35],
  [398, 522, 1.1, 0.45], [470, 540, 0.7, 0.3], [262, 4, 0.9, 0.4], [120, 120, 0.6, 0.25],
];

const GLINTS = ["g1", "g2", "g3", "g4", "g5", "g6"];

export default function SeasonLayer({ variant = "hero" }: { variant?: "hero" }) {
  return (
    <div className="pn-season" data-variant={variant} aria-hidden="true">
      <span className="fx-bokeh" />
      <span className="fx-flare" />
      <svg className="fx-dust" viewBox="0 0 520 560" preserveAspectRatio="xMidYMid slice" focusable="false">
        {DUST.map(([cx, cy, r, o], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} opacity={o} />
        ))}
      </svg>
      {GLINTS.map((g) => (
        <span key={g} className={`fx-glint ${g}`} />
      ))}
    </div>
  );
}
