import { paletteOk, PATTERNS } from "../../../lib/designEngine";
const HERO = ["cherry", "raspberry", "cobalt", "emerald", "lavender", "pewter", "butter", "sage", "periwinkle", "hotPink", "coral", "aqua", "persimmon", "olive", "plum"];
const NEU = ["sheer", "milky", "nude", "bone", "black"];
const out: Record<string, string[]> = {};
for (const p of PATTERNS) { if (p.retired) continue;
  for (const h of HERO) { const mt = ["cobalt", "lavender", "periwinkle", "pewter", "aqua", "emerald"].includes(h) ? "silver" : "gold";
    for (const k of [...NEU.map((n) => [n, h, mt]), [h, "milky", mt], [h, "nude", mt], [h, "bone", mt]] as [string, string, string][]) if (paletteOk(p.id, k)) (out[p.id] ??= []).push(k.slice(0, 2).join("/")); } }
for (const [p, l] of Object.entries(out)) console.log(p.padEnd(14), l.join(" "));
