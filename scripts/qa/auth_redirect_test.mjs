// Người ĐÃ đăng nhập mở /auth/login · /auth/forgot · /auth/register → vào app (components/auth/useAuthedRedirect.ts):
// không nháy form khách (.pn-authgate, components/auth/auth.css), ?callbackUrl= chỉ đi TRONG trang web
// (lib/safeRedirect.ts — kể cả "/<TAB>/evil…", "/<LF>/evil…", "/<CR><LF>/evil…", "/\evil…"), ?error= của OAuth vẫn hiện
// form + lỗi, /auth/reset không chuyển, khách không bị chuyển; đăng nhập bằng form kèm callbackUrl giả dạng cũng không
// ra trang ngoài. Điện thoại, máy tính và app native (UA PawNailApp).
// CHỈ chạy với server local. Request tới evil.example.com bị chặn ngay trong trình duyệt (không bao giờ gửi đi).
//   node scripts/qa/auth_redirect_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, Results, SEED_TECH, fakeIp } from "./lib.mjs";

const R = new Results("Đã đăng nhập mở trang /auth");
const ORIGIN = new URL(BASE_URL).origin;
const EVIL = "evil.example.com";
const errors = [];
const browser = await chromium.launch();

const KINDS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { ...devices["Pixel 7"] },
  native: { ...devices["Pixel 7"], userAgent: devices["Pixel 7"].userAgent + " PawNailApp" },
};

/** Context (+ đăng nhập qua API khi `signedIn`). `returning`: máy từng đăng nhập (pn_authed → html[data-authed]). */
async function context(kind, { signedIn, returning = signedIn } = {}) {
  const ctx = await browser.newContext({ ...KINDS[kind], locale: "en-US" });
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": ip } }));
  ctx.evilHits = [];
  await ctx.route((u) => u.hostname === EVIL, (r) => {
    ctx.evilHits.push(r.request().url());
    return r.fulfill({ status: 200, contentType: "text/html", body: "<h1>intercepted</h1>" });
  });
  // Đo "form khách có lúc nào hiện không": mỗi khung hình xem ô nhập / nút / tiêu đề trong cột form (.pn-auth-form của
  // layout /auth — không dựa vào cách ẩn, nên bản cũ không có cổng cũng bị bắt) có thấy được không.
  await ctx.addInitScript((ret) => {
    try {
      if (ret) localStorage.setItem("pn_authed", "1");
    } catch {}
    if (!/\/auth\//.test(location.pathname)) return;
    const tick = () => {
      const el = document.querySelector(".pn-auth-form input, .pn-auth-form button, .pn-auth-form h1");
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden" && !sessionStorage.getItem("__qaFormSeen")) sessionStorage.setItem("__qaFormSeen", String(Math.round(performance.now())));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, returning);
  if (signedIn) {
    const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: { "cf-connecting-ip": ip } })).json();
    await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: SEED_TECH, password: DEMO_PASSWORD, json: "true" }, headers: { "cf-connecting-ip": ip } });
    const s = await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: { "cf-connecting-ip": ip } })).json();
    if (!s?.user?.id) throw new Error("không đăng nhập được " + SEED_TECH);
  }
  return ctx;
}

