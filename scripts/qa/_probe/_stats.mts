// probe (không commit): phân bố màu / họ màu / hoạ tiết theo ngày như cron 3 lượt × 6
import type { EngineDesign } from "../../../lib/designEngine";
const M = process.env.HEAD ? await import("./de_head") : await import("../../../lib/designEngine");
const { generateEngineDesigns, toneFam, COLORS } = M; const tonesOf = (p: string[], pid = "") => process.env.ALLT ? M.tonesOf(p) : (M as any).visTones(pid, p);
const name = new Map(Object.entries(COLORS).map(([k, c]) => [c.hex as string, k]));
const runs: [string, number, number, number, string | null][] = [["US", 2026, 9, 18, "halloween"], ["US", 2026, 11, 1, "christmas"], ["US", 2027, 1, 30, "valentine"], ["US", 2026, 9, 1, "fall"], ["AU", 2026, 11, 5, "christmas"], ["US", 2027, 3, 10, null], ["US", 2027, 6, 10, null], ["AU", 2027, 3, 10, null]];
const famTot = new Map<string, number>(), hexTot = new Map<string, number>(), patTot = new Map<string, number>();
const famWho = new Map<string, number>(), hexWho = new Map<string, number>();
let rep = 0, n = 0, days = 0, hexMaxSum = 0, famMaxSum = 0, over20 = 0, over30 = 0;
const hexMaxHist = new Map<number, number>(), famMaxHist = new Map<number, number>();
for (const [mk, y, mo, d0, occId] of runs) {
  let hist: string[] = [], pals: string[][] = [], fins: string[] = [];
  for (let k = 0; k < 14; k++) {
    const date = new Date(Date.UTC(y, mo, d0 + k)).toISOString().slice(0, 10);
    const day: EngineDesign[] = [];
    for (const salt of ["0", "6", "12"]) {
      const b = generateEngineDesigns(6, { market: mk as "US" | "AU", date, salt, occasions: occId ? [{ id: occId, title: occId, startsIn: 0 }] : [], risingTags: [], usedTitles: new Set(), recentPatterns: hist.slice(-18), recentPalettes: pals.slice(-18), recentFinishes: fins.slice(-18) });
      const prev = new Set(hist.slice(-18)); rep += b.filter((x) => prev.has(x.pattern) && !x.pattern.startsWith("mix-")).length;
      hist = [...hist, ...b.map((x) => x.pattern)]; pals = [...pals, ...b.map((x) => x.palette)]; fins = [...fins, ...b.map((x: any) => x.finish)]; day.push(...b);
    }
    days++; n += day.length;
    const hc = new Map<string, number>(), fc = new Map<string, number>();
    for (const x of day) { patTot.set(x.pattern, (patTot.get(x.pattern) ?? 0) + 1); const T: string[] = tonesOf(x.palette, x.pattern); T.forEach((h) => { hc.set(h, (hc.get(h) ?? 0) + 1); hexTot.set(h, (hexTot.get(h) ?? 0) + 1); }); new Set(T.map(toneFam)).forEach((f) => { fc.set(f, (fc.get(f) ?? 0) + 1); famTot.set(f, (famTot.get(f) ?? 0) + 1); }); }
    const hm = Math.max(...hc.values()), fm = Math.max(...fc.values());
    hexMaxHist.set(hm, (hexMaxHist.get(hm) ?? 0) + 1); famMaxHist.set(fm, (famMaxHist.get(fm) ?? 0) + 1);
    if (hm > 0.2 * day.length + 0.01) over20++; if (fm > 0.3 * day.length + 0.01) over30++;
    if (fm >= 6) { const f = [...fc].filter(([, v]) => v === fm).map(([k]) => k).join(","); famWho.set(`${fm}:${f}`, (famWho.get(`${fm}:${f}`) ?? 0) + 1); }
    if (hm >= 4) { const f = [...hc].filter(([, v]) => v === hm).map(([k]) => name.get(k)).join(","); hexWho.set(`${hm}:${f}`, (hexWho.get(`${hm}:${f}`) ?? 0) + 1); }
    if (process.env.ALL) console.log(mk, date, occId, `hex ${hm} fam ${fm}`, "|", day.map((x) => `${x.pattern}(${tonesOf(x.palette).map((h) => name.get(h)).join("/")})`).join(" "));
  }
}
const pct = (v: number) => `${Math.round((100 * v) / n)}%`;
console.log("designs", n, "days", days);
console.log("fam share", [...famTot].sort((a, b) => b[1] - a[1]).map(([f, v]) => `${f}:${pct(v)}`).join(" "));
console.log("hex share", [...hexTot].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([h, v]) => `${name.get(h)}:${pct(v)}`).join(" "));
console.log("day max hex count hist", JSON.stringify([...hexMaxHist].sort((a, b) => a[0] - b[0])), "days>20%", over20);
console.log("day max fam count hist", JSON.stringify([...famMaxHist].sort((a, b) => a[0] - b[0])), "days>30%", over30);
console.log("patterns used", patTot.size, "top", [...patTot].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p, v]) => `${p}:${v}`).join(" "));
console.log("famWho", [...famWho].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
console.log("hexWho", [...hexWho].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
console.log("repeats of last-18 patterns", rep, `${((100 * rep) / n).toFixed(1)}%`);
