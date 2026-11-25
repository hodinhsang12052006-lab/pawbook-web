import { COLORS, lab } from "../../../lib/designEngine";
for (const k of ["cherry", "strawberry", "hotPink", "raspberry", "coral", "persimmon", "periwinkle", "bloodRed", "pumpkin", "lavender", "cobalt"]) { const [L, a, b] = lab((COLORS as any)[k].hex); console.log(k, L.toFixed(0), Math.hypot(a, b).toFixed(0), (((Math.atan2(b, a) * 180) / Math.PI + 360) % 360).toFixed(0)); }
