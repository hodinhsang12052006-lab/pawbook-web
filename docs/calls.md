# Voice & video calls (built-in WebRTC)

PawNail's 1:1 calls use the browser's own WebRTC — no call SDK, no per-minute fees. ZEGOCLOUD was removed in 11/2026.

## How a call works

1. **Dial** (`components/chat/CallManager.tsx`): the caller's microphone (and camera) is opened inside the tap. While
   the browser's prompt is open the screen says *Allow microphone access to call*. If access is blocked, a dialog
   explains how to allow it and nobody is rung. A video call whose camera alone is missing / busy / blocked offers
   *Continue as voice call*.
2. **Ring**: `POST /api/calls {action:"offer"}` → Pusher `incoming-call` on the callee's private channel + a push
   notification (Android channel `calls`). The server mints a **call token** (HMAC, 3 h) that binds caller, callee and
   call id; every later action must carry it. The caller re-rings every 6 s for up to ~45 s (no push), so a phone that
   opens PawNail from the notification still rings (the server refuses re-rings 50 s after the offer).
3. **Answer**: the callee's device opens its microphone (and camera; *Answer with voice* keeps the camera off), then
   `accept` → `call-accepted` to the caller and `call-handled` to the callee's other devices (they stop ringing). If
   the first-time camera/mic prompt takes more than ~1 s, the callee sends `answering` so the caller's ring timeout
   waits for it. A camera-only block joins the call with audio.
4. **Connect**: SDP and ICE candidates travel as `call-signal` events through `POST /api/calls {action:"signal"}`
   (chunked under Pusher's 10 KB limit, ordered, deduplicated — `lib/calls/signalQueue.ts`). Media goes directly
   between the devices, or through TURN when configured (`lib/calls/peer.ts`). The call counts as connected only when
   ICE **and** DTLS are up (media can flow). The first offer is re-sent if nothing came back within 6 s (Pusher
   delivers at most once).
5. **In call**: mute, camera on/off (a voice call upgrades to video without renegotiation), flip camera, speaker
   choice (Chrome/Android), connection quality, *Reconnecting…* (shown after 1.2 s) with ICE restart, *Connection
   lost* dialog. The screen is kept awake (Wake Lock). The ICE/TURN list is refreshed every 10 min, so ICE restarts in
   long calls still have valid TURN credentials. Remote video fills the screen when its orientation matches the
   screen and is letterboxed otherwise (double-tap switches fill / fit).
6. **End**: `reject` (decline / cancel / hang-up / timeout / failed / media-error), a `bye` over the data channel
   (the connection stays open 250 ms so it is really sent), and a `sendBeacon` when the tab closes. If both get lost,
   the other side notices its data channel closing and ends too. The caller writes the call log line in the chat
   (*Voice call · m:ss* when it connected, *Missed* otherwise).

### Several devices on one account

Every tab / app instance has its own **leg** id. Signals are addressed to one leg; `reject` / `busy` carry the
sender's leg (`fromLeg`), so a caller already talking to the callee's phone ignores a decline from the callee's laptop
that rang late. A late second answer gets `reject {reason:"answered-elsewhere", toLeg}` (only that device stops). An
idle device remembers ended call ids from `call-handled` / `call-rejected`, so a re-ring still in flight cannot ring it.

## TURN — needed for many 4G/5G users

Without TURN, calls work over STUN on most home Wi-Fi. Phones behind symmetric / carrier-grade NAT (common on 4G/5G
and office networks) cannot reach each other directly and need a relay; until TURN is set, such calls show *Still
connecting… try Wi-Fi* after 10 s and end after 35 s with *This network can't connect directly*, and one anonymous
Sentry event `call_connect_failed` (candidate types and states only, no IPs or SDP) shows how often it happens. Set
**one** of these on Vercel (Production):

| Option | Variables | Notes |
| --- | --- | --- |
| Cloudflare Realtime TURN (recommended) | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | dash.cloudflare.com → Realtime → TURN Server → Create. 1,000 GB/month free (shared with Cloudflare SFU), then $0.05/GB. The API token stays on the server; signed-in browsers get 1-hour credentials from `GET /api/calls/ice` (30 requests/hour per user). |
| Own coturn | `TURN_URLS`, `TURN_SECRET` | coturn `use-auth-secret` + `static-auth-secret=<TURN_SECRET>`; per-user credentials valid 2 h. |
| Static TURN | `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Visible to every signed-in user — only for a dedicated relay. |

Optional: `CALL_STUN_URLS` (default Google public STUN), `CALL_SIGNING_SECRET` (default: derived from
`NEXTAUTH_SECRET`). Never set `PUSHER_ALLOW_TEST`, `CALL_RATE_ALLOW_TEST`, `CLOUDFLARE_TURN_ALLOW_TEST` or any other
`*_ALLOW_TEST` on Vercel (the code ignores them there anyway).

## Costs

About 9–12 Pusher events per voice call in tests (ring + re-rings, accept, a few SDP/ICE batches, hang-up). Pusher
counts every delivered copy: an event on the callee's channel counts once per open tab / app of the callee.
TURN traffic only when a direct path is impossible: roughly 0.5–1 MB/min for voice, 5–10 MB/min for 720p video.

## Limits

- The call token lives 3 h: a call longer than that can no longer signal (mute state, ICE restart, hang-up over
  Pusher); hanging up still ends it on both sides through the data channel.
- No native incoming-call screen (Android ConnectionService / iOS CallKit): a killed app shows the high-priority
  `calls` notification; opening it rings in the app within ~6 s (re-ring).
- Android app: no foreground service yet — when the app goes to the background Android may silence its microphone;
  the other person then sees *<name> left the app — they may not hear you*. The hardware Back button is ignored while
  ringing or in a call (end it with Decline / End).

## Android app

The camera/microphone prompt inside the app needs versionCode 3+ (Capacitor's `BridgeWebChromeClient`). Older installs
get *Microphone access is blocked* with a hint to update PawNail on Google Play. The chat-bubble WebView never rings.

## Tests (local only)

```
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/call_signal_unit.mts   # queue, negotiation, token, wire, error texts
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/call_ice_unit.mts      # STUN/TURN list, mock Cloudflare
# in a throwaway copy (no .env, .env.production.local pins TURSO_DATABASE_URL=""), built with
# NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1 NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:6001
bash scripts/qa/start-call-server.sh &        # refuses to run next to a .env or without the Turso pin
BASE_URL=http://localhost:3210 node scripts/qa/call_test.mjs
```

`call_test.mjs` starts its own Pusher mock (`scripts/qa/lib/pusher_mock.mjs`) and UDP network simulator
(`scripts/qa/lib/udp_netsim.mjs`) and checks real `getStats()` numbers (audio bytes, decoded video frames, ICE ufrag after
a simulated network drop). `CALL_ONLY=audio,video,flows,multi,slow,reconnect,perm,shots,timeout` runs a subset.
