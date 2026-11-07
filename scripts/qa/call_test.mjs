// Kiểm thử cuộc gọi WebRTC tự dựng (không ZegoCloud) giữa nhiều trình duyệt Chromium thật, camera/micro giả lập,
// HOÀN TOÀN OFFLINE: Pusher giả (scripts/qa/lib/pusher_mock.mjs) chở tín hiệu, "mạng" UDP giả (lib/udp_netsim.mjs)
// để cắt mạng giữa cuộc gọi. Kiểm tra bằng số liệu thật của RTCPeerConnection (bytesReceived / framesDecoded), không
// chỉ giao diện: thoại + video, máy tính + Pixel 7, EN + VI, tắt tiếng, tắt/bật camera, gọi thoại → video, lật camera,
// kéo khung camera nhỏ, cúp máy từ mỗi bên, từ chối, huỷ, máy bận, hết giờ (nhỡ), nhiều máy cùng tài khoản (máy mở
// app muộn vẫn đổ chuông; nghe ở 1 máy → máy kia ngừng), tín hiệu của cuộc gọi cũ bị bỏ qua, rớt mạng → "Đang kết nối
// lại…" → ICE restart, quyền micro/camera bị từ chối (cả 2 phía), bong bóng chat không đổ chuông, ảnh chụp 360/412px.
// Thêm (vòng review): máy thứ 2 đổ chuông muộn / mất call-handled không được cúp cuộc gọi đang nói, chỉ camera bị chặn
// vẫn vào được bằng âm thanh, "đã kết nối" chỉ khi DTLS xong (tín hiệu chậm + CPU chậm), mất cả bye lẫn reject → bên kia
// vẫn tự kết thúc (kênh dữ liệu đóng), focus vào màn hình gọi, đồng hồ không phải vùng đọc liên tục, video ngang trên
// màn dọc không bị cắt (contain) + chạm đúp đổi fill/fit.
// Chạy với chính sách autoplay THẬT (cần chạm) để chứng minh mở khoá âm thanh khi bấm gọi / nghe hoạt động.
//
// Cần 1 server LOCAL build với Pusher giả (KHÔNG BAO GIỜ trỏ vào bitpawos.com; lib.mjs tự chặn):
//   build (biến public, nhúng lúc build):
//     NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1 NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:6001 npm run build
//   chạy (TURSO_* để trống — DB SQLite local):
//     PUSHER_ALLOW_TEST=1 PUSHER_TEST_HOST=127.0.0.1:6001 PUSHER_APP_ID=qa PUSHER_SECRET=qa-secret PUSHER_TEST_KEY=qa-key \
//     NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1 CALL_STUN_URLS= CALL_RATE_ALLOW_TEST=1 npx next start -p 3210
//   (xem scripts/qa/start-call-server.sh) rồi:  BASE_URL=http://localhost:3210 node scripts/qa/call_test.mjs
// Script tự bật Pusher giả ở cổng 6001 (PUSHER_MOCK_PORT). CALL_SHOTS_DIR=<thư mục> để đổi nơi lưu ảnh.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, Results, fakeIp } from "./lib.mjs";
import { startPusherMock } from "./lib/pusher_mock.mjs";
import { startNetsim } from "./lib/udp_netsim.mjs";

const R = new Results("Calls (WebRTC)");
const SHOTS = process.env.CALL_SHOTS_DIR || fileURLToPath(new URL("./reports/calls/", import.meta.url));
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.CALL_ONLY || "").split(",").filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mock = await startPusherMock({ port: Number(process.env.PUSHER_MOCK_PORT || 6001) });
const netsim = await startNetsim();

// Chính sách autoplay mặc định của Chrome (phải có thao tác người dùng) — KHÔNG dùng no-user-gesture-required.
const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    // 3 fake cameras; #1 is a Y16 "depth" camera WebRTC cannot encode, so it is hidden from the page (HIDE_DEPTH)
    // and "flip" cycles fake_device_0 → fake_device_2, like a phone's front → back camera.
    "--use-fake-device-for-media-stream=device-count=3",
    "--autoplay-policy=document-user-activation-required",
    "--disable-features=WebRtcHideLocalIpsWithMdns",
  ],
});

// Gom mọi RTCPeerConnection của trang (đọc getStats) mà không cần móc gì trong mã production.
const PC_HOOK = () => {
  const Orig = window.RTCPeerConnection;
  if (!Orig || window.__pcs) return;
  window.__pcs = [];
  window.RTCPeerConnection = new Proxy(Orig, {
    construct(t, a) {
      const pc = Reflect.construct(t, a);
      window.__pcs.push(pc);
      return pc;
    },
  });
};

const HIDE_DEPTH = () => {
  const md = navigator.mediaDevices;
  if (!md?.enumerateDevices) return;
  const orig = md.enumerateDevices.bind(md);
  md.enumerateDevices = async () => (await orig()).filter((d) => d.label !== "fake_device_1");
};

const allErrors = [];
async function userCtx(email, { device, viewport, ua, label } = {}) {
  const base = device ? { ...devices[device] } : { viewport: viewport || { width: 1280, height: 800 } };
  if (viewport) base.viewport = viewport;
  if (ua) base.userAgent = ua;
  const ctx = await browser.newContext({ ...base, locale: "en-US", permissions: ["camera", "microphone"] });
  await ctx.addInitScript(PC_HOOK);
  await ctx.addInitScript(HIDE_DEPTH);
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": ip } }));
  const h = { "cf-connecting-ip": ip };
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  if (!me?.id) throw new Error("login failed: " + email);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    allErrors.push(`${label || email}: ${e.message}`);
  });
  return { ctx, page, me, errors, label: label || email, h };
}

async function step(id, desc, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    R.check(id, desc, r !== false && !(r && r.fail), r === false ? "điều kiện không đạt" : r?.fail || "");
  } catch (e) {
    R.check(id, desc, false, e.message.split("\n")[0]);
  }
  if (process.env.CALL_VERBOSE) console.log(`   (${id} ${Date.now() - t0}ms)`);
}
async function until(fn, timeout = 10000, every = 250) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await fn().catch((e) => ({ __err: e.message }));
    if (last && !last.__err) return last;
    await sleep(every);
  }
  throw new Error("timeout: " + JSON.stringify(last)?.slice(0, 200));
}

