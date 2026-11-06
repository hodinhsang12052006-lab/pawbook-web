// tr() phải an toàn khi máy chủ render NHIỀU request cùng lúc (Vercel Fluid,
// prerender song song lúc build): mỗi request đọc đúng ngôn ngữ của nó dù React
// Fizz xen kẽ các task ở điểm suspend. Chạy 2 bộ render (react-dom của dự án và
// bản react-dom Next.js thật sự dùng) với 24 cây EN/VI song song, mỗi cây có
// nhiều Suspense + lazy resolve ngẫu nhiên.
//   npx tsx scripts/i18n/tr_concurrency_test.mts
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import React from "react";
import { LocaleContext } from "../../lib/i18n/localeContext";
import { bindLocaleContext, setTrLocale, tr, currentLocale } from "../../lib/i18n/tr";
import { dt } from "../../lib/i18n/dataEn";

let fail = 0;
// Ngoài lúc render (route handler, unit test như data_en_unit) → biến toàn cục.
// Kiểm tra TRƯỚC khi có lượt render nào: sau khi Fizz retry 1 task, context có thể
// giữ giá trị của task cuối tới lượt render sau — vô hại vì ở tầng SSR tr() chỉ
// được gọi trong lúc render (route handler/RSC không nạp localeContext).
for (const g of ["vi", "en"] as const) {
  setTrLocale(g);
  const ok = currentLocale() === g && tr("VI", "EN") === g.toUpperCase();
  console.log(`${ok ? "✅" : "❌"} outside a render, setTrLocale("${g}") → ${tr("VI", "EN")}`);
  if (!ok) fail++;
}

const require = createRequire(import.meta.url);
const h = React.createElement;

type Renderer = { name: string; renderToPipeableStream: (el: React.ReactNode, opts: Record<string, unknown>) => { pipe: (w: NodeJS.WritableStream) => void } };
const renderers: Renderer[] = [
  { name: "react-dom/server", ...require("react-dom/server.node") },
  { name: "next/dist/compiled/react-dom/server", ...require("next/dist/compiled/react-dom/server.node") },
];

function Leaf({ id }: { id: string }) {
  // dt() đi qua currentLocale() như mọi chuỗi nội dung của app.
  return h("i", null, `${id}:${tr("VI", "EN")}:${dt("Thỏa thuận") === "Negotiable" ? "EN" : "VI"}`);
}

function lazyLeaf(id: string) {
  return React.lazy(
    () => new Promise<{ default: React.ComponentType }>((resolve) => setTimeout(() => resolve({ default: () => h(Leaf, { id }) }), Math.random() * 25))
  );
}

// Mỗi bộ render 1 context riêng (cùng cơ chế bindLocaleContext như LanguageProvider)
// — 2 bản React dùng chung 1 context sẽ bị React cảnh báo, không liên quan app.
let Ctx: React.Context<"en" | "vi" | null> = LocaleContext;

function App({ locale, n }: { locale: "en" | "vi"; n: number }) {
  const kids: React.ReactNode[] = [h(Leaf, { key: "sync", id: "sync" })];
  for (let i = 0; i < n; i++) {
    const L = lazyLeaf(`l${i}`);
    // Lồng 2 tầng Suspense: task được tạo lại ở cả 2 tầng.
    kids.push(h(React.Suspense, { key: i, fallback: null }, h("b", null, h(L), h(React.Suspense, { fallback: null }, h(lazyLeaf(`n${i}`))))));
  }
  return h(Ctx.Provider, { value: locale }, h("div", null, kids));
}

function render(r: Renderer, el: React.ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const out = new PassThrough();
    let html = "";
    out.on("data", (c) => (html += c));
    out.on("end", () => resolve(html));
    const s = r.renderToPipeableStream(el, { onAllReady: () => s.pipe(out), onShellError: reject, onError: reject });
  });
}

// Biến toàn cục cố tình đặt ngược ("vi") — nếu tr() lỡ đọc biến này khi render EN thì test bắt được.
setTrLocale("vi");
for (const [idx, r] of renderers.entries()) {
  if (idx > 0) {
    Ctx = React.createContext<"en" | "vi" | null>(null);
    bindLocaleContext(Ctx);
  }
  const jobs = Array.from({ length: 24 }, (_, i) => {
    const locale = i % 2 ? "vi" : "en";
    return render(r, h(App, { locale, n: 12 })).then((html) => ({ locale, html }));
  });
  const results = await Promise.all(jobs);
  let bad = 0;
  for (const { locale, html } of results) {
    const want = locale === "en" ? "EN" : "VI";
    const other = locale === "en" ? ":VI" : ":EN";
    const leaves = html.match(/:(EN|VI):(EN|VI)/g) ?? [];
    if (leaves.length !== 25 || html.includes(other) || !html.includes(`:${want}:${want}`)) bad++;
  }
  console.log(`${bad ? "❌" : "✅"} ${r.name}: ${results.length} concurrent renders, ${bad} with cross-request strings`);
  fail += bad;
}

console.log(fail ? `\ntr concurrency: FAIL (${fail})` : "\ntr concurrency: PASS");
process.exit(fail ? 1 : 0);
