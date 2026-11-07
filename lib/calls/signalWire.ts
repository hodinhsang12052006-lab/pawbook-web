// Pure (no SDK, no DOM, no Node-only API): the wire format of call signaling, shared by the server route
// (app/api/calls/route.ts), the browser (lib/calls/signalQueue.ts) and the unit tests.
//
// Every WebRTC message (SDP offer/answer, a batch of ICE candidates, a small control message) is POSTed to
// /api/calls {action:"signal", kind, data, seq, fromLeg, toLeg} and relayed by the server as Pusher event
// "call-signal" on the other person's private channel. Pusher rejects events over 10 KB and batches over 10 events,
// so the server serialises `data` once and splits it into parts small enough to stay under the limit even after
// Pusher JSON-encodes the payload again (worst case every char doubles).
export type SignalKind = "sdp" | "ice" | "ctl";

export interface WireIce {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}
export interface WireSdp {
  type: "offer" | "answer" | "rollback";
  sdp: string;
}
export interface WireCtl {
  mic?: boolean;
  cam?: boolean | "paused";
  facing?: "user" | "environment";
  bye?: string;
  video?: boolean;
  /** the Android app went to the background (its microphone may be silenced by the OS) */
  away?: boolean;
}

/** One Pusher "call-signal" event. `d` is a slice of JSON.stringify(data); parts are joined in order, then parsed. */
export interface SignalEvent {
  fromId: string;
  callId: string;
  fromLeg: string;
  toLeg: string;
  seq: number;
  kind: SignalKind;
  part: number;
  parts: number;
  d: string;
}

export const LEG_RE = /^[a-z0-9-]{4,24}$/i;
export const MAX_SDP_CHARS = 24 * 1024;
export const MAX_ICE_PER_BATCH = 30;
export const MAX_CANDIDATE_CHARS = 512;
export const MAX_CTL_CHARS = 512;
export const PART_CHARS = 4000;
export const MAX_PARTS = 10;
export const MAX_SEQ = 1_000_000;
const CTL_KEYS = new Set(["mic", "cam", "facing", "bye", "video", "away"]);

export type ValidateResult = { ok: true; data: WireSdp | WireIce[] | WireCtl } | { ok: false; status: 400 | 413; reason: string };

export function validateSignalData(kind: unknown, data: unknown): ValidateResult {
  if (kind === "sdp") {
    const o = data as { type?: unknown; sdp?: unknown } | null;
    if (!o || typeof o !== "object" || (o.type !== "offer" && o.type !== "answer" && o.type !== "rollback")) return { ok: false, status: 400, reason: "sdp.type" };
    const sdp = typeof o.sdp === "string" ? o.sdp : o.type === "rollback" ? "" : null;
    if (sdp === null) return { ok: false, status: 400, reason: "sdp.sdp" };
    if (sdp.length > MAX_SDP_CHARS) return { ok: false, status: 413, reason: "sdp too large" };
    return { ok: true, data: { type: o.type, sdp } };
  }
  if (kind === "ice") {
    if (!Array.isArray(data) || data.length === 0) return { ok: false, status: 400, reason: "ice not array" };
    if (data.length > MAX_ICE_PER_BATCH) return { ok: false, status: 413, reason: "too many candidates" };
    const out: WireIce[] = [];
    for (const c of data) {
      const o = c as Partial<WireIce> | null;
      if (!o || typeof o !== "object" || typeof o.candidate !== "string" || o.candidate.length > MAX_CANDIDATE_CHARS) return { ok: false, status: 400, reason: "candidate" };
      if (o.sdpMid != null && (typeof o.sdpMid !== "string" || o.sdpMid.length > 16)) return { ok: false, status: 400, reason: "sdpMid" };
      if (o.sdpMLineIndex != null && (!Number.isInteger(o.sdpMLineIndex) || o.sdpMLineIndex < 0 || o.sdpMLineIndex > 15)) return { ok: false, status: 400, reason: "sdpMLineIndex" };
      if (o.usernameFragment != null && (typeof o.usernameFragment !== "string" || o.usernameFragment.length > 64)) return { ok: false, status: 400, reason: "ufrag" };
      out.push({ candidate: o.candidate, sdpMid: o.sdpMid ?? null, sdpMLineIndex: o.sdpMLineIndex ?? null, ...(o.usernameFragment ? { usernameFragment: o.usernameFragment } : {}) });
    }
    return { ok: true, data: out };
  }
  if (kind === "ctl") {
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, status: 400, reason: "ctl" };
    if (JSON.stringify(data).length > MAX_CTL_CHARS) return { ok: false, status: 413, reason: "ctl too large" };
    const o = data as Record<string, unknown>;
    const out: WireCtl = {};
    for (const [k, v] of Object.entries(o)) {
      if (!CTL_KEYS.has(k)) return { ok: false, status: 400, reason: "ctl key" };
      if (k === "mic" || k === "video" || k === "away") {
        if (typeof v !== "boolean") return { ok: false, status: 400, reason: k };
        out[k] = v;
      } else if (k === "cam") {
        if (typeof v !== "boolean" && v !== "paused") return { ok: false, status: 400, reason: k };
        out.cam = v;
      } else if (k === "facing") {
        if (v !== "user" && v !== "environment") return { ok: false, status: 400, reason: k };
        out.facing = v;
      } else if (k === "bye") {
        if (typeof v !== "string" || v.length > 32) return { ok: false, status: 400, reason: k };
        out.bye = v;
      }
    }
    return { ok: true, data: out };
  }
  return { ok: false, status: 400, reason: "kind" };
}

/** Split an already-serialised payload into ≤ PART_CHARS slices (null when it would need more than MAX_PARTS). */
export function chunkSerialized(serialized: string, partChars = PART_CHARS, maxParts = MAX_PARTS): string[] | null {
  const parts: string[] = [];
  for (let i = 0; i < serialized.length; i += partChars) parts.push(serialized.slice(i, i + partChars));
  if (!parts.length) parts.push("");
  return parts.length > maxParts ? null : parts;
}

export const isSeq = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEQ;
