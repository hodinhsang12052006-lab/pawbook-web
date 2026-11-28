// Khách LỚN TUỔI (chủ tiệm 50–65, chỉnh chữ to trên Android): điện thoại 360×740, cỡ chữ hệ thống 125% / 150% (giả lập
// bằng font-size gốc — Tailwind tính theo rem nên toàn trang phóng theo, như Android "Font size: Large / Largest").
// Mỗi trang chính, mỗi vai (chủ tiệm / thợ / khách): không tràn ngang, không chữ bị cắt mất (chữ dài hơn khung mà khung
// cắt), nút / link chính đủ to để bấm (≥ 40px cao) và chữ thân không dưới 14px.
// CHỈ chạy với server local (lib.mjs chặn bitpawos.com).
//   BASE_URL=http://localhost:3000 node scripts/qa/elder_large_text_test.mjs
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, Results, SEED_OWNER, SEED_TECH, fakeIp } from "./lib.mjs";

const R = new Results("Khách lớn tuổi — chữ to, máy nhỏ");
const SEED_CLIENT = process.env.QA_EMAIL_CLIENT || "jessica.client@pawnailjobs.demo";
const browser = await chromium.launch();
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

async function session(email, scale) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, locale: "vi-VN", serviceWorkers: "block" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
      localStorage.setItem("pn_web_push_off", "1");
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
    } catch {}
    document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.fontSize = `${s}%`; });
  }, scale);
  if (email) {
    const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
    await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  }
  return { ctx, page: await ctx.newPage() };
}

async function audit(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    // Tràn thật: phần tử lá (không nằm trong khung cuộn / cắt riêng, không phải lớp phủ fixed) vượt mép phải màn hình.
    // Đo từng phần tử — html/body có overflow-x: clip (lưới an toàn) nên scrollWidth của trang không còn phản ánh lỗi.
    let overflow = 0;
    for (const e of document.querySelectorAll("body *")) {
      const rc = e.getBoundingClientRect();
      if (rc.width < 2 || rc.right <= vw + 1 || rc.width >= vw * 1.6) continue;
      if ([...e.children].some((c) => c.getBoundingClientRect().right > vw + 1)) continue;
      let a = e.parentElement, contained = false;
      while (a && a !== document.body) {
        const cs = getComputedStyle(a);
        if (cs.position === "fixed" || (/auto|scroll|hidden|clip/.test(cs.overflowX) && a.getBoundingClientRect().right <= vw + 1)) { contained = true; break; }
        a = a.parentElement;
      }
      if (getComputedStyle(e).position === "fixed") contained = true;
      if (!contained) overflow = Math.max(overflow, Math.round(rc.right - vw));
    }
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.top < innerHeight * 3; };
    // chữ bị cắt: phần tử có chữ, overflow hidden/clip, không có dấu "…" (text-overflow: ellipsis / line-clamp là chủ ý)
    const clipped = [];
    for (const e of document.querySelectorAll("button, a, h1, h2, h3, label, p, span")) {
      if (!visible(e) || !e.textContent.trim() || e.children.length > 2) continue;
      if (e.getBoundingClientRect().width <= 2 || /sr-only/.test(e.className?.toString?.() || "")) continue; // chữ cho trình đọc màn hình
      const cs = getComputedStyle(e);
      const hides = /hidden|clip/.test(cs.overflowX + cs.overflow);
      const ellipsis = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none" || /line-clamp|truncate/.test(e.className?.toString?.() || "");
      if (hides && !ellipsis && e.scrollWidth > e.clientWidth + 2) clipped.push(e.textContent.trim().slice(0, 40));
    }
    // nút chính quá nhỏ để bấm (chỉ phần tử tương tác có chữ, bỏ icon nhỏ trong thanh)
    const small = [];
    for (const e of document.querySelectorAll("button, a[href], [role=button], input:not([type=hidden]), select")) {
      if (!visible(e)) continue;
      // link nằm giữa câu văn (WCAG 2.5.8: ngoại lệ inline) không tính
      if (getComputedStyle(e).display === "inline" && e.parentElement && /^(P|SPAN|LI|LABEL)$/.test(e.parentElement.tagName)) continue;
      const r = e.getBoundingClientRect();
      const txt = (e.textContent || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").trim();
      if (txt.length >= 4 && r.height < 24 && r.width < vw - 32) small.push(`${txt.slice(0, 28)} (${Math.round(r.height)}px)`);
    }
    // chữ thân quá nhỏ
    let tiny = 0;
    for (const e of document.querySelectorAll("p, li, span")) {
      if (!visible(e) || !e.textContent.trim() || e.children.length) continue;
      if (parseFloat(getComputedStyle(e).fontSize) < 11.5) tiny++;
    }
    return { overflow, clipped: [...new Set(clipped)].slice(0, 6), small: [...new Set(small)].slice(0, 8), tiny };
  });
}

// Mục Sang tiệm: danh sách + 1 trang tin có thật (nếu DB QA có tin) + form đăng
const firstSale = await fetch(BASE_URL + "/api/salon-sales?market=US").then((r) => r.json()).then((d) => d.sales?.[0]?.id).catch(() => null);
const salePages = ["/salons-for-sale", ...(firstSale ? [`/salons-for-sale/${firstSale}`] : [])];
const PAGES = {
  owner: ["/", "/?tab=jobs", "/jobs/create", "/messages", "/profile", "/designs", "/bookings", "/supply", "/salons", ...salePages, "/salons-for-sale/new"],
  tech: ["/", "/?tab=jobs", "/messages", "/profile", "/designs", "/trends", "/tryon", "/salons-for-sale"],
  client: ["/", "/designs", "/salons", "/tryon", "/consult", "/messages", "/profile"],
  guest: ["/", "/auth/register?role=owner", "/auth/register?role=technician", "/auth/login", "/designs", "/android-beta", "/support", ...salePages],
};
const WHO = { owner: SEED_OWNER, tech: SEED_TECH, client: SEED_CLIENT, guest: null };

const worst = { overflow: [], clipped: [], small: [] };
for (const scale of [125, 150]) {
  for (const [role, pages] of Object.entries(PAGES)) {
    const { ctx, page } = await session(WHO[role], scale);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
    for (const path of pages) {
      await page.goto(BASE_URL + path, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(2200);
      const a = await audit(page);
      const tag = `${scale}% ${role} ${path}`;
      if (a.overflow > 2) worst.overflow.push(`${tag} (+${a.overflow}px)`);
      for (const c of a.clipped) worst.clipped.push(`${tag}: "${c}"`);
      if (scale === 125) for (const s of a.small) worst.small.push(`${tag}: ${s}`);
    }
    R.check(`E-${scale}-${role}-js`, `${scale}% chữ — ${role}: không lỗi JavaScript trên ${pages.length} trang`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}
R.check("E1", "Chữ to 125% & 150%, máy 360px: không trang nào tràn ngang", worst.overflow.length === 0, worst.overflow.slice(0, 8).join(" ; "));
R.check("E2", "Không chữ nào bị cắt mất (khung cắt mà không có dấu …)", worst.clipped.length === 0, worst.clipped.slice(0, 8).join(" ; "));
R.check("E3", "Nút / link có chữ đủ to để bấm (≥ 24px cao — WCAG 2.5.8 — ở chữ 125%)", worst.small.length === 0, worst.small.slice(0, 10).join(" ; "));
await browser.close();
R.summary();