const sel = (p) => `[data-call-phase="${p}"]`;
const phaseIs = (u, p, timeout = 20000) => u.page.locator(sel(p)).waitFor({ timeout });
const idle = (u, timeout = 12000) => u.page.locator("[data-call-phase]").waitFor({ state: "detached", timeout });
const ctl = (u, name) => u.page.locator(`[data-call-control="${name}"]`).first();
const prefix = (lang) => (lang === "vi" ? "/vi" : "");

async function openChat(u, partnerId, lang = "en") {
  await u.page.goto(BASE_URL + `${prefix(lang)}/messages?to=${partnerId}`);
  await u.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await until(async () => mock.subscribers(`private-chat-${u.me.id}`) >= 1, 15000);
  await sleep(700);
}
const dial = (u, type) => u.page.getByTitle(type === "audio" ? /Secure voice call|Cuộc gọi thoại bảo mật/ : /Live video call|Cuộc gọi video thời gian thực/).first().click();

async function shot(u, name) {
  await u.page.screenshot({ path: path.join(SHOTS, name + ".png") }).catch(() => {});
}

async function stats(u) {
  return u.page.evaluate(async () => {
    const pc = (window.__pcs || []).filter((p) => p.connectionState !== "closed" && p.signalingState !== "closed").at(-1);
    const a = document.querySelector("audio[data-call-audio]");
    const out = { has: !!pc, aIn: 0, aOut: 0, vIn: 0, vFrames: 0, ufrag: null, pairPort: null, pairType: null, micEnabled: null, videoSending: false, videoTrackId: null, state: pc?.connectionState, audioPlaying: !!a && !a.paused && !!a.srcObject && a.srcObject.getAudioTracks().length > 0 };
    if (!pc) return out;
    const s = await pc.getStats();
    let pairId;
    s.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
    });
    s.forEach((r) => {
      if (r.type === "inbound-rtp" && r.kind === "audio") out.aIn += r.bytesReceived || 0;
      if (r.type === "outbound-rtp" && r.kind === "audio") out.aOut += r.bytesSent || 0;
      if (r.type === "inbound-rtp" && r.kind === "video") {
        out.vIn += r.bytesReceived || 0;
        out.vFrames += r.framesDecoded || 0;
      }
      if (r.type === "candidate-pair" && r.id === pairId) {
        const rc = s.get(r.remoteCandidateId);
        out.pairPort = rc?.port ?? null;
        out.pairType = rc?.candidateType ?? null;
      }
    });
    out.ufrag = (pc.localDescription?.sdp.match(/a=ice-ufrag:(\S+)/) || [])[1] || null;
    for (const tx of pc.getTransceivers()) {
      const k = tx.receiver.track?.kind;
      if (k === "audio") out.micEnabled = tx.sender.track ? tx.sender.track.enabled : null;
      if (k === "video") {
        out.videoSending = !!tx.sender.track && tx.sender.track.readyState === "live";
        out.videoTrackId = tx.sender.track?.id || null;
      }
    }
    return out;
  });
}
/** bytes / frames keep growing over `ms` */
async function growing(u, key, ms = 1500) {
  const a = await stats(u);
  await sleep(ms);
  const b = await stats(u);
  return { ok: b[key] > a[key] && a[key] > 0, a: a[key], b: b[key] };
}

async function connect(caller, callee, type) {
  await dial(caller, type);
  await phaseIs(caller, "outgoing", 15000);
  await phaseIs(callee, "incoming", 20000);
  await ctl(callee, "answer").click();
  await phaseIs(caller, "connected", 30000);
  await phaseIs(callee, "connected", 30000);
}

/** Đưa mọi người về trạng thái rảnh (sau 1 bước lỗi giữa chừng). */
async function reset(...users) {
  for (const u of users) {
    if (!(await u.page.locator("[data-call-phase]").count().catch(() => 0))) continue;
    for (const n of ["end", "cancel", "decline"]) {
      const b = ctl(u, n);
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        break;
      }
    }
    const close = u.page.getByRole("button", { name: /^(Close|Đóng)$/ });
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    await idle(u, 6000).catch(async () => {
      await u.page.reload().catch(() => {});
    });
  }
  await sleep(800);
}

