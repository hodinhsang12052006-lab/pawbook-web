import { chromium, devices } from "playwright";
import { BASE_URL, Client } from "./lib.mjs";
const [,, lang, who, target] = process.argv;
const browser = await chromium.launch();
const host = new URL(BASE_URL).hostname;
const ctx = await browser.newContext({ ...devices["iPhone 14"], locale: lang === "vi" ? "vi-VN" : "en-US" });
await ctx.addCookies([{ name: "bitpaw_locale", value: lang, domain: host, path: "/" }]);
if (who !== "guest") { const c = new Client(); await c.login(who); await ctx.addCookies(Object.entries(c.jar).map(([name, value]) => ({ name, value, domain: host, path: "/" }))); }
const p = await ctx.newPage();
const logs = [];
p.on("console", (m) => { if (!/Pusher/.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
p.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
p.on("crash", () => logs.push("[CRASH]"));
let reqs = []; p.on("request", (r) => reqs.push(r.url().replace(BASE_URL, "")));
await p.goto(BASE_URL + target, { waitUntil: "load" }).catch((e) => logs.push("goto " + e.message.slice(0, 80)));
for (let i = 0; i < 10; i++) {
  try { await p.waitForTimeout(600); const m = await p.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1e6) + "MB nodes=" + document.getElementsByTagName("*").length); console.log(i, m, "reqs", reqs.length); } catch (e) { console.log(i, "ERR", e.message.slice(0, 60)); break; }
}
const counts = {}; for (const r of reqs) { const k = r.split("?")[0]; counts[k] = (counts[k] || 0) + 1; }
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8));
console.log(logs.slice(-15).join("\n"));
await browser.close();
