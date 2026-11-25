import { generateEngineDesigns } from "../../../lib/designEngine";
let hist: string[] = [], reps = 0, made = 0; const who: string[] = [];
for (let d = 0; d < 14; d++) for (const salt of ["0", "6", "12"]) {
  const date = new Date(Date.UTC(2026, 11, 1 + d)).toISOString().slice(0, 10);
  const b = generateEngineDesigns(6, { market: "US", date, salt, occasions: [{ id: "christmas", title: "Giáng Sinh", startsIn: 0 }], risingTags: [], usedTitles: new Set(), recentPatterns: hist.slice(-18) });
  const rp = b.filter((x) => hist.slice(-18).includes(x.pattern) && !x.pattern.startsWith("mix-")); reps += rp.length; made += b.length; hist = [...hist, ...b.map((x) => x.pattern)]; rp.forEach((x) => who.push(`${date}/${salt}:${x.pattern}/${x.finish}`));
}
console.log(reps, made, who.join(" "));
