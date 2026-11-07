// Pure call-signaling plumbing (no DOM, no network — everything injected), unit-tested in scripts/qa/call_signal_unit.mts.
//
// Pusher is at-most-once and, across separate HTTP publishes, not strictly ordered; a phone that briefly loses its
// socket can also see duplicates after a reconnect. WebRTC on the other hand needs: the offer before its answer,
// ICE candidates only after the remote description, and nothing from an older call. So:
//   SignalInbox  — per call: drops other callIds / legs, dedupes fromLeg:seq:part, reassembles parts, delivers in
//                  seq order (reorder buffer; a gap older than gapMs is skipped — an ICE restart recovers from loss).
//   SignalOutbox — per call: assigns seq, batches ICE (debounce, flushed on the end-of-candidates null), keeps
//                  everything until the remote leg is known (the caller learns it from call-accepted), then POSTs
//                  strictly one after another so Pusher sees them in order.
//   negotiation  — the "perfect negotiation" decision for an incoming description (glare handling).
import type { SignalEvent, SignalKind, WireIce } from "./signalWire";
import { MAX_ICE_PER_BATCH } from "./signalWire";

type Timer = unknown;
export interface Clock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => Timer;
  clearTimeout: (t: Timer) => void;
}
const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

export interface InboundMessage {
  seq: number;
  kind: SignalKind;
  data: unknown;
  fromLeg: string;
}

export class SignalInbox {
  private readonly callId: string;
  private readonly myLeg: string;
  private remoteLeg: string | null;
  private readonly onMessage: (m: InboundMessage) => void;
  private readonly gapMs: number;
  private readonly clock: Clock;
  private seen = new Set<string>();
  private partial = new Map<number, { kind: SignalKind; parts: (string | undefined)[]; got: number; fromLeg: string }>();
  private ready = new Map<number, InboundMessage>();
  private next = 0;
  private gapTimer: Timer | null = null;
  private closed = false;
  /** counters for tests / debugging */
  readonly stats = { delivered: 0, dropped: 0, duplicates: 0, skipped: 0 };

  constructor(o: { callId: string; myLeg: string; remoteLeg?: string | null; onMessage: (m: InboundMessage) => void; gapMs?: number; clock?: Clock }) {
    this.callId = o.callId;
    this.myLeg = o.myLeg;
    this.remoteLeg = o.remoteLeg ?? null;
    this.onMessage = o.onMessage;
    this.gapMs = o.gapMs ?? 2000;
    this.clock = o.clock ?? realClock;
  }

  /** Lock onto the other device once known; signals from any other leg of the same person are dropped. */
  setRemoteLeg(leg: string) {
    if (!this.remoteLeg) this.remoteLeg = leg;
  }

  push(ev: Partial<SignalEvent> | null | undefined): void {
    if (this.closed || !ev) return;
    if (ev.callId !== this.callId || ev.toLeg !== this.myLeg || typeof ev.fromLeg !== "string") {
      this.stats.dropped++;
      return;
    }
    if (this.remoteLeg && ev.fromLeg !== this.remoteLeg) {
      this.stats.dropped++;
      return;
    }
    const { seq, part, parts, kind } = ev;
    if (!Number.isInteger(seq) || !Number.isInteger(part) || !Number.isInteger(parts) || (parts as number) < 1 || (parts as number) > 64 || (part as number) < 0 || (part as number) >= (parts as number)) {
      this.stats.dropped++;
      return;
    }
    if (kind !== "sdp" && kind !== "ice" && kind !== "ctl") {
      this.stats.dropped++;
      return;
    }
    const s = seq as number;
    const key = `${ev.fromLeg}:${s}:${part}`;
    if (this.seen.has(key) || s < this.next) {
      this.stats.duplicates++;
      return;
    }
    this.seen.add(key);
    let p = this.partial.get(s);
    if (!p) {
      p = { kind, parts: new Array(parts as number), got: 0, fromLeg: ev.fromLeg };
      this.partial.set(s, p);
    }
    if (p.parts.length !== parts) {
      this.stats.dropped++;
      return;
    }
    p.parts[part as number] = typeof ev.d === "string" ? ev.d : "";
    p.got++;
    if (p.got < p.parts.length) return;
    this.partial.delete(s);
    let data: unknown;
    try {
      data = JSON.parse(p.parts.join(""));
    } catch {
      this.stats.dropped++;
      data = undefined;
    }
    if (data !== undefined) this.ready.set(s, { seq: s, kind: p.kind, data, fromLeg: p.fromLeg });
    else this.ready.set(s, { seq: s, kind: "ctl", data: null, fromLeg: p.fromLeg }); // keep the sequence moving
    this.drain();
  }

