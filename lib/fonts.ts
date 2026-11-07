import { Fraunces } from "next/font/google";

// Display face for MARKETING headings only (landing H1/H2, auth H1, auth panel tagline) — never in the root
// layout, so in-app pages ship zero Fraunces bytes. Body/UI stays Be Vietnam Pro (--font-pn, root layout).
// Variable (wght + opsz, optical sizing auto); latin + vietnamese subsets split by unicode-range, so EN pages
// fetch only the latin file (~67 KB). preload:false keeps it off pages that import this module but don't render a
// .pn-display heading; adjustFontFallback (default) keeps the swap CLS ≈ 0.
export const fraunces = Fraunces({
  subsets: ["latin", "vietnamese"],
  axes: ["opsz"],
  style: ["normal"],
  display: "swap",
  preload: false,
  variable: "--font-display",
});
