import fs from "node:fs";
import { COLORS, toneFam } from "../../../lib/designEngine";
const name = new Map(Object.entries(COLORS).map(([k, c]) => [c.hex as string, k]));
for (const f of process.argv.slice(2)) {
  const idx = JSON.parse(fs.readFileSync(f, "utf8")) as { palette: string[] }[];
  const milky = idx.filter((d) => d.palette.slice(0, 2).includes(COLORS.milky.hex)).length;
  const brown = idx.filter((d) => d.palette.slice(0, 2).some((h) => toneFam(h) === "brown")).length;
  const hc = new Map<string, number>(); idx.forEach((d) => new Set(d.palette.slice(0, 2)).forEach((h) => hc.set(name.get(h) ?? h, (hc.get(name.get(h) ?? h) ?? 0) + 1)));
  console.log(f.split("/").slice(-3).join("/"), "n", idx.length, "milky", milky, "brownFam", brown, "top", [...hc].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}:${v}`).join(" "));
}