async function layoutOk(u) {
  return u.page.evaluate(() => {
    const vw = window.innerWidth;
    const overflow = document.documentElement.scrollWidth > vw + 1;
    const root = document.querySelector("[data-call-phase]");
    const small = [];
    for (const b of root ? root.querySelectorAll("button") : []) {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      if (!r.width || cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.width < 47.5 || r.height < 47.5) small.push(`${b.getAttribute("aria-label") || b.textContent?.trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.left < -1 || r.right > vw + 1) small.push(`offscreen:${b.getAttribute("aria-label")}`);
    }
    return { overflow, small };
  });
}

const failGum = (u, name, onlyVideo = false) =>
  u.page.evaluate(
    ([n, ov]) => {
      const md = navigator.mediaDevices;
      const real = md.getUserMedia.bind(md);
      md.getUserMedia = (c) => (ov && !c?.video ? real(c) : Promise.reject(new DOMException("test", n)));
    },
    [name, onlyVideo]
  );

// ============================== setup ==============================
const A = await userCtx("owner1.us@pawnailjobs.demo", { label: "A owner1 desktop" });
const B = await userCtx("tech1.us@pawnailjobs.demo", { device: "Pixel 7", label: "B tech1 Pixel7" });
const C = await userCtx("owner2.us@pawnailjobs.demo", { label: "C owner2 desktop" });
await B.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: A.me.id, content: "Call test" }, headers: B.h });
await C.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: "Busy test" }, headers: C.h });
await openChat(A, B.me.id);
await openChat(B, A.me.id);

const camCount = await B.page.evaluate(async () => (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput").length).catch(() => 0);
console.log(`   fake cameras: ${camCount}`);

const incomingFor = (u) => mock.log.filter((e) => e.name === "incoming-call" && e.channel === `private-chat-${u.me.id}`);
let firstCall = null; // {callId, callToken} of the first A→B call (for the stale-signal test)

// ============================== voice call ==============================
if (want("audio")) {
  const t0 = mock.log.length;
  await step("audio-1", "Voice: A dials → A 'Ringing', B rings (real name/photo), no Answer button for the caller; B's focus leaves the chat box for Answer", async () => {
    await B.page.locator("[data-chat-input]").first().focus();
    await dial(A, "audio");
    await phaseIs(A, "outgoing", 10000);
    await A.page.locator('[data-call-ringing="1"]').waitFor({ timeout: 10000 });
    await phaseIs(B, "incoming", 15000);
    await shot(A, "en_desktop_audio_outgoing");
    await shot(B, "en_412_audio_incoming");
    const callerAnswer = await ctl(A, "answer").count();
    const name = await B.page.locator("[data-call-phase] h2").innerText();
    const ev = incomingFor(B).at(-1);
    firstCall = ev ? JSON.parse(ev.data) : null;
    // the phone keyboard must close: focus is on Answer (inside the aria-modal call screen), not on the chat textarea
    const focus = await until(async () => {
      const f = await B.page.evaluate(() => ({ ctl: document.activeElement?.getAttribute("data-call-control") || document.activeElement?.tagName, modal: document.querySelector("[data-call-phase]")?.getAttribute("aria-modal") }));
      return f.ctl === "answer" ? f : null;
    }, 5000).catch(async () => B.page.evaluate(() => ({ ctl: document.activeElement?.getAttribute("data-call-control") || document.activeElement?.tagName })));
    const counter = await B.page.locator("[data-call-status] .tabular-nums").count();
    return callerAnswer === 0 && name.trim().length > 0 && !!firstCall?.callToken && focus.ctl === "answer" && focus.modal === "true" && counter === 0 ? true : { fail: JSON.stringify({ callerAnswer, focus, counter }) };
  });

  await step("audio-2", "Voice: B answers → both 'connected', ICE connected, remote audio bytes flowing BOTH ways (getStats)", async () => {
    await ctl(B, "answer").click();
    await phaseIs(A, "connected", 30000);
    await phaseIs(B, "connected", 30000);
    await A.page.locator('[data-call-net="connected"]').waitFor({ timeout: 15000 });
    const ga = await until(async () => {
      const g = await growing(A, "aIn");
      return g.ok ? g : null;
    }, 15000);
    const gb = await until(async () => {
      const g = await growing(B, "aIn");
      return g.ok ? g : null;
    }, 15000);
    console.log(`   audio bytes A ${ga.a}→${ga.b}, B ${gb.a}→${gb.b}`);
    return true;
  });

  await step("audio-3", "Voice: the remote <audio> plays (autoplay unlocked by the dial / answer tap, strict autoplay policy), no 'tap for sound'", async () => {
    const sa = await stats(A);
    const sb = await stats(B);
    const blocked = (await A.page.locator("[data-call-audio-blocked]").count()) + (await B.page.locator("[data-call-audio-blocked]").count());
    return sa.audioPlaying && sb.audioPlaying && blocked === 0 ? true : { fail: JSON.stringify({ a: sa.audioPlaying, b: sb.audioPlaying, blocked }) };
  });

  await step("audio-4", "Voice: call timer ticks (mm:ss) on both sides", async () => {
    const read = async (u) => (await u.page.locator("[data-call-status]").first().innerText()).trim();
    const a1 = await read(A);
    await sleep(2200);
    const a2 = await read(A);
    const b2 = await read(B);
    await shot(B, "en_412_audio_connected");
    await shot(A, "en_desktop_audio_connected");
    // screen readers: the ticking timer is NOT a live region; one status region says "Connected"
    const sr = await B.page.evaluate(() => {
      const root = document.querySelector("[data-call-phase]");
      return { timerRole: root?.querySelector("[data-call-status]")?.getAttribute("role") || null, live: [...(root?.querySelectorAll('[role="status"]') || [])].map((e) => e.textContent?.trim()) };
    });
    const srOk = sr.timerRole === null && sr.live.length === 1 && sr.live[0] === "Connected";
    return /^\d{2}:\d{2}$/.test(a2) && a1 !== a2 && /^\d{2}:\d{2}$/.test(b2) && srOk ? true : { fail: `${a1} → ${a2} / ${b2} ${JSON.stringify(sr)}` };
  });

  await step("audio-5", "Mute: A mutes → B shows 'Muted' (data-peer-muted=1) + A's sender track disabled; unmute → back", async () => {
    await ctl(A, "mic").click();
    await B.page.locator('[data-peer-muted="1"]').waitFor({ timeout: 5000 });
    const s1 = await stats(A);
    await ctl(A, "mic").click();
    await B.page.locator('[data-peer-muted="0"]').waitFor({ timeout: 5000 });
    const s2 = await stats(A);
    return s1.micEnabled === false && s2.micEnabled === true;
  });

  await step("audio-6", "Stale signals: a hang-up for an OLD callId (valid token of that old call, sent via the API) is ignored", async () => {
    // a second, real token for an older call: mint one by starting + cancelling a call C→B? No — reuse A→B: ring+cancel needs idle.
    // Forge-free path: send reject for a different callId with the CURRENT token → server 403; and the mock injects an old-callId event.
    const cur = firstCall;
    const r = await A.ctx.request.post(BASE_URL + "/api/calls", { data: { targetId: B.me.id, action: "reject", callId: "oldcall0001", callToken: cur.callToken, reason: "hangup" }, headers: A.h });
    mock.inject(`private-chat-${B.me.id}`, "call-rejected", { fromId: A.me.id, callId: "oldcall0001", reason: "hangup" });
    mock.inject(`private-chat-${B.me.id}`, "call-signal", { fromId: A.me.id, callId: "oldcall0001", fromLeg: "wstaleleg01", toLeg: "wxx", seq: 0, kind: "sdp", part: 0, parts: 1, d: JSON.stringify({ type: "offer", sdp: "v=0" }) });
    await sleep(2000);
    const still = (await B.page.locator(sel("connected")).count()) === 1 && (await A.page.locator(sel("connected")).count()) === 1;
    return r.status() === 403 && still ? true : { fail: `api=${r.status()} still=${still}` };
  });

  await step("audio-7", "Voice → video: B turns the camera on → A switches to video layout and DECODES B's frames (no renegotiation)", async () => {
    await ctl(B, "cam").click();
    await A.page.locator('[data-call-video="1"]').waitFor({ timeout: 6000 });
    await A.page.locator('[data-peer-cam="1"]').waitFor({ timeout: 12000 });
    const g = await until(async () => {
      const x = await growing(A, "vFrames");
      return x.ok ? x : null;
    }, 12000);
    await shot(A, "en_desktop_audio_upgraded_video");
    await ctl(B, "cam").click();
    await A.page.locator('[data-peer-cam="0"]').waitFor({ timeout: 6000 });
    console.log(`   upgrade frames ${g.a}→${g.b}`);
    return true;
  });

  await step("audio-8", "Navigating inside the app during a call keeps the call (and the audio keeps flowing)", async () => {
    await A.page.evaluate(() => {
      const r = window.next?.router;
      if (r?.push) r.push("/jobs");
      else window.history.pushState({}, "", "/jobs");
    });
    await sleep(2500);
    const g = await growing(A, "aIn");
    return (await A.page.locator(sel("connected")).count()) === 1 && g.ok;
  });

  await step("audio-9", "Callee hangs up → both sides close + caller's chat logs 'Voice call · m:ss'; Pusher messages per call reported", async () => {
    await ctl(B, "end").click();
    await idle(B, 10000);
    await idle(A, 10000);
    const card = await A.page.locator("[data-call-ended]").innerText({ timeout: 1500 }).catch(() => "");
    if (!/Call ended · \d+:\d{2}/.test(card)) throw new Error("no 'Call ended · m:ss' card on A: " + JSON.stringify(card));
    const evs = mock.log.slice(t0).filter((e) => e.name && !e.refused);
    console.log(`   Pusher events for this call: ${evs.length} (${[...new Set(evs.map((e) => e.name))].map((n) => `${n}×${evs.filter((e) => e.name === n).length}`).join(", ")})`);
    const sa = await stats(A);
    await A.page.goto(BASE_URL + `/messages?to=${B.me.id}`);
    await A.page.getByText(/Voice call · \d+:\d{2}/).last().waitFor({ timeout: 15000 });
    await shot(A, "en_desktop_call_log");
    return !sa.has; // the RTCPeerConnection was closed
  });
  await reset(A, B);
}

// ============================== video call ==============================
if (want("video")) {
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  await step("video-1", "Video: ring → answer → both decode video frames AND receive audio bytes", async () => {
    await dial(A, "video");
    await phaseIs(A, "outgoing", 10000);
    await phaseIs(B, "incoming", 15000);
    // labels match what the user sees: camera on → "Stop video"; the red button says "Cancel" (= its accessible name start)
    const camLabel = await ctl(A, "cam").getAttribute("aria-label");
    const cancelText = (await ctl(A, "cancel").locator("xpath=..").innerText()).trim();
    const cancelName = await ctl(A, "cancel").getAttribute("aria-label");
    if (camLabel !== "Stop video" || cancelText !== "Cancel" || !cancelName.startsWith(cancelText)) throw new Error(`labels: cam=${camLabel} cancel=${cancelText}/${cancelName}`);
    await shot(A, "en_desktop_video_outgoing");
    await shot(B, "en_412_video_incoming");
    await ctl(B, "answer").click();
    await phaseIs(A, "connected", 30000);
    await phaseIs(B, "connected", 30000);
    const fa = await until(async () => {
      const x = await growing(A, "vFrames");
      return x.ok ? x : null;
    }, 15000);
    const fb = await until(async () => {
      const x = await growing(B, "vFrames");
      return x.ok ? x : null;
    }, 15000);
    const aa = await growing(A, "aIn");
    const ab = await growing(B, "aIn");
    await B.page.locator('[data-peer-cam="1"]').waitFor({ timeout: 8000 });
    await sleep(500);
    await shot(B, "en_412_video_connected");
    await shot(A, "en_desktop_video_connected");
    console.log(`   frames A ${fa.a}→${fa.b}, B ${fb.a}→${fb.b}`);
    return aa.ok && ab.ok;
  });

  await step("video-1b", "Landscape video on a portrait phone is FIT (not cropped to a sliver), on a landscape screen it fills; double-tap switches fill / fit", async () => {
    const fitB = await B.page.locator("[data-remote-fit]").getAttribute("data-remote-fit");
    const fitA = await A.page.locator("[data-remote-fit]").getAttribute("data-remote-fit");
    const vp = B.page.viewportSize();
    await B.page.mouse.click(vp.width / 2, vp.height / 2);
    await sleep(90);
    await B.page.mouse.click(vp.width / 2, vp.height / 2);
    await sleep(300);
    const fitB2 = await B.page.locator("[data-remote-fit]").getAttribute("data-remote-fit");
    await shot(B, "en_412_video_fill_toggled");
    await B.page.mouse.click(vp.width / 2, vp.height / 2);
    await sleep(90);
    await B.page.mouse.click(vp.width / 2, vp.height / 2);
    await sleep(300);
    const fitB3 = await B.page.locator("[data-remote-fit]").getAttribute("data-remote-fit");
    return fitB === "contain" && fitA === "cover" && fitB2 === "cover" && fitB3 === "contain" ? true : { fail: JSON.stringify({ fitB, fitA, fitB2, fitB3 }) };
  });

  await step("video-2", "Camera off on A → B shows 'Camera off', A sends no video, B's decoded frames stall; camera on → frames resume", async () => {
    await ctl(A, "cam").click();
    await B.page.locator('[data-peer-cam="0"]').waitFor({ timeout: 6000 });
    const s = await stats(A);
    await sleep(800);
    const f1 = (await stats(B)).vFrames;
    await sleep(2000);
    const f2 = (await stats(B)).vFrames;
    await ctl(A, "cam").click();
    await B.page.locator('[data-peer-cam="1"]').waitFor({ timeout: 12000 });
    const g = await until(async () => {
      const x = await growing(B, "vFrames");
      return x.ok ? x : null;
    }, 12000);
    return !s.videoSending && f2 - f1 <= 2 && g.ok ? true : { fail: JSON.stringify({ sending: s.videoSending, stall: f2 - f1 }) };
  });

  await step("video-3", "Drag the local preview (Pixel 7) to another corner → snaps there", async () => {
    const p = B.page.locator("[data-local-preview]").first();
    const before = await p.getAttribute("data-local-preview");
    const box = await p.boundingBox();
    const vp = B.page.viewportSize();
    await B.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await B.page.mouse.down();
    await B.page.mouse.move(box.x + box.width / 2 - 60, box.y + 120, { steps: 4 });
    await B.page.mouse.move(40, vp.height - 260, { steps: 6 });
    await B.page.mouse.up();
    await sleep(400);
    const after = await p.getAttribute("data-local-preview");
    return before === "tr" && after === "bl" ? true : { fail: `${before} → ${after}` };
  });

  await step("video-4", "Flip camera on Pixel 7 → a NEW camera track is sent and A keeps decoding frames", async () => {
    const t1 = (await stats(B)).videoTrackId;
    await ctl(B, "flip").click();
    const t2 = await until(async () => {
      const id = (await stats(B)).videoTrackId;
      return id && id !== t1 ? id : null;
    }, 8000);
    const g = await until(async () => {
      const x = await growing(A, "vFrames");
      return x.ok ? x : null;
    }, 10000).catch(async (e) => {
      const dbg = await B.page.evaluate(() => {
        const pc = window.__pcs.at(-1);
        const tx = pc.getTransceivers().find((t) => t.receiver.track.kind === "video");
        const t = tx?.sender.track;
        return { st: t?.readyState, en: t?.enabled, muted: t?.muted, label: t?.label, dir: tx?.direction, cur: tx?.currentDirection, s: t?.getSettings() };
      });
      throw new Error(e.message + " B-sender " + JSON.stringify(dbg) + " A " + JSON.stringify(await stats(A)));
    });
    return !!t2 && g.ok;
  });

  await step("video-5", "Caller hangs up → both close + chat logs 'Video call · m:ss'", async () => {
    await ctl(A, "end").click();
    await idle(A, 10000);
    await idle(B, 10000);
    await A.page.goto(BASE_URL + `/messages?to=${B.me.id}`);
    await A.page.getByText(/Video call · \d+:\d{2}/).last().waitFor({ timeout: 15000 });
  });
  await reset(A, B);
}

// ============================== decline / cancel / busy / multi-device / bubble ==============================
if (want("flows")) {
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  await step("decline", "B declines → A told 'declined' + chat logs 'Voice call declined'", async () => {
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await ctl(B, "decline").click();
    await idle(A, 10000);
    await idle(B, 5000);
    await A.page.getByText(/declined the call/).first().waitFor({ timeout: 5000 });
    await A.page.getByText(/Voice call declined/).last().waitFor({ timeout: 15000 });
  });
  await reset(A, B);

  await step("cancel", "Caller cancels while ringing → B stops ringing ('Missed call' toast) + chat logs 'Missed voice call'", async () => {
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await A.page.locator('[data-call-ringing="1"]').waitFor({ timeout: 8000 });
    await ctl(A, "cancel").click();
    await idle(B, 10000);
    await B.page.getByText(/Missed call from/).first().waitFor({ timeout: 5000 });
    await A.page.getByText(/Missed voice call/).last().waitFor({ timeout: 15000 });
  });
  await reset(A, B);

  await step("busy", "C calls B while B is on a call with A → C told 'on another call', B never rings over the call", async () => {
    await connect(A, B, "audio");
    await openChat(C, B.me.id);
    await dial(C, "audio");
    await C.page.getByText(/are on another call/).first().waitFor({ timeout: 15000 });
    await idle(C, 10000);
    const bStill = (await B.page.locator(sel("connected")).count()) === 1;
    await ctl(A, "end").click();
    await idle(B, 10000);
    return bStill;
  });
  await reset(A, B, C);

  const B2 = await userCtx("tech1.us@pawnailjobs.demo", { viewport: { width: 1280, height: 800 }, label: "B2 tech1 desktop" });
  await step("multi-1", "Same account on 2 devices: the 2nd device opens PawNail AFTER ringing started (as from the push) → it still rings (re-ring)", async () => {
    await B2.page.goto(BASE_URL + "/jobs");
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await openChat(B2, A.me.id);
    await phaseIs(B2, "incoming", 12000);
  });
  await step("multi-2", "Answer on one device → the other stops ringing at once (call-handled), the call connects", async () => {
    await ctl(B, "answer").click();
    await idle(B2, 5000);
    await phaseIs(A, "connected", 30000);
    await phaseIs(B, "connected", 30000);
    await ctl(A, "end").click();
    await idle(B, 10000);
  });
  await reset(A, B, B2);
  await step("multi-3", "Decline on one device → the other stops ringing too", async () => {
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await phaseIs(B2, "incoming", 15000);
    await ctl(B2, "decline").click();
    await idle(B, 5000);
    await idle(A, 10000);
  });
  await reset(A, B, B2);
  await B2.ctx.close();

  const bubbleUa = devices["Pixel 7"].userAgent + " PawNailApp PawNailBubble";
  const BB = await userCtx("tech1.us@pawnailjobs.demo", { device: "Pixel 7", ua: bubbleUa, label: "B bubble" });
  await step("bubble", "Android chat-bubble WebView (UA PawNailBubble) never rings — only the main app does", async () => {
    await BB.page.goto(BASE_URL + `/messages?to=${A.me.id}`);
    await BB.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
    await sleep(1500);
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await sleep(2500);
    const rang = await BB.page.locator("[data-call-phase]").count();
    await ctl(A, "cancel").click();
    await idle(B, 10000);
    return rang === 0;
  });
  await BB.ctx.close();
  await reset(A, B);
}

// ============================== multi-device races (review) ==============================
const watchRing = (u) =>
  u.page.evaluate(() => {
    window.__rang = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-call-phase]")) window.__rang = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
const audioGrowsBoth = async () => {
  const ga = await until(async () => {
    const g = await growing(A, "aIn");
    return g.ok ? g : null;
  }, 10000);
  const gb = await until(async () => {
    const g = await growing(B, "aIn");
    return g.ok ? g : null;
  }, 10000);
  return ga.ok && gb.ok;
};
if (want("multi")) {
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  const B2 = await userCtx("tech1.us@pawnailjobs.demo", { viewport: { width: 1280, height: 800 }, label: "B2 tech1 desktop" });
  const chanB = `private-chat-${B.me.id}`;
  await step("multi-4", "Late re-ring: B2 opens PawNail while a re-ring is still in flight, B answers → B2 must NOT ring for the answered call", async () => {
    await B2.page.goto("about:blank");
    let held = 0;
    mock.setRewrite(async (evs) => {
      if (evs.some((e) => e.name === "incoming-call" && /"ring":true/.test(String(e.data)))) {
        held++;
        await sleep(5500);
      }
      return evs;
    });
    try {
      await dial(A, "audio");
      await phaseIs(B, "incoming", 15000);
      await B2.page.goto(BASE_URL + `/messages?to=${A.me.id}`);
      await B2.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
      await until(async () => mock.subscribers(chanB) >= 2 || null, 15000);
      await watchRing(B2);
      await until(async () => held > 0 || null, 12000); // a re-ring is being held back
      await ctl(B, "answer").click();
      await phaseIs(A, "connected", 30000);
      await sleep(8000); // the held re-ring is delivered meanwhile
      const rang = await B2.page.evaluate(() => window.__rang);
      const stillOk = (await A.page.locator(sel("connected")).count()) === 1 && (await B.page.locator(sel("connected")).count()) === 1;
      return !rang && stillOk ? true : { fail: JSON.stringify({ rang, stillOk, held }) };
    } finally {
      mock.setRewrite(null);
      await ctl(A, "end").click().catch(() => {});
      await idle(B, 10000).catch(() => {});
    }
  });
  await reset(A, B, B2);

  for (const how of ["decline", "answer"]) {
    await step(`multi-5-${how}`, `call-handled LOST: B answers, B2 keeps ringing and then ${how === "decline" ? "DECLINES" : "ANSWERS late"} → the A↔B call survives (audio still flowing both ways)${how === "answer" ? ", B2 is told 'Answered on another device'" : ""}`, async () => {
      await openChat(B2, A.me.id);
      await until(async () => mock.subscribers(chanB) >= 2 || null, 15000);
      mock.setRewrite((evs) => evs.filter((e) => e.name !== "call-handled"));
      try {
        await dial(A, "audio");
        await phaseIs(B, "incoming", 15000);
        await phaseIs(B2, "incoming", 15000);
        await ctl(B, "answer").click();
        await phaseIs(A, "connected", 30000);
        await phaseIs(B, "connected", 30000);
        await sleep(1000);
        const b2Ringing = (await B2.page.locator(sel("incoming")).count()) === 1;
        await ctl(B2, how).click();
        await idle(B2, 12000);
        if (how === "answer") await B2.page.getByText(/Answered on another device/).first().waitFor({ timeout: 5000 });
        await sleep(2500);
        const still = (await A.page.locator(sel("connected")).count()) === 1 && (await B.page.locator(sel("connected")).count()) === 1;
        const grows = still && (await audioGrowsBoth());
        return b2Ringing && still && grows ? true : { fail: JSON.stringify({ b2Ringing, still, grows }) };
      } finally {
        mock.setRewrite(null);
        await ctl(A, "end").click().catch(() => {});
        await idle(B, 10000).catch(() => {});
      }
    });
    await reset(A, B, B2);
  }
  await B2.ctx.close();

  await step("remote-close", "Hang-up whose reject is LOST (tab closed, beacon dropped): the other side still ends within seconds (its data channel closed) and logs the call", async () => {
    await connect(A, B, "audio");
    await sleep(1500);
    mock.setRewrite((evs) => evs.filter((e) => e.name !== "call-rejected"));
    try {
      const t1 = Date.now();
      await B.page.close();
      await idle(A, 8000);
      const ms = Date.now() - t1;
      console.log(`   A ended ${ms} ms after B's tab closed (no reject delivered)`);
      return ms < 8000;
    } finally {
      mock.setRewrite(null);
      const page = await B.ctx.newPage();
      page.on("pageerror", (e) => {
        B.errors.push(e.message);
        allErrors.push(`${B.label}: ${e.message}`);
      });
      B.page = page;
    }
  });
  await openChat(B, A.me.id);
  await reset(A, B);
}

// ============================== slow signaling + slow phone (review) ==============================
if (want("slow")) {
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  const snap = () => {
    window.__netSnap = null;
    new MutationObserver(() => {
      const el = document.querySelector('[data-call-net="connected"]');
      if (el && !window.__netSnap) {
        const pc = (window.__pcs || []).at(-1);
        window.__netSnap = { cs: pc?.connectionState, ice: pc?.iceConnectionState, at: Date.now() };
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-call-net"] });
  };
  await step("slow-1", "Slow phone (2 s HTTP latency + 4× CPU + 1.6 s camera prompt): callee sends 'answering'; 'connected' only once ICE AND DTLS are up, and audio bytes arrive right after", async () => {
    const cdp = await B.ctx.newCDPSession(B.page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 2000, downloadThroughput: -1, uploadThroughput: -1 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await B.page.evaluate(() => {
      const md = navigator.mediaDevices;
      const real = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => {
        await new Promise((r) => setTimeout(r, 1600));
        return real(c);
      };
    });
    await A.page.evaluate(snap);
    await B.page.evaluate(snap);
    const n0 = mock.log.length;
    try {
      await dial(A, "audio");
      await phaseIs(B, "incoming", 25000);
      await ctl(B, "answer").click();
      await phaseIs(A, "connected", 45000);
      await phaseIs(B, "connected", 45000);
      const sa = await A.page.evaluate(() => window.__netSnap);
      const sb = await B.page.evaluate(() => window.__netSnap);
      const ga = await until(async () => {
        const g = await growing(A, "aIn", 800);
        return g.ok ? g : null;
      }, 4000);
      const answering = mock.log.slice(n0).some((e) => e.name === "call-answering");
      console.log(`   snapshots A ${JSON.stringify(sa)} B ${JSON.stringify(sb)}; answering=${answering}`);
      return sa?.cs === "connected" && sb?.cs === "connected" && ga.ok && answering ? true : { fail: JSON.stringify({ sa, sb, answering }) };
    } finally {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
      await cdp.detach().catch(() => {});
      await ctl(A, "end").click().catch(() => {});
      await idle(B, 15000).catch(() => {});
    }
  });
  await B.page.reload();
  await B.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await reset(A, B);
}

// ============================== reconnect after a network drop ==============================
if (want("reconnect")) {
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  mock.setRewrite(netsim.pusherRewrite);
  const callLogs = [];
  for (const u of [A, B]) {
    await u.page.evaluate(() => (window.__pnCallDebug = true));
    u.page.on("console", (m) => /\[call\]/.test(m.text()) && callLogs.push(`${u.label[0]}: ${m.text()}`));
  }
  await step("reconnect-1", "All media forced through the UDP netsim relays (no direct path): call connects via relay ports", async () => {
    await connect(A, B, "audio");
    const s = await until(async () => {
      const x = await stats(A);
      return x.pairPort && netsim.relayPorts().includes(x.pairPort) ? x : null;
    }, 10000);
    const g = await until(async () => {
      const x = await growing(B, "aIn");
      return x.ok ? x : null;
    }, 10000);
    console.log(`   via relay port ${s.pairPort} (${s.pairType}); relays=${netsim.stats().relays}`);
    return g.ok;
  });
  await step("reconnect-2", "Network drop (12 s): 'Reconnecting…' shows → ICE restart (new ufrag) → back to connected, audio flows again", async () => {
    const before = (await stats(A)).ufrag;
    // ~5 s until Chrome reports 'disconnected', then the caller restarts ICE 2 s later — a 12 s drop (a 4G handover /
    // lift ride) makes the restart happen while the network is still down, like in real life.
    netsim.pause(12000);
    const trace = [];
    await until(async () => {
      const st = await Promise.all([A, B].map((u) => u.page.evaluate(() => { const pc = window.__pcs.at(-1); return `${pc.iceConnectionState}/${pc.connectionState}/${document.querySelector("[data-call-net]")?.getAttribute("data-call-net")}`; })));
      trace.push(st.join(" | "));
      return st.some((x) => x.endsWith("/reconnecting")) || null;
    }, 14000, 300).catch((e) => {
      throw new Error(e.message + " " + JSON.stringify(netsim.stats()) + " trace " + trace.filter((x, i) => i % 3 === 0).join(" ; "));
    });
    await shot(B, "en_412_reconnecting");
    await A.page.locator('[data-call-net="connected"]').waitFor({ timeout: 30000 });
    await B.page.locator('[data-call-net="connected"]').waitFor({ timeout: 30000 });
    const after = await until(async () => {
      const u = (await stats(A)).ufrag;
      return u && u !== before ? u : null;
    }, 15000).catch(async (e) => {
      const st = await Promise.all([A, B].map((u) => u.page.evaluate(() => { const pc = window.__pcs.at(-1); return `${pc.iceConnectionState}/${pc.connectionState}/${pc.signalingState} ufrag=${(pc.localDescription?.sdp.match(/a=ice-ufrag:(\S+)/) || [])[1]} remote=${(pc.remoteDescription?.sdp.match(/a=ice-ufrag:(\S+)/) || [])[1]}`; })));
      throw new Error(e.message + ` before=${before} ` + st.join(" | ") + " trace " + trace.filter((x, i) => i % 2 === 0).join(" ; ") + " logs " + callLogs.slice(-12).join(" ; "));
    });
    const g = await until(async () => {
      const x = await growing(B, "aIn");
      return x.ok ? x : null;
    }, 15000);
    console.log(`   ufrag ${before} → ${after}; netsim ${JSON.stringify(netsim.stats())}`);
    return g.ok && (await A.page.locator(sel("connected")).count()) === 1;
  });
  mock.setRewrite(null);
  await reset(A, B);
}

// ============================== permissions ==============================
if (want("perm")) {
  for (const lang of ["en", "vi"]) {
    await openChat(A, B.me.id, lang);
    await openChat(B, A.me.id, lang);
    await step(`perm-denied-${lang}`, `Caller's microphone blocked (NotAllowedError, ${lang.toUpperCase()}) → clear dialog + how-to hint, and B is NEVER rung`, async () => {
      const n0 = incomingFor(A).length;
      await failGum(B, "NotAllowedError");
      await dial(B, "audio");
      const dlg = B.page.locator('[data-call-error="media"]');
      await dlg.waitFor({ timeout: 8000 });
      const text = await dlg.innerText();
      await sleep(200);
      const focusIn = await B.page.evaluate(() => !!document.activeElement?.closest('[data-call-error="media"]') && document.querySelector('[data-call-error="media"]')?.getAttribute("aria-describedby") === "pn-call-err-hint");
      if (!focusIn) throw new Error("error dialog did not take focus / no aria-describedby");
      await shot(B, `${lang}_412_error_denied`);
      await B.page.setViewportSize({ width: 360, height: 740 });
      await sleep(300);
      await shot(B, `${lang}_360_error_denied`);
      const lay = await layoutOk(B);
      await B.page.setViewportSize(devices["Pixel 7"].viewport);
      await sleep(2500);
      const rang = incomingFor(A).length - n0 + (await A.page.locator("[data-call-phase]").count());
      await B.page.getByRole("button", { name: /^(Close|Đóng)$/ }).click();
      await idle(B, 5000);
      const okText = lang === "en" ? /Microphone access is blocked/.test(text) && /Permissions|lock icon/.test(text) : /Micro đang bị chặn/.test(text) && /Quyền|ổ khoá/.test(text);
      return okText && rang === 0 && !lay.overflow && !lay.small.length ? true : { fail: JSON.stringify({ text: text.slice(0, 120), rang, lay }) };
    });
    await B.page.reload();
    await B.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
    await sleep(1200);
  }
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  for (const [name, re] of [
    ["NotFoundError", /No microphone found/],
    ["NotReadableError", /Microphone is busy/],
  ]) {
    await step(`perm-${name}`, `Caller ${name} → '${re.source}' dialog (never a silent failure)`, async () => {
      await failGum(A, name);
      await dial(A, "audio");
      const dlg = A.page.locator('[data-call-error="media"]');
      await dlg.waitFor({ timeout: 8000 });
      const t = await dlg.innerText();
      await A.page.getByRole("button", { name: /^(Close|Đóng)$/ }).click();
      await idle(A, 5000);
      return re.test(t) ? true : { fail: t.slice(0, 120) };
    });
    await A.page.reload();
    await A.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
    await sleep(1200);
  }
  await step("perm-camera-only", "Video call with no usable camera (mic OK) → 'Continue as voice call' → B rings with a VOICE call", async () => {
    await failGum(A, "NotFoundError", true);
    await dial(A, "video");
    await A.page.locator('[data-call-error="media"]').waitFor({ timeout: 8000 });
    await A.page.getByRole("button", { name: /Continue as voice call/ }).click();
    await phaseIs(B, "incoming", 15000);
    const type = await B.page.locator("[data-call-phase]").getAttribute("data-call-type");
    await ctl(A, "cancel").click();
    await idle(B, 10000);
    return type === "audio";
  });
  await A.page.reload();
  await A.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await sleep(1200);
  await step("perm-camera-denied", "Video call with ONLY the camera blocked (NotAllowedError, mic allowed) → 'Camera access is blocked' + 'Continue as voice call' → B rings with a voice call", async () => {
    await failGum(A, "NotAllowedError", true);
    await dial(A, "video");
    const dlg = A.page.locator('[data-call-error="media"]');
    await dlg.waitFor({ timeout: 8000 });
    const t = await dlg.innerText();
    await A.page.getByRole("button", { name: /Continue as voice call/ }).click();
    await phaseIs(B, "incoming", 15000);
    const type = await B.page.locator("[data-call-phase]").getAttribute("data-call-type");
    await ctl(A, "cancel").click();
    await idle(B, 10000);
    return /Camera access is blocked/.test(t) && type === "audio" ? true : { fail: JSON.stringify({ t: t.slice(0, 160), type }) };
  });
  await A.page.reload();
  await A.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await sleep(1200);
  await step("perm-callee-camera", "Callee allowed the mic but blocked ONLY the camera → answering a VIDEO call joins with audio (both connected, audio both ways), A sees 'Camera off'", async () => {
    await failGum(B, "NotAllowedError", true);
    await dial(A, "video");
    await phaseIs(B, "incoming", 15000);
    await ctl(B, "answer").click();
    await phaseIs(A, "connected", 30000);
    await phaseIs(B, "connected", 30000);
    await B.page.getByText(/Camera blocked/).first().waitFor({ timeout: 5000 });
    await A.page.locator('[data-peer-cam="0"]').waitFor({ timeout: 8000 });
    const grows = await audioGrowsBoth();
    await ctl(A, "end").click();
    await idle(B, 10000);
    return grows;
  });
  await B.page.reload();
  await B.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await sleep(1200);
  await step("perm-callee", "Callee's microphone blocked after tapping Answer → B sees the dialog, A is told 'couldn't join' + 'Missed voice call' log", async () => {
    await failGum(B, "NotAllowedError");
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await ctl(B, "answer").click();
    await B.page.locator('[data-call-error="media"]').waitFor({ timeout: 8000 });
    await A.page.getByText(/couldn't join/).first().waitFor({ timeout: 8000 });
    await idle(A, 8000);
    await B.page.getByRole("button", { name: /^(Close|Đóng)$/ }).click();
    await idle(B, 5000);
    await A.page.getByText(/Missed voice call/).last().waitFor({ timeout: 15000 });
  });
  await B.page.reload();
  await B.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await reset(A, B);
}

// ============================== screenshots EN/VI × 360/412 ==============================
if (want("shots")) {
  for (const lang of ["en", "vi"]) {
    for (const width of [412, 360]) {
      const vp = width === 412 ? devices["Pixel 7"].viewport : { width: 360, height: 740 };
      await B.page.setViewportSize(vp);
      await openChat(A, B.me.id, lang);
      await openChat(B, A.me.id, lang);
      const tag = `${lang}_${width}`;
      await step(`shots-${tag}`, `Layout ${lang.toUpperCase()} ${width}px: outgoing / incoming / voice / video screens fit (no horizontal scroll, tap targets ≥ 48px)`, async () => {
        const bad = [];
        const check = async (n) => {
          await sleep(600);
          await shot(B, `${tag}_${n}`);
          const l = await layoutOk(B);
          if (l.overflow || l.small.length) bad.push(`${n}: ${JSON.stringify(l)}`);
        };
        await dial(B, "audio");
        await phaseIs(B, "outgoing", 10000);
        await B.page.locator('[data-call-ringing="1"]').waitFor({ timeout: 10000 });
        await check("outgoing");
        await ctl(B, "cancel").click();
        await idle(B);
        await idle(A);
        await sleep(800);
        await dial(A, "audio");
        await phaseIs(B, "incoming", 15000);
        await check("incoming");
        await ctl(B, "answer").click();
        await phaseIs(B, "connected", 30000);
        await B.page.locator('[data-call-net="connected"]').waitFor({ timeout: 15000 });
        await check("audio_connected");
        await ctl(B, "end").click();
        await idle(B);
        await idle(A);
        await sleep(800);
        await connect(A, B, "video");
        await B.page.locator('[data-peer-cam="1"]').waitFor({ timeout: 12000 });
        await check("video_connected");
        await ctl(A, "end").click();
        await idle(B);
        return bad.length ? { fail: bad.join(" | ") } : true;
      });
      await reset(A, B);
    }
  }
  await B.page.setViewportSize(devices["Pixel 7"].viewport);
}

// ============================== timeout ==============================
if (want("timeout") && !process.env.CALL_SKIP_TIMEOUT) {
  await openChat(A, B.me.id);
  await openChat(B, A.me.id);
  await step("timeout", "Nobody answers for 45 s → A told 'didn't answer', B stops ringing, chat logs 'Missed voice call'", async () => {
    await dial(A, "audio");
    await phaseIs(B, "incoming", 15000);
    await A.page.getByText(/didn't answer/).first().waitFor({ timeout: 52000 });
    await idle(A, 5000);
    await idle(B, 8000);
    await A.page.getByText(/Missed voice call/).last().waitFor({ timeout: 15000 });
  });
  await reset(A, B);
}

const errs = allErrors.filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|AbortError|Load failed|ChunkLoadError/.test(e));
R.check("ERR", "No JS errors on any page during all calls", errs.length === 0, errs.join(" | "));
console.log(`   Pusher mock: ${mock.log.length} events, refused: ${JSON.stringify(mock.log.filter((e) => e.refused).slice(0, 5))}`);
await browser.close();
netsim.close();
await mock.close();
const out = R.summary();
fs.mkdirSync(new URL("./reports/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./reports/calls.json", import.meta.url), JSON.stringify(out, null, 2));
process.exit(out.failed ? 1 : 0);