/** Mở `path`, chờ chuyển trang (nếu có); trả về nơi dừng + form khách đã hiện lúc nào (ms) hay chưa bao giờ. */
async function visit(ctx, path, settle = 2500) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${path}: ${e.message.slice(0, 120)}`));
  await p.goto(BASE_URL + path, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(settle);
  const u = new URL(p.url());
  const seen = u.origin === ORIGIN ? await p.evaluate(() => sessionStorage.getItem("__qaFormSeen")).catch(() => null) : null;
  const errBox = /error=/.test(path) ? await p.locator(".pn-error").filter({ visible: true }).count() : 0;
  const formVisible = await p.locator(".pn-auth-form input, .pn-auth-form button").filter({ visible: true }).count().catch(() => 0);
  await p.close();
  return { at: u.origin === ORIGIN ? u.pathname + u.search : u.href, offsite: u.origin !== ORIGIN, seen, errBox, formVisible };
}

try {
  // ---------- Đã đăng nhập: vào app, không nháy form ----------
  const HOME = [["/auth/login", "/"], ["/vi/auth/login", "/vi"], ["/auth/forgot", "/"], ["/vi/auth/forgot", "/vi"], ["/auth/register", "/"], ["/vi/auth/register", "/vi"], ["/auth/register?role=owner", "/"]];
  for (const kind of Object.keys(KINDS)) {
    const ctx = await context(kind, { signedIn: true });
    const got = [];
    for (const [path, want] of HOME) got.push({ path, want, ...(await visit(ctx, path)) });
    R.check(`AR1-${kind}`, `${kind}: đã đăng nhập mở login / forgot / register (EN, VI) → vào app đúng ngôn ngữ (EN "/", VI "/vi")`, got.every((g) => g.at === g.want), JSON.stringify(got.filter((g) => g.at !== g.want)));
    R.check(`AR2-${kind}`, `${kind}: form khách KHÔNG nháy lên trước khi chuyển (máy từng đăng nhập)`, got.every((g) => !g.seen), JSON.stringify(got.filter((g) => g.seen).map((g) => [g.path, g.seen + " ms"])));

    // ?error= (OAuth quay về) → ở lại, hiện form + thông báo lỗi; ?callbackUrl= nội bộ → tới đó; /auth/reset → ở lại
    const err = await visit(ctx, "/auth/login?error=OAuthSignin");
    const errVi = await visit(ctx, "/vi/auth/login?error=OAuthSignin");
    R.check(`AR3-${kind}`, `${kind}: /auth/login?error=… (cả /vi) vẫn hiện form + lỗi đăng nhập Google/Facebook/Apple`, err.at.startsWith("/auth/login") && err.errBox > 0 && err.formVisible > 0 && errVi.at.startsWith("/vi/auth/login") && errVi.errBox > 0, JSON.stringify({ err, errVi }));
    const cb = await visit(ctx, "/auth/login?callbackUrl=%2Fdesigns");
    R.check(`AR4-${kind}`, `${kind}: ?callbackUrl=/designs → /designs`, cb.at === "/designs", cb.at);
    const reset = await visit(ctx, "/auth/reset?token=abc");
    R.check(`AR5-${kind}`, `${kind}: /auth/reset (link trong email) không bị chuyển`, reset.at.startsWith("/auth/reset"), reset.at);

    // ?callbackUrl= trỏ ra ngoài, mọi kiểu ngụy trang → ở lại trang web (trang chủ), không 1 request nào tới trang lạ
    const EVIL_CB = ["%2F%2Fevil.example.com", "%2F%09%2Fevil.example.com", "%2F%0A%2Fevil.example.com", "%2F%0D%0A%2Fevil.example.com", "%2F%5Cevil.example.com", "https%3A%2F%2Fevil.example.com%2F", "%2Fauth%2Fregister"];
    const bad = [];
    for (const q of EVIL_CB) {
      for (const page of ["/auth/login", "/auth/forgot", "/vi/auth/register"]) {
        const v = await visit(ctx, `${page}?callbackUrl=${q}`, 2000);
        const want = page.startsWith("/vi") ? "/vi" : "/";
        if (v.offsite || v.at !== want) bad.push([page, q, v.at]);
      }
    }
    R.check(`AR6-${kind}`, `${kind}: callbackUrl ra trang ngoài (//, TAB, LF, CRLF, \\, https://) hay về /auth → về trang chủ, không rời trang web`, bad.length === 0 && ctx.evilHits.length === 0, JSON.stringify({ bad, evilHits: ctx.evilHits }));
    await ctx.close();
  }

  // ---------- Khách ----------
  const guest = await context("phone", { signedIn: false });
  const g = [];
  for (const path of ["/auth/login", "/vi/auth/login", "/auth/forgot", "/auth/register", "/auth/login?callbackUrl=%2Fdesigns"]) g.push({ path, ...(await visit(guest, path, 1500)) });
  R.check("AR7", "Khách: không bị chuyển, form hiện ngay (không bị cổng ẩn)", g.every((x) => x.at === x.path && x.formVisible > 0), JSON.stringify(g));
  await guest.close();

  // Máy còn pn_authed nhưng phiên đã hết (đăng xuất ở thiết bị khác) → cổng mở sau khi kiểm tra phiên, form hiện
  const stale = await context("phone", { signedIn: false, returning: true });
  const s = await visit(stale, "/auth/login", 1500);
  R.check("AR8", "Máy từng đăng nhập nhưng hết phiên: form khách hiện sau khi kiểm tra phiên (< 1,5 s ở local)", s.at === "/auth/login" && s.formVisible > 0, JSON.stringify(s));
  await stale.close();

  // ---------- Đăng nhập bằng form kèm callbackUrl giả dạng (LoginForm) ----------
  const bad = [];
  for (const q of ["%2F%09%2Fevil.example.com", "%2F%0A%2Fevil.example.com", "%2F%5Cevil.example.com", "%2F%2Fevil.example.com"]) {
    const ctx = await context("phone", { signedIn: false });
    const p = await ctx.newPage();
    await p.goto(BASE_URL + "/auth/login?callbackUrl=" + q, { waitUntil: "load" });
    await p.locator("#email").fill(SEED_TECH);
    await p.locator("#password").fill(DEMO_PASSWORD);
    await p.locator('form button[type="submit"]').first().click();
    await p.waitForURL((u) => !/\/auth\/login/.test(u.pathname), { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    const u = new URL(p.url());
    if (u.origin !== ORIGIN || ctx.evilHits.length) bad.push([q, p.url(), ctx.evilHits]);
    await ctx.close();
  }
  R.check("AR9", "Đăng nhập bằng form với callbackUrl giả dạng (TAB, LF, \\, //) → ở lại trang web", bad.length === 0, JSON.stringify(bad));
  R.check("AR10", "Không lỗi JS", errors.length === 0, errors.slice(0, 5).join(" | "));
} finally {
  await browser.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
