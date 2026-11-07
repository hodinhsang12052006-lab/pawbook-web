// Pusher-compatible mock for LOCAL QA (no internet, no real Pusher account): enough of the Channels protocol for
// pusher-js 8 (WebSocket protocol 7) and the `pusher` Node SDK 5 (REST /events + /batch_events).
//   - WS  /app/:key            connection_established, subscribe (private-/presence- HMAC auth checked like Pusher),
//                              unsubscribe, ping/pong, presence member_added/removed
//   - POST /apps/:id/events      auth_signature + body_md5 checked; 10 KB data → 413; socket_id excluded
//   - POST /apps/:id/batch_events  ≤ 10 events, same checks
// Test hooks: log (every delivered/refused event), pauseDelivery(ms), setRewrite(fn), subscribers(channel).
//
// Library:   import { startPusherMock } from "./lib/pusher_mock.mjs"; const m = await startPusherMock({ port: 6001 });
// Standalone (e.g. for launch_test/push_test servers): node scripts/qa/lib/pusher_mock.mjs [port]
//   server env: PUSHER_ALLOW_TEST=1 PUSHER_TEST_HOST=127.0.0.1:<port> PUSHER_APP_ID=qa PUSHER_SECRET=qa-secret PUSHER_TEST_KEY=qa-key
import http from "node:http";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
// `ws` ships with the app's runtime deps (via @libsql/isomorphic-ws) — no new dependency.
const { WebSocketServer } = require("ws");

const hmac = (secret, s) => crypto.createHmac("sha256", secret).update(s).digest("hex");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

