// Tiny UDP "network" for LOCAL call tests: every WebRTC path between the two browsers is forced through relay sockets
// owned by this process, so the test can cut the network (pause) and restore it, like a phone losing 4G for a few
// seconds. Used together with scripts/qa/lib/pusher_mock.mjs: its rewrite hook (pusherRewrite below) replaces every
// UDP host candidate in "call-signal" ICE batches with <same ip>:<relay port> and drops TCP / IPv6 / mDNS candidates,
// so neither browser ever learns the other's real address. Chromium must run with
// --disable-features=WebRtcHideLocalIpsWithMdns (real IPs instead of *.local names).
//
// Each relay socket is bound to one real candidate (target). Packets from the target go to the last peer that wrote
// to the relay; packets from anyone else go to the target (and that sender becomes the peer). Both browsers then only
// see relay addresses (as peer-reflexive candidates), and pause() drops everything.
import dgram from "node:dgram";

export async function startNetsim({ log = () => {} } = {}) {
  const relays = new Map(); // "ip:port" -> relay
  let pausedUntil = 0;
  let dropped = 0;
  let forwarded = 0;

  async function relayFor(ip, port) {
    const key = `${ip}:${port}`;
    if (relays.has(key)) return relays.get(key);
    const sock = dgram.createSocket("udp4");
    await new Promise((r) => sock.bind(0, "0.0.0.0", r));
    const r = { sock, port: sock.address().port, target: { ip, port }, peer: null };
    sock.on("message", (msg, rinfo) => {
      if (Date.now() < pausedUntil) {
        dropped++;
        return;
      }
      forwarded++;
      if (rinfo.address === ip && rinfo.port === port) {
        if (r.peer) sock.send(msg, r.peer.port, r.peer.address);
      } else {
        r.peer = { address: rinfo.address, port: rinfo.port };
        sock.send(msg, port, ip);
      }
    });
    sock.on("error", () => {});
    relays.set(key, r);
    log(`relay ${r.port} -> ${key}`);
    return r;
  }

  async function rewriteCandidate(c) {
    // candidate:<foundation> <component> <protocol> <priority> <ip> <port> typ <type> ...
    const f = String(c.candidate || "").split(" ");
    if (f.length < 8) return null;
    const proto = f[2].toLowerCase();
    const ip = f[4];
    const port = Number(f[5]);
    if (proto !== "udp") return null;
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null; // IPv6 / mDNS
    if (ip.startsWith("127.") || ip.startsWith("169.254.")) return null;
    const r = await relayFor(ip, port);
    f[5] = String(r.port);
    return { ...c, candidate: f.join(" ") };
  }

  /** Pusher mock rewrite hook: candidates of every "call-signal" ICE batch go through relays. */
  async function pusherRewrite(events) {
    const out = [];
    const groups = new Map();
    for (const e of events) {
      if (e.name !== "call-signal") {
        out.push(e);
        continue;
      }
      let d;
      try {
        d = JSON.parse(e.data);
      } catch {
        out.push(e);
        continue;
      }
      const k = `${e.channel}|${d.fromLeg}|${d.seq}`;
      if (!groups.has(k)) {
        groups.set(k, { e, head: d, parts: [] });
        out.push(k);
      }
      groups.get(k).parts[d.part] = d.d;
    }
    const res = [];
    for (const item of out) {
      if (typeof item !== "string") {
        res.push(item);
        continue;
      }
      const g = groups.get(item);
      const joined = g.parts.join("");
      let data;
      try {
        data = JSON.parse(joined);
      } catch {
        data = null;
      }
      if (g.head.kind === "ice" && Array.isArray(data)) {
        const list = [];
        for (const c of data) {
          const n = await rewriteCandidate(c);
          if (n) list.push(n);
        }
        data = list; // may be empty: still delivered so the receiver's sequence keeps moving
      } else if (g.head.kind === "sdp" && data && typeof data.sdp === "string") {
        data = { ...data, sdp: data.sdp.split("\r\n").filter((l) => !l.startsWith("a=candidate:")).join("\r\n") };
      }
      res.push({ ...g.e, data: JSON.stringify({ ...g.head, part: 0, parts: 1, d: JSON.stringify(data) }) });
    }
    return res;
  }

  return {
    pusherRewrite,
    relayPorts: () => [...relays.values()].map((r) => r.port),
    /** Drop every packet for ms (both directions). */
    pause(ms) {
      pausedUntil = Date.now() + ms;
    },
    resume() {
      pausedUntil = 0;
    },
    stats: () => ({ relays: relays.size, dropped, forwarded }),
    close() {
      for (const r of relays.values()) {
        try {
          r.sock.close();
        } catch {}
      }
      relays.clear();
    },
  };
}
