import { generateEngineDesigns } from "../../../lib/designEngine";
let tot = 0, all = 0;
for (const pre of ["", "a", "b", "c", "d"]) for (const [mo, occ] of [[11, "christmas"], [9, "halloween"]] as const) {
  let hist: string[] = [];
  for (let d = 0; d < 14; d++) for (const salt of ["0", "6", "12"]) {
    const date = new Date(Date.UTC(2026, mo, 1 + d + (mo === 9 ? 14 : 0))).toISOString().slice(0, 10);
    const b = generateEngineDesigns(6, { market: "US", date, salt: pre + salt, occasions: [{ id: occ, title: occ, startsIn: 0 }], risingTags: [], usedTitles: new Set(), recentPatterns: hist.slice(-18) });
    tot += b.filter((x) => hist.slice(-18).includes(x.pattern) && !x.pattern.startsWith("mix-")).length; all += b.length; hist = [...hist, ...b.map((x) => x.pattern)];
  }
}
console.log("repeats", tot, all, ((100 * tot) / all).toFixed(1) + "%");
