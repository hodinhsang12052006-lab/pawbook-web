// Chạy SAU `next build`: các trang trước đây là HTML tĩnh (phục vụ từ edge, không gọi
// function) phải vẫn tĩnh cho CẢ 2 ngôn ngữ (/en/… và /vi/…), và không trang chi tiết
// nào có dữ liệu DB bị prerender / lưu cache vô thời hạn sau khi chuyển sang app/[lang].
//   node scripts/i18n/check-static-routes.mjs
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync(".next/prerender-manifest.json", "utf8"));
const routes = manifest.routes || {};
const dynamicRoutes = manifest.dynamicRoutes || {};

// Danh sách HTML tĩnh trước khi chuyển sang app/[lang] (.next/prerender-manifest.json cũ, revalidate:false).
const FORMERLY_STATIC = [
  "/", "/admin/leads", "/admin/reports", "/admin/studio", "/auth/complete", "/auth/forgot", "/auth/login", "/auth/register",
  "/auth/reset", "/bookings", "/consult", "/data-deletion", "/designs", "/jobs/create", "/offline", "/privacy", "/profile",
  "/salons", "/supply", "/support", "/terms", "/tools/income-tracker", "/tools/radar", "/trends", "/tryon",
];
// Trang chi tiết đọc DB lúc render: vẫn render theo request như trước (ƒ) — không có bản
// HTML nào được dựng sẵn hay giữ mãi (tin bị xoá / sửa hiện đúng ngay).
const PER_REQUEST = ["/[lang]/jobs/[id]", "/[lang]/menu/[uid]", "/[lang]/profile/[uid]", "/[lang]/designs/[id]", "/[lang]/r/[token]", "/[lang]/messages"];

let fail = 0;
const check = (ok, label) => {
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}`);
};

for (const p of FORMERLY_STATIC) {
  for (const lang of ["en", "vi"]) {
    const key = p === "/" ? `/${lang}` : `/${lang}${p}`;
    const r = routes[key];
    check(!!r && r.initialRevalidateSeconds === false, `${key.padEnd(26)} static${r ? ` (revalidate ${r.initialRevalidateSeconds})` : " — MISSING"}`);
  }
}
const toPattern = (route) => new RegExp(`^${route.replace(/\[lang\]/, "(?:en|vi|\\[lang\\])").replace(/\[[a-z]+\]/g, "[^/]+")}$`);
for (const route of PER_REQUEST) {
  const re = toPattern(route);
  // /en/jobs/create là trang tĩnh anh em của /jobs/[id] — không tính.
  const isStaticSibling = (k) => FORMERLY_STATIC.some((p) => [`/en${p}`, `/vi${p}`, `/[lang]${p}`].includes(k));
  const prerendered = Object.keys(routes).filter((k) => re.test(k) && !isStaticSibling(k));
  const onDemand = Object.keys(dynamicRoutes).filter((k) => re.test(k) && !isStaticSibling(k));
  check(prerendered.length === 0 && onDemand.length === 0, `${route.padEnd(22)} rendered per request (prerendered: ${prerendered.length}, ISR fallbacks: ${onDemand.length})`);
}
// Segment gốc: chỉ en|vi, ngôn ngữ lạ → 404 (dynamicParams = false).
check(dynamicRoutes["/[lang]"]?.fallback === false, "/[lang] only en|vi (fallback:false)");

console.log(fail ? `\nstatic routes: FAIL (${fail})` : "\nstatic routes: PASS");
process.exit(fail ? 1 : 0);