  private drain() {
    while (this.ready.has(this.next)) {
      const m = this.ready.get(this.next)!;
      this.ready.delete(this.next);
      this.next++;
      if (m.data !== null) {
        this.stats.delivered++;
        this.onMessage(m);
      }
      if (this.closed) return;
    }
    const waiting = this.ready.size > 0 || this.partial.size > 0;
    if (waiting && !this.gapTimer) {
      this.gapTimer = this.clock.setTimeout(() => {
        this.gapTimer = null;
        this.skipGap();
      }, this.gapMs);
    } else if (!waiting && this.gapTimer) {
      this.clock.clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  private skipGap() {
    if (this.closed) return;
    const pending = [...this.ready.keys(), ...this.partial.keys()].filter((s) => s >= this.next);
    if (!pending.length) return;
    const target = Math.min(...[...this.ready.keys()].filter((s) => s >= this.next), Infinity);
    if (!Number.isFinite(target)) {
      // only incomplete multi-part messages are waiting: give them one more window, then drop them
      const oldest = Math.min(...pending);
      this.stats.skipped += oldest - this.next + 1;
      this.partial.delete(oldest);
      this.next = oldest + 1;
    } else {
      this.stats.skipped += target - this.next;
      for (const s of [...this.partial.keys()]) if (s < target) this.partial.delete(s);
      this.next = target;
    }
    this.drain();
  }

  close() {
    this.closed = true;
    if (this.gapTimer) this.clock.clearTimeout(this.gapTimer);
    this.gapTimer = null;
    this.partial.clear();
    this.ready.clear();
  }
}

export interface OutboundMessage {
  seq: number;
  kind: SignalKind;
  data: unknown;
  toLeg: string;
}

/** post() resolves true when the server accepted the message (2xx). Thrown errors / false are retried. */
export type PostFn = (m: OutboundMessage) => Promise<boolean>;

export class SignalOutbox {
  private readonly post: PostFn;
  private readonly clock: Clock;
  private readonly iceDebounceMs: number;
  private readonly retryDelays: number[];
  private remoteLeg: string | null = null;
  private queue: { seq: number; kind: SignalKind; data: unknown }[] = [];
  private seq = 0;
  private ice: WireIce[] = [];
  private iceTimer: Timer | null = null;
  private running = false;
  private closed = false;
  readonly stats = { posted: 0, failed: 0, retries: 0 };

  constructor(o: { post: PostFn; clock?: Clock; iceDebounceMs?: number; retryDelays?: number[] }) {
    this.post = o.post;
    this.clock = o.clock ?? realClock;
    this.iceDebounceMs = o.iceDebounceMs ?? 150;
    this.retryDelays = o.retryDelays ?? [300, 1000, 2000];
  }

  get isOpen() {
    return !!this.remoteLeg;
  }
  get pending() {
    return this.queue.length + (this.running ? 1 : 0);
  }

  /** The gate: nothing leaves until the other device is known. */
  open(remoteLeg: string) {
    if (this.closed || this.remoteLeg) return;
    this.remoteLeg = remoteLeg;
    this.pump();
  }

  send(kind: SignalKind, data: unknown) {
    if (this.closed) return;
    if (kind === "sdp") this.flushIce(); // candidates gathered for the previous description go first
    this.queue.push({ seq: this.seq++, kind, data });
    this.pump();
  }

  /** null = end of candidates → flush now. */
  addIce(c: WireIce | null) {
    if (this.closed) return;
    if (c) this.ice.push(c);
    if (!c || this.ice.length >= MAX_ICE_PER_BATCH) {
      this.flushIce();
      return;
    }
    if (!this.iceTimer) this.iceTimer = this.clock.setTimeout(() => this.flushIce(), this.iceDebounceMs);
  }

  flushIce() {
    if (this.iceTimer) this.clock.clearTimeout(this.iceTimer);
    this.iceTimer = null;
    if (!this.ice.length || this.closed) return;
    const batch = this.ice.splice(0, MAX_ICE_PER_BATCH);
    this.queue.push({ seq: this.seq++, kind: "ice", data: batch });
    if (this.ice.length) this.flushIce();
    this.pump();
  }

  private async pump() {
    if (this.running || !this.remoteLeg || this.closed) return;
    this.running = true;
    try {
      while (this.queue.length && !this.closed) {
        const m = this.queue[0];
        let ok = false;
        for (let attempt = 0; attempt <= this.retryDelays.length && !this.closed; attempt++) {
          if (attempt > 0) {
            this.stats.retries++;
            await new Promise<void>((r) => this.clock.setTimeout(r, this.retryDelays[attempt - 1]));
          }
          try {
            ok = await this.post({ ...m, toLeg: this.remoteLeg });
          } catch {
            ok = false;
          }
          if (ok) break;
        }
        if (ok) this.stats.posted++;
        else this.stats.failed++; // lost: the receiver skips the gap; ICE restart repairs the session
        this.queue.shift();
      }
    } finally {
      this.running = false;
    }
  }

  close() {
    this.closed = true;
    if (this.iceTimer) this.clock.clearTimeout(this.iceTimer);
    this.iceTimer = null;
    this.queue = [];
    this.ice = [];
  }
}

// ---- perfect negotiation (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example) ----
export interface NegotiationState {
  makingOffer: boolean;
  signalingState: string;
  isSettingRemoteAnswerPending: boolean;
}
/** An incoming offer collides when we are mid-offer ourselves (or not stable and not about to apply an answer). */
export function isOfferCollision(type: string, s: NegotiationState): boolean {
  if (type !== "offer") return false;
  const readyForOffer = !s.makingOffer && (s.signalingState === "stable" || s.isSettingRemoteAnswerPending);
  return !readyForOffer;
}
/** The impolite side (caller) ignores a colliding offer; the polite side (callee) rolls back and accepts it. */
export function shouldIgnoreOffer(polite: boolean, type: string, s: NegotiationState): boolean {
  return !polite && isOfferCollision(type, s);
}
