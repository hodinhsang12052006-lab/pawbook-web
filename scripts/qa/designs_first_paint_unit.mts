// Unit: /designs server-rendered first row (lib/designsOrder.ts) — market-neutral cards, the client keeps them first when
// its market list arrives (no reflow), occasion chips in one fixed order. No server / DB.
//   npx tsx scripts/qa/designs_first_paint_unit.mts
import { FIRST_PAINT_CARDS, occasionChips, pickFirstPaint, withPinned } from "../../lib/designsOrder";
import { isRegisterRole, REGISTER_ROLES } from "../../lib/registerRoles";

let fail = 0;
const eq = (id: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${JSON.stringify(got)}${ok ? "" : `  (want ${JSON.stringify(want)})`}`);
};
const cdn = (id: string) => `https://res.cloudinary.com/x/image/upload/v1/pawbook/designs-flow/${id}.jpg`;
const d = (id: string, occasion: string | null = null, imageUrl: string | null = cdn(id)) => ({ id, occasion, imageUrl });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

// Production shape on 2026-11-07: US list has US-only "fall" cards at 2, 4, 7; AU list is everything else.
const US = [d("a"), d("b"), d("f1", "fall"), d("c"), d("f2", "fall"), d("e"), d("g"), d("f3", "fall"), d("h")];
const AU = [d("a"), d("b"), d("c"), d("e"), d("g"), d("h"), d("i")];
const fp = pickFirstPaint(US, AU);
eq("P1 first paint = the newest cards both markets show", ids(fp.designs), ["a", "b", "c", "e"]);
eq("P2 FIRST_PAINT_CARDS (one desktop row, two phone rows)", FIRST_PAINT_CARDS, 4);
eq("P3 occasion chips per market", fp.occasions, { US: ["fall"], AU: [] });
eq("P4 data: pictures (local demo) are never inlined", ids(pickFirstPaint([d("x", null, "data:image/jpeg;base64,AAA"), d("y")], [d("x", null, "data:image/jpeg;base64,AAA"), d("y")]).designs), ["y"]);
eq("P5 no picture → not in the first paint", ids(pickFirstPaint([d("x", null, null), d("y")], [d("x", null, null), d("y")]).designs), ["y"]);
eq("P6 nothing in common → empty (page falls back to its skeleton)", ids(pickFirstPaint([d("u")], [d("v")]).designs), []);

// The client's market list arrives: pinned first (same order), then the rest of that market's list.
eq("W1 US viewer: pinned row stays, fall cards follow", ids(withPinned(fp.designs, US)), ["a", "b", "c", "e", "f1", "f2", "g", "f3", "h"]);
eq("W2 AU viewer: pinned row stays", ids(withPinned(fp.designs, AU)), ["a", "b", "c", "e", "g", "h", "i"]);
eq("W3 a pinned card unpublished since the build is dropped", ids(withPinned(fp.designs, AU.filter((x) => x.id !== "b"))), ["a", "c", "e", "g", "h", "i"]);
eq("W4 newer designs published since the build go after the pinned row", ids(withPinned(fp.designs, [d("new1"), ...AU])), ["a", "b", "c", "e", "new1", "g", "h", "i"]);
eq("W5 no pinned row → the list as is", ids(withPinned([], AU)), ids(AU));
eq("W6 uses the list's objects (fresh saves / saved flags)", withPinned([{ id: "a", saves: 0 }], [{ id: "a", saves: 7 }])[0].saves, 7);

// Chips: one fixed calendar order (THEMES), unknown ids last, de-duplicated — not "first seen in the list".
eq("C1 calendar order", occasionChips(["christmas", "fall", null, "thanksgiving", "fall"]), ["fall", "thanksgiving", "christmas"]);
eq("C2 unknown occasions after the known ones, alphabetical", occasionChips(["zz-custom", "aa-custom", "valentine"]), ["valentine", "aa-custom", "zz-custom"]);

// Register roles (edge rewrite /auth/register?role=… → /[lang]/auth/register/[role])
eq("R1 roles", [...REGISTER_ROLES], ["client", "technician", "owner"]);
eq("R2 role guard", ["client", "owner", "technician", "admin", "", null, "Client"].map(isRegisterRole), [true, true, true, false, false, false, false]);

console.log(fail ? `\ndesigns_first_paint_unit: ${fail} FAIL` : "\ndesigns_first_paint_unit: PASS");
process.exit(fail ? 1 : 0);
