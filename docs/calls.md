# Voice & video calls (built-in WebRTC)

PawNail's 1:1 calls use the browser's own WebRTC — no call SDK, no per-minute fees. ZEGOCLOUD was removed in 11/2026.

## How a call works

1. **Dial** (`components/chat/CallManager.tsx`): the caller's microphone (and camera) is opened inside the tap. If access
   is blocked, a dialog explains how to allow it and nobody is rung.
2. **Ring**: `POST /api/calls {action:"offer"}` → Pusher `incoming-call` on the callee's private channel + a push
   notification (Android channel `calls`). The server mints a **call token** (HMAC, 3 h) that binds caller, callee and
   call id; every later action must carry it. The caller re-rings every 6 s (no push), so a phone that opens PawNail
   from the notification still rings.
3. **Answer**: the callee's device opens its microphone, then `accept` → `call-accepted` to the caller and
   `call-handled` to the callee's other devices (they stop ringing).
4. **Connect**: SDP and ICE candidates travel as `call-signal` events through `POST /api/calls {action:"signal"}`
   (chunked under Pusher's 10 KB limit, ordered, deduplicated — `lib/calls/signalQueue.ts`). Media goes directly
   between the devices, or through TURN when configured (`lib/calls/peer.ts`).
5. **In call**: mute, camera on/off (a voice call upgrades to video without renegotiation), flip camera, speaker
   choice (Chrome/Android), connection quality, *Reconnecting…* with ICE restart, *Connection lost* dialog.
6. **End**: `reject` (decline / cancel / hang-up / timeout / failed), a `bye` over the data channel, and a
   `sendBeacon` when the tab closes. The caller writes the call log line in the chat.

## TURN — needed for many 4G/5G users

Without TURN, calls work over STUN on most home Wi-Fi. Phones behind symmetric / carrier-grade NAT (common on 4G/5G
and office networks) cannot reach each other directly and need a relay. Set **one** of these on Vercel (Production):

| Option | Variables | Notes |
| --- | --- | --- |
| Cloudflare Realtime TURN (recommended) | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | dash.cloudflare.com → Realtime → TURN Server → Create. 1,000 GB/month free (shared with Cloudflare SFU), then $0.05/GB. The API token stays on the server; browsers get 2-hour credentials from `GET /api/calls/ice`. |
| Own coturn | `TURN_URLS`, `TURN_SECRET` | coturn `use-auth-secret` + `static-auth-secret=<TURN_SECRET>`; per-user credentials valid 2 h. |
| Static TURN | `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Visible to every signed-in user — only for a dedicated relay. |

Optional: `CALL_STUN_URLS` (default Google public STUN), `CALL_SIGNING_SECRET` (default: derived from
`NEXTAUTH_SECRET`). Never set `PUSHER_ALLOW_TEST`, `CALL_RATE_ALLOW_TEST`, `CLOUDFLARE_TURN_ALLOW_TEST` or any other
`*_ALLOW_TEST` on Vercel (the code ignores them there anyway).

## Costs

About 15–25 Pusher messages per call (ring, accept, a few SDP/ICE batches, hang-up, plus the re-rings while it rings).
TURN traffic only when a direct path is impossible: roughly 0.5–1 MB/min for voice, 5–10 MB/min for 720p video.

## Android app

The camera/microphone prompt inside the app needs versionCode 3+ (Capacitor's `BridgeWebChromeClient`). Older installs
get *Microphone access is blocked* with a hint to update PawNail on Google Play. The chat-bubble WebView never rings.

## Tests (local only)

```
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/call_signal_unit.mts   # queue, negotiation, token
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/call_ice_unit.mts      # STUN/TURN list, mock Cloudflare
# build with NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1 NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:6001
bash scripts/qa/start-call-server.sh &        # local SQLite, Pusher mock settings, no STUN
BASE_URL=http://localhost:3210 node scripts/qa/call_test.mjs
```

`call_test.mjs` starts its own Pusher mock (`scripts/qa/lib/pusher_mock.mjs`) and UDP network simulator
(`scripts/qa/lib/udp_netsim.mjs`) and checks real `getStats()` numbers (audio bytes, decoded video frames, ICE ufrag after
a simulated network drop). `CALL_ONLY=audio,video,flows,reconnect,perm,shots,timeout` runs a subset.
