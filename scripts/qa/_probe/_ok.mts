import { paletteOk, finishOk, COLORS } from "../../../lib/designEngine";
const t: [string, [string, string, string], boolean][] = [["fr-skittle", ["sheer", "milky", "gold"], false], ["fr-skittle", ["sheer", "coffee", "gold"], false], ["fr-skittle", ["sheer", "cobalt", "silver"], true],
 ["plaid", ["redVelvet", "pine", "gold"], false], ["plaid", ["cherry", "pine", "gold"], true], ["syrup", ["cobalt", "sheer", "silver"], false], ["syrup", ["raspberry", "sheer", "pearl"], true], ["aura", ["milky", "cobalt", "silver"], false], ["aura", ["milky", "cherry", "gold"], true],
 ["fawn", ["persimmon", "bone", "gold"], false], ["fawn", ["caramel", "cloudDancer", "gold"], true], ["fawn", ["milky", "persimmon", "gold"], false], ["gelflower", ["sheer", "raspberry", "pearl"], false], ["gelflower", ["sheer", "lavender", "pearl"], true],
 ["chromefrench", ["chocolate", "gold", "gold"], false], ["chromefrench", ["nude", "gold", "gold"], true], ["jelly", ["cobalt", "milky", "silver"], false], ["jelly", ["sage", "milky", "gold"], false], ["jelly", ["lavender", "milky", "silver"], true], ["jelly", ["raspberry", "milky", "gold"], true],
 ["blush", ["sheer", "cobalt", "silver"], false], ["blush", ["sheer", "hotPink", "pearl"], true], ["milkbath", ["milky", "pewter", "silver"], false], ["milkbath", ["milky", "cobalt", "silver"], true]];
for (const [p, k, want] of t) if (paletteOk(p, k) !== want) console.log("MISMATCH", p, k.join("/"), "want", want);
console.log("fr-glitter glitter", finishOk("fr-glitter", COLORS.milky.hex, "glitter"));
