import { COLORS, toneFam, lab } from "../../../lib/designEngine";
for (const [k, c] of Object.entries(COLORS)) { const [L, a, b] = lab(c.hex); console.log(k.padEnd(12), toneFam(c.hex).padEnd(7), L.toFixed(0), Math.hypot(a, b).toFixed(0)); }