export async function startPusherMock({ port = 6001, host = "127.0.0.1", key = "qa-key", secret = "qa-secret", appId = "qa", quiet = true } = {}) {
  const sockets = new Map(); // socketId -> { ws, channels:Set, presence: Map<channel, member> }
  const log = [];
  let paused = 0;
  let pausedQueue = [];
  let rewrite = null;
  let counter = 0;

  const send = (ws, msg) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const deliverNow = (channel, name, data, exceptSocket) => {
    let n = 0;
    for (const [sid, s] of sockets) {
      if (sid === exceptSocket || !s.channels.has(channel)) continue;
      send(s.ws, { event: name, channel, data });
      n++;
    }
    return n;
  };
  const deliver = (channel, name, data, exceptSocket) => {
    if (Date.now() < paused) {
      pausedQueue.push([channel, name, data, exceptSocket]);
      return;
    }
    deliverNow(channel, name, data, exceptSocket);
  };
  const flushPaused = () => {
    const q = pausedQueue;
    pausedQueue = [];
    for (const e of q) deliverNow(...e);
  };

  const presenceMembers = (channel) => {
    const out = new Map();
    for (const s of sockets.values()) {
      const m = s.presence.get(channel);
      if (m) out.set(String(m.user_id), m.user_info || {});
    }
    return out;
  };

  function handleSubscribe(sid, s, data) {
    const channel = data?.channel;
    if (typeof channel !== "string") return;
    if (channel.startsWith("private-") || channel.startsWith("presence-")) {
      const auth = String(data.auth || "");
      const [k, sig] = auth.split(":");
      const toSign = channel.startsWith("presence-") ? `${sid}:${channel}:${data.channel_data || ""}` : `${sid}:${channel}`;
      if (k !== key || !sig || sig !== hmac(secret, toSign)) {
        log.push({ t: Date.now(), refused: "subscribe", channel });
        send(s.ws, { event: "pusher:subscription_error", channel, data: { type: "AuthError", error: "invalid signature", status: 401 } });
        return;
      }
    }
    s.channels.add(channel);
    if (channel.startsWith("presence-")) {
      let member = {};
      try {
        member = JSON.parse(data.channel_data || "{}");
      } catch {}
      const before = presenceMembers(channel);
      s.presence.set(channel, member);
      const all = presenceMembers(channel);
      const hash = Object.fromEntries(all);
      send(s.ws, { event: "pusher_internal:subscription_succeeded", channel, data: JSON.stringify({ presence: { ids: [...all.keys()], hash, count: all.size } }) });
      if (!before.has(String(member.user_id))) deliverNow(channel, "pusher_internal:member_added", JSON.stringify(member), sid);
    } else {
      send(s.ws, { event: "pusher_internal:subscription_succeeded", channel, data: "{}" });
    }
  }

  function unsubscribe(sid, s, channel) {
    s.channels.delete(channel);
    const m = s.presence.get(channel);
    if (m) {
      s.presence.delete(channel);
      if (!presenceMembers(channel).has(String(m.user_id))) deliverNow(channel, "pusher_internal:member_removed", JSON.stringify({ user_id: m.user_id }), sid);
    }
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const m = /^\/apps\/([^/]+)\/(events|batch_events)$/.exec(url.pathname);
      if (req.method !== "POST" || !m) return void res.writeHead(404).end("{}");
      if (m[1] !== String(appId)) return void res.writeHead(404).end('{"error":"app"}');
      const params = Object.fromEntries(url.searchParams);
      const sig = params.auth_signature;
      delete params.auth_signature;
      const qs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
      if (params.auth_key !== key || sig !== hmac(secret, `POST\n${url.pathname}\n${qs}`) || params.body_md5 !== md5(body)) {
        log.push({ t: Date.now(), refused: "signature" });
        return void res.writeHead(401).end('{"error":"auth"}');
      }
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return void res.writeHead(400).end('{"error":"json"}');
      }
      const events = m[2] === "batch_events" ? parsed.batch : (parsed.channels || []).map((channel) => ({ channel, name: parsed.name, data: parsed.data, socket_id: parsed.socket_id }));
      if (!Array.isArray(events) || !events.length) return void res.writeHead(400).end('{"error":"empty"}');
      if (m[2] === "batch_events" && events.length > 10) {
        log.push({ t: Date.now(), refused: "batch>10", n: events.length });
        return void res.writeHead(400).end('{"error":"Batch too large"}');
      }
      for (const e of events) {
        if (Buffer.byteLength(String(e.data), "utf8") > 10240) {
          log.push({ t: Date.now(), refused: "413", name: e.name, bytes: Buffer.byteLength(String(e.data)) });
          return void res.writeHead(413).end('{"error":"Payload too large"}');
        }
      }
      let out = events.map((e) => ({ channel: e.channel, name: e.name, data: e.data, socket_id: e.socket_id }));
      if (rewrite) {
        try {
          out = (await rewrite(out)) || out;
        } catch (err) {
          console.error("pusher mock rewrite failed:", err);
        }
      }
      for (const e of out) {
        log.push({ t: Date.now(), channel: e.channel, name: e.name, bytes: Buffer.byteLength(String(e.data)), data: e.data });
        deliver(e.channel, e.name, e.data, e.socket_id);
      }
      res.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname !== `/app/${key}`) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const sid = `${1000 + ++counter}.${Math.floor(Math.random() * 1e9)}`;
      const s = { ws, channels: new Set(), presence: new Map() };
      sockets.set(sid, s);
      send(ws, { event: "pusher:connection_established", data: JSON.stringify({ socket_id: sid, activity_timeout: 30 }) });
      ws.on("message", (buf) => {
        let msg;
        try {
          msg = JSON.parse(String(buf));
        } catch {
          return;
        }
        if (msg.event === "pusher:ping") send(ws, { event: "pusher:pong", data: {} });
        else if (msg.event === "pusher:subscribe") handleSubscribe(sid, s, msg.data);
        else if (msg.event === "pusher:unsubscribe") unsubscribe(sid, s, msg.data?.channel);
      });
      ws.on("close", () => {
        for (const ch of [...s.channels]) unsubscribe(sid, s, ch);
        sockets.delete(sid);
      });
    });
  });

  await new Promise((r) => server.listen(port, host, r));
  if (!quiet) console.log(`pusher mock on ${host}:${port} (key=${key})`);

  return {
    port,
    log,
    /** Hold every REST-triggered event for ms, then deliver them in order (simulates a stalled realtime link). */
    pauseDelivery(ms) {
      paused = Date.now() + ms;
      setTimeout(flushPaused, ms + 5);
    },
    /** fn(events[]) → events[] (or a promise of them) — runs on every REST publish before delivery. */
    setRewrite(fn) {
      rewrite = fn;
    },
    subscribers(channel) {
      return [...sockets.values()].filter((s) => s.channels.has(channel)).length;
    },
    /** Push an event to a channel directly (no REST) — for injecting stale/forged signals in tests. */
    inject(channel, name, data) {
      deliverNow(channel, name, typeof data === "string" ? data : JSON.stringify(data));
    },
    async close() {
      for (const s of sockets.values()) s.ws.terminate();
      wss.close();
      await new Promise((r) => server.close(r));
    },
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  const port = Number(process.argv[2] || process.env.PUSHER_MOCK_PORT || 6001);
  await startPusherMock({ port, quiet: false });
}
