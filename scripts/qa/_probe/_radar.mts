import { TREND_RADAR } from "../../../lib/trendRadar";
import { paletteOk, finishOk, COLORS } from "../../../lib/designEngine";
for (const t of TREND_RADAR) for (const l of t.looks) {
  const bad = l.colors.filter((c) => !paletteOk(l.pattern, c as any));
  if (bad.length) console.log(t.id, l.pattern, l.finish, "REJECTED", bad.map((c) => c.join("/")).join(" "), bad.length === l.colors.length ? "<<< ALL" : "");
  const fb = l.colors.filter((c) => !finishOk(l.pattern, (COLORS as any)[c[0]]?.hex ?? "#000", l.finish as any));
  if (fb.length) console.log(t.id, l.pattern, "FINISH-BAD", l.finish, fb.map((c) => c.join("/")).join(" "));
}
