// Service worker side of the call pushes (worker/index.js) in a real Chromium, pushes delivered through the DevTools
// protocol (ServiceWorker.deliverPushMessage) — no push service, no network. Needs a LOCAL production build (sw.js).
//   BASE_URL=http://localhost:3710 node scripts/qa/call_push_sw_test.mjs
// Checks: incoming call → ringing notification with the call's own tag (stays on screen); "missed" follow-up with the
// SAME tag replaces it (one notification, missed text, quiet); a late incoming for an ended call shows the missed
// text, not a ring; an incoming long past its expiry shows its stale (missed) text, but one whose exp is slightly in the
// past (device clock ahead of the server) still rings; quiet "Answered." replaces it silently; another call's
// notification is never touched.
import { chromium } from "playwright";
import { BASE_URL, Results } from "./lib.mjs";

const R = new Results("Call push · service worker");
// The full Chromium in new-headless mode: the default headless shell reports Notification.permission "denied".
const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ permissions: ["notifications"], serviceWorkers: "allow" });
const page = await ctx.newPage();
await page.goto(BASE_URL + "/auth/login");
const swOk = await page
  .waitForFunction(async () => (await navigator.serviceWorker.getRegistration("/"))?.active?.state === "activated", null, { timeout: 90000, polling: 1000 })
  .then(() => true)
  .catch(() => false);
// Controlled page + a warm-up notification: right after activation Chromium may still answer showNotification with
// "No active registration available".
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
const warm = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 20; i++) {
    try {
      await reg.showNotification("warm-up", { tag: "qa-warm" });
      (await reg.getNotifications({ tag: "qa-warm" })).forEach((n) => n.close());
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
});
R.check("SW0", "Service worker installs, activates and can show notifications on the local build", swOk && warm, JSON.stringify({ swOk, warm }));

// Another tab in front: the PawNail page is open but not focused (the SW skips system notifications only when a PawNail
// window is visible AND focused).
const other = await ctx.newPage();
await other.goto("about:blank");
await other.bringToFront();
const cdp = await ctx.newCDPSession(page);
const regs = [];
cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => regs.push(...e.registrations));
await cdp.send("ServiceWorker.enable");
await page.waitForTimeout(500);
const origin = new URL(BASE_URL).origin;
const reg = regs.find((r) => r.scopeURL.startsWith(origin) && !r.isDeleted);
const push = async (data) => {
  await cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId: reg.registrationId, data: JSON.stringify(data) });
  await page.waitForTimeout(700);
};
const shown = () =>
  page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ tag: n.tag, title: n.title, body: n.body, ri: n.requireInteraction, silent: n.silent })));
const closeAll = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).forEach((n) => n.close()));
const now = Date.now();
const incoming = (id, over = {}) => ({ title: "Incoming call", body: "Lan is calling you. Open PawNail to answer.", url: "/messages?to=u1", tag: `pn-call-${id}`, kind: "call", exp: Date.now() + 60_000, stale: { title: "Missed call from Lan", body: "Tap to call back." }, ...over });
const ended = (id, over = {}) => ({ title: "Missed call from Lan", body: "Tap to call back.", url: "/messages?to=u1", tag: `pn-call-${id}`, kind: "call-end", ...over });

if (reg) {
  await closeAll();
  await push(incoming("aaa1"));
  const s1 = await shown();
  R.check("SW1", "Incoming call push → 1 notification, tag pn-call-<callId>, stays on screen (requireInteraction)", s1.length === 1 && s1[0].tag === "pn-call-aaa1" && s1[0].ri === true && s1[0].title === "Incoming call", JSON.stringify(s1));

  await push(incoming("bbb2", { body: "Mai is calling you." }));
  await push(ended("aaa1"));
  const s2 = await shown();
  const a = s2.find((n) => n.tag === "pn-call-aaa1");
  const b = s2.find((n) => n.tag === "pn-call-bbb2");
  R.check("SW2", "Caller hung up → follow-up with the SAME tag REPLACES the incoming notification ('Missed call from Lan', no longer pinned); another call's notification untouched",
    s2.length === 2 && a?.title === "Missed call from Lan" && a?.ri === false && b?.title === "Incoming call", JSON.stringify(s2));

  await push(incoming("aaa1"));
  const s3 = await shown();
  const a3 = s3.find((n) => n.tag === "pn-call-aaa1");
  R.check("SW3", "An 'incoming' push for that call arriving LATE (after its end) shows the missed text, never rings again", a3?.title === "Missed call from Lan" && a3?.ri === false && s3.length === 2, JSON.stringify(s3));

  await closeAll();
  await push(incoming("ccc3", { exp: now - 10 * 60_000 }));
  const s4 = await shown();
  R.check("SW4", "Incoming call delivered long after its expiry (10 min) → shows 'Missed call from …' instead of a fake ring", s4.length === 1 && s4[0].title === "Missed call from Lan" && s4[0].ri === false, JSON.stringify(s4));

  // The phone's clock runs ~90 s ahead of the server: exp (server time + 60 s) is already "past" on the device while the
  // call is still ringing → must still ring (the push service enforces the 60 s TTL; exp is only a safety net).
  await closeAll();
  await push(incoming("ccc4", { exp: Date.now() - 30_000 }));
  const s4b = await shown();
  R.check("SW4b", "Device clock ahead of the server (exp 30 s in the past on this device) → still an incoming, ringing notification (not 'Missed call')",
    s4b.length === 1 && s4b[0].title === "Incoming call" && s4b[0].ri === true, JSON.stringify(s4b));

  await closeAll();
  await push(incoming("ddd4"));
  await push(ended("ddd4", { title: "Call with Lan", body: "Answered.", quiet: true }));
  const s5 = await shown();
  R.check("SW5", "Answered on another device → the incoming notification is replaced QUIETLY (silent) by 'Call with Lan · Answered.'", s5.length === 1 && s5[0].body === "Answered." && s5[0].silent === true && s5[0].ri === false, JSON.stringify(s5));

  await closeAll();
  await push({ title: "Old app", body: "x", url: "/", tag: "pn-call" });
  await push(ended("eee5"));
  const s6 = await shown();
  R.check("SW6", "A notification with the OLD shared tag 'pn-call' (pushes sent before this release) is cleared by the next call's end", !s6.some((n) => n.tag === "pn-call") && s6.some((n) => n.tag === "pn-call-eee5"), JSON.stringify(s6));

  await closeAll();
  await push({ title: "Lan", body: "hi", url: "/messages?c=x", tag: "pn-chat-x" });
  const s7 = await shown();
  R.check("SW7", "Chat pushes unchanged (own tag, not pinned)", s7.length === 1 && s7[0].tag === "pn-chat-x" && s7[0].ri === false, JSON.stringify(s7));
} else {
  R.check("SW1", "service worker registration found over CDP", false, JSON.stringify(regs));
}
await browser.close();
const out = R.summary();
process.exit(out.failed ? 1 : 0);
