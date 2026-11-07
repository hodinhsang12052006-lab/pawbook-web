"use client";

// One RTCPeerConnection for one 1:1 call, built on the browser's own WebRTC (no SDK).
//
// Lessons kept from the July 2026 build: get the microphone (and camera) FIRST and attach the tracks BEFORE any
// offer/answer is created (iOS one-way audio otherwise); queue remote ICE until the remote description is set.
// Layout of the connection:
//   - transceiver 0 = audio sendrecv, transceiver 1 = video sendrecv ALWAYS (even on a voice call, with no track), so
//     turning the camera on/off, upgrading voice → video and flipping cameras are just replaceTrack() — no
//     renegotiation, nothing for the other side to accept;
//   - a negotiated data channel "ctl" (id 0) carries in-call state (mic / camera / facing) peer-to-peer;
//   - "perfect negotiation": the callee is polite, the caller impolite, so a simultaneous ICE-restart offer (glare)
//     resolves itself.
// Reconnects: 'disconnected' → Reconnecting… → ICE restart (caller after 2 s, callee after 5 s, both at once on
// 'failed' or when the device comes back online); a restart offer without an answer for 6 s is rolled back and sent
// again; 30 s without media → the call ends ('failed').
import { isOfferCollision, shouldIgnoreOffer } from "./signalQueue";
import type { SignalKind, WireCtl, WireIce, WireSdp } from "./signalWire";

export type NetState = "new" | "connecting" | "connected" | "reconnecting" | "failed" | "closed";
export type Quality = "good" | "fair" | "poor";

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
export function videoConstraints(facing: "user" | "environment" = "user", deviceId?: string): MediaTrackConstraints {
  return {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 24, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: facing }),
  };
}

const MAX_VIDEO_BITRATE = 1_200_000;
const POOR_VIDEO_BITRATE = 450_000;

export interface CallPeerOptions {
  polite: boolean;
  iceServers: RTCIceServer[];
  /** caller: tracks attached right away; callee: attached when the first offer arrives */
  localStream: MediaStream;
  send: (kind: SignalKind, data: WireSdp | WireIce | null | WireCtl) => void;
  onRemoteAudio: (stream: MediaStream) => void;
  onRemoteVideo: (stream: MediaStream) => void;
  onNetState: (s: NetState) => void;
  onCtl: (c: WireCtl) => void;
  onQuality?: (q: Quality, relay: boolean) => void;
  /** media really flowing in both directions for the first time */
  onMediaUp?: () => void;
  log?: (...a: unknown[]) => void;
  timings?: Partial<{ callerRestartMs: number; calleeRestartMs: number; restartAnswerMs: number; deadlineMs: number; statsMs: number }>;
}

export class CallPeer {
  readonly pc: RTCPeerConnection;
  private o: CallPeerOptions;
  private dc: RTCDataChannel | null = null;
  private restartFallback = false;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private pendingIce: RTCIceCandidateInit[] = [];
  private chain: Promise<void> = Promise.resolve();
  private tracksAttached = false;
  private net: NetState = "new";
  private everConnected = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private answerTimer: ReturnType<typeof setTimeout> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastInbound = { bytes: 0, lost: 0, recv: 0 };
  private poorStreak = 0;
  private goodStreak = 0;
  private degraded = false;
  private closed = false;
  private readonly onOnline = () => this.restart("online");
  readonly remoteAudio = new MediaStream();
  readonly remoteVideo = new MediaStream();
  private t: Required<NonNullable<CallPeerOptions["timings"]>>;

  constructor(o: CallPeerOptions) {
    this.o = o;
    this.t = { callerRestartMs: 2000, calleeRestartMs: 5000, restartAnswerMs: 6000, deadlineMs: 30_000, statsMs: 2000, ...(o.timings || {}) };
    this.pc = new RTCPeerConnection({ iceServers: o.iceServers, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
    const pc = this.pc;
    if (!o.polite) {
      this.attachCallerTracks();
      this.openCtlChannel();
    }

    pc.onnegotiationneeded = async () => {
      if (this.closed) return;
      try {
        this.makingOffer = true;
        await this.setLocal();
        if (pc.localDescription) this.o.send("sdp", { type: pc.localDescription.type as WireSdp["type"], sdp: stripCandidates(pc.localDescription.sdp) });
        this.armAnswerTimer();
      } catch (err) {
        this.log("negotiationneeded failed", err);
      } finally {
        this.makingOffer = false;
      }
    };
    pc.onicecandidate = ({ candidate }) => {
      if (this.closed) return;
      if (!candidate || !candidate.candidate) {
        this.o.send("ice", null);
        return;
      }
      this.o.send("ice", { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment });
    };
    pc.ontrack = ({ track }) => {
      const target = track.kind === "audio" ? this.remoteAudio : this.remoteVideo;
      for (const old of target.getTracks()) if (old !== track) target.removeTrack(old);
      if (!target.getTracks().includes(track)) target.addTrack(track);
      if (track.kind === "audio") this.o.onRemoteAudio(this.remoteAudio);
      else this.o.onRemoteVideo(this.remoteVideo);
    };
    pc.onconnectionstatechange = () => this.onConnState();
    pc.oniceconnectionstatechange = () => this.onConnState();
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
    this.setNet("connecting");
  }

  /** Negotiated (no DCEP): both sides open channel id 0. The caller opens it before its offer (the SCTP m-line rides
   *  on that offer); the callee only after applying the offer — earlier would make the callee renegotiate (glare). */
  private openCtlChannel() {
    if (this.dc) return;
    const dc = this.pc.createDataChannel("ctl", { negotiated: true, id: 0, ordered: true });
    dc.onmessage = (e) => {
      try {
        const c = JSON.parse(String(e.data));
        if (c && typeof c === "object") this.o.onCtl(c as WireCtl);
      } catch {}
    };
    this.dc = dc;
  }

  /** setLocalDescription() without arguments, with a fallback for older Safari (explicit createOffer/createAnswer). */
  private async setLocal() {
    const pc = this.pc;
    if (!this.restartFallback) {
      try {
        await pc.setLocalDescription();
        return;
      } catch (err) {
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") throw err;
      }
    }
    const restart = this.restartFallback;
    this.restartFallback = false;
    const d = pc.signalingState === "have-remote-offer" ? await pc.createAnswer() : await pc.createOffer(restart ? { iceRestart: true } : undefined);
    await pc.setLocalDescription(d);
  }

  get polite() {
    return this.o.polite;
  }
  get state() {
    return this.net;
  }

  private log(...a: unknown[]) {
    this.o.log?.("[call]", ...a);
  }

  private attachCallerTracks() {
    const s = this.o.localStream;
    const audio = s.getAudioTracks()[0] || null;
    const video = s.getVideoTracks()[0] || null;
    this.pc.addTransceiver(audio || "audio", { direction: "sendrecv", streams: [s] });
    this.pc.addTransceiver(video || "video", { direction: "sendrecv", streams: [s] });
    this.tracksAttached = true;
  }

  /** Callee: the first offer created our transceivers — put our microphone / camera on them before answering. */
  private async attachCalleeTracks() {
    if (this.tracksAttached) return;
    const s = this.o.localStream;
    for (const tx of this.pc.getTransceivers()) {
      const kind = tx.receiver.track?.kind;
      if (kind !== "audio" && kind !== "video") continue;
      const track = (kind === "audio" ? s.getAudioTracks()[0] : s.getVideoTracks()[0]) || null;
      await tx.sender.replaceTrack(track);
      try {
        tx.sender.setStreams?.(s);
      } catch {}
      tx.direction = "sendrecv";
    }
    this.openCtlChannel();
    this.tracksAttached = true;
  }

  /** Feed one in-order message from the SignalInbox. Serialised: one description is applied at a time. */
  handle(kind: SignalKind, data: unknown) {
    this.chain = this.chain.then(() => this.handleNow(kind, data)).catch((err) => this.log("signal failed", kind, err));
    return this.chain;
  }

  private async handleNow(kind: SignalKind, data: unknown) {
    if (this.closed) return;
    const pc = this.pc;
    if (kind === "sdp") {
      const desc = data as WireSdp;
      if (!desc || (desc.type !== "offer" && desc.type !== "answer")) return;
      const st = { makingOffer: this.makingOffer, signalingState: pc.signalingState, isSettingRemoteAnswerPending: this.isSettingRemoteAnswerPending };
      this.ignoreOffer = shouldIgnoreOffer(this.o.polite, desc.type, st);
      if (this.ignoreOffer) return;
      if (desc.type === "answer" && pc.signalingState !== "have-local-offer") return; // late / duplicate answer
      if (desc.type === "offer" && isOfferCollision(desc.type, st) && pc.signalingState === "have-local-offer") {
        // polite side: explicit rollback (older Safari has no implicit rollback in setRemoteDescription)
        await pc.setLocalDescription({ type: "rollback" });
      }
      this.isSettingRemoteAnswerPending = desc.type === "answer";
      try {
        await pc.setRemoteDescription({ type: desc.type, sdp: desc.sdp });
      } finally {
        this.isSettingRemoteAnswerPending = false;
      }
      if (desc.type === "answer") this.clearAnswerTimer();
      if (!this.everConnected) this.armDeadline();
      if (desc.type === "offer") {
        await this.attachCalleeTracks();
        await this.setLocal();
        if (pc.localDescription) this.o.send("sdp", { type: "answer", sdp: stripCandidates(pc.localDescription.sdp) });
      }
      await this.drainIce();
      return;
    }
    if (kind === "ice") {
      const list = Array.isArray(data) ? (data as WireIce[]) : [];
      for (const c of list) {
        const init: RTCIceCandidateInit = { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment ?? undefined };
        if (!pc.remoteDescription) this.pendingIce.push(init);
        else await this.addIce(init);
      }
      return;
    }
    if (kind === "ctl" && data && typeof data === "object") this.o.onCtl(data as WireCtl);
  }

  private async addIce(init: RTCIceCandidateInit) {
    try {
      await this.pc.addIceCandidate(init);
    } catch (err) {
      // candidates of an offer we ignored (glare) or of an old ICE generation are expected to fail
      if (!this.ignoreOffer) this.log("addIceCandidate", err);
    }
  }

  private async drainIce() {
    const q = this.pendingIce;
    this.pendingIce = [];
    for (const c of q) await this.addIce(c);
  }

  /** Small control message: over the data channel when open, else over signaling. */
  sendCtl(c: WireCtl) {
    if (this.closed) return;
    if (this.dc?.readyState === "open") {
      try {
        this.dc.send(JSON.stringify(c));
        return;
      } catch {}
    }
    this.o.send("ctl", c);
  }

  private setNet(s: NetState) {
    if (this.net === s || this.closed) return;
    this.net = s;
    this.o.onNetState(s);
  }

  private onConnState() {
    if (this.closed) return;
    const pc = this.pc;
    const cs = pc.connectionState;
    const ice = pc.iceConnectionState;
    if (cs === "connected" || ice === "connected" || ice === "completed") {
      this.clearRestartTimer();
      this.clearDeadline();
      if (!this.everConnected) {
        this.everConnected = true;
        this.applyBitrate(MAX_VIDEO_BITRATE, 1);
        this.startStats();
        this.o.onMediaUp?.();
      }
      this.setNet("connected");
      return;
    }
    if (cs === "failed" || ice === "failed") {
      if (this.everConnected) this.setNet("reconnecting");
      this.restart("failed");
      this.armDeadline();
      return;
    }
    if (ice === "disconnected" || cs === "disconnected") {
      if (this.everConnected) this.setNet("reconnecting");
      this.armDeadline();
      if (!this.restartTimer) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (this.pc.iceConnectionState === "disconnected" || this.pc.connectionState === "disconnected") this.restart("disconnected");
        }, this.o.polite ? this.t.calleeRestartMs : this.t.callerRestartMs);
      }
    }
  }

  /** ICE restart (new ufrag/pwd, re-gathers candidates incl. TURN); the offer goes through onnegotiationneeded. */
  restart(why: string) {
    if (this.closed || !this.pc.remoteDescription) return;
    this.log("ice restart:", why);
    this.clearRestartTimer();
    if (typeof this.pc.restartIce === "function") {
      try {
        this.pc.restartIce();
        return;
      } catch (err) {
        this.log("restartIce", err);
      }
    }
    // no restartIce(): craft the restart offer ourselves (only when stable; otherwise the next timer retries)
    if (this.pc.signalingState === "stable") {
      this.restartFallback = true;
      this.pc.onnegotiationneeded?.(new Event("negotiationneeded"));
    }
  }

  private armAnswerTimer() {
    this.clearAnswerTimer();
    if (!this.everConnected && this.pc.signalingState === "have-local-offer" && !this.pc.remoteDescription) return; // first offer: waits for the callee (ringing)
    this.answerTimer = setTimeout(async () => {
      this.answerTimer = null;
      if (this.closed || this.pc.signalingState !== "have-local-offer") return;
      this.log("restart offer unanswered → rollback + offer again");
      try {
        await this.pc.setLocalDescription({ type: "rollback" });
      } catch {}
      this.restart("no-answer");
    }, this.t.restartAnswerMs);
  }
  private clearAnswerTimer() {
    if (this.answerTimer) clearTimeout(this.answerTimer);
    this.answerTimer = null;
  }
  private clearRestartTimer() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }
  /** No media for deadlineMs while (re)connecting → the call has failed. */
  private armDeadline() {
    if (this.deadline || this.closed) return;
    this.deadline = setTimeout(() => {
      this.deadline = null;
      const ice = this.pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") return;
      this.setNet("failed");
    }, this.t.deadlineMs);
  }
  private clearDeadline() {
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
  }

  // ---------- local media controls ----------
  private sender(kind: "audio" | "video"): RTCRtpSender | null {
    for (const tx of this.pc.getTransceivers()) {
      if (tx.currentDirection === "stopped" || tx.direction === "stopped") continue;
      const k = tx.receiver.track?.kind || tx.sender.track?.kind;
      if (k === kind) return tx.sender;
    }
    return null;
  }

  setMicEnabled(on: boolean) {
    for (const t of this.o.localStream.getAudioTracks()) t.enabled = on;
    this.sendCtl({ mic: on });
  }

  /** Swap the outgoing camera track (null = camera off). The caller of this owns stopping old tracks. */
  async replaceVideoTrack(track: MediaStreamTrack | null) {
    const s = this.sender("video");
    if (!s) return;
    await s.replaceTrack(track);
    if (track) this.applyBitrate(this.degraded ? POOR_VIDEO_BITRATE : MAX_VIDEO_BITRATE, this.degraded ? 2 : 1);
  }

  async replaceAudioTrack(track: MediaStreamTrack) {
    const s = this.sender("audio");
    if (s) await s.replaceTrack(track);
  }

  private async applyBitrate(maxBitrate: number, scale: number) {
    const s = this.sender("video");
    if (!s || !s.track) return;
    try {
      const p = s.getParameters();
      if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = maxBitrate;
      p.encodings[0].scaleResolutionDownBy = scale;
      await s.setParameters(p);
    } catch {}
  }

  // ---------- quality ----------
  private startStats() {
    if (this.statsTimer || !this.o.onQuality) return;
    this.statsTimer = setInterval(() => this.sample(), this.t.statsMs);
  }

  private async sample() {
    if (this.closed) return;
    try {
      const stats = await this.pc.getStats();
      let rtt: number | null = null;
      let relay = false;
      let bytes = 0;
      let lost = 0;
      let recv = 0;
      let jitter = 0;
      let pairId: string | undefined;
      stats.forEach((r) => {
        if (r.type === "transport" && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
      });
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && (r.id === pairId || (!pairId && r.nominated && r.state === "succeeded"))) {
          if (typeof r.currentRoundTripTime === "number") rtt = r.currentRoundTripTime;
          const local = stats.get(r.localCandidateId);
          if (local?.candidateType === "relay") relay = true;
        }
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          bytes += r.bytesReceived || 0;
          lost += r.packetsLost || 0;
          recv += r.packetsReceived || 0;
          jitter = Math.max(jitter, r.jitter || 0);
        }
      });
      const dLost = Math.max(0, lost - this.lastInbound.lost);
      const dRecv = Math.max(0, recv - this.lastInbound.recv);
      this.lastInbound = { bytes, lost, recv };
      const loss = dLost + dRecv > 0 ? dLost / (dLost + dRecv) : 0;
      const r = rtt ?? 0;
      const q: Quality = r > 0.6 || loss > 0.08 || jitter > 0.1 ? "poor" : r > 0.3 || loss > 0.03 || jitter > 0.05 ? "fair" : "good";
      this.o.onQuality?.(q, relay);
      // weak link: halve the outgoing video resolution + bitrate; restore after it stays good
      if (q === "poor") {
        this.goodStreak = 0;
        if (++this.poorStreak >= 2 && !this.degraded) {
          this.degraded = true;
          this.applyBitrate(POOR_VIDEO_BITRATE, 2);
        }
      } else {
        this.poorStreak = 0;
        if (q === "good" && ++this.goodStreak >= 3 && this.degraded) {
          this.degraded = false;
          this.applyBitrate(MAX_VIDEO_BITRATE, 1);
        }
      }
    } catch {}
  }

  close() {
    if (this.closed) return;
    this.setNet("closed");
    this.closed = true;
    this.clearRestartTimer();
    this.clearAnswerTimer();
    this.clearDeadline();
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
    try {
      this.dc?.close();
    } catch {}
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    try {
      this.pc.close();
    } catch {}
    for (const t of this.remoteAudio.getTracks()) this.remoteAudio.removeTrack(t);
    for (const t of this.remoteVideo.getTracks()) this.remoteVideo.removeTrack(t);
  }
}

/** Candidates are trickled separately (batched); keeping them out of the SDP keeps every description small. */
export function stripCandidates(sdp: string): string {
  return sdp
    .split(/\r\n/)
    .filter((l) => !l.startsWith("a=candidate:") && l !== "a=end-of-candidates")
    .join("\r\n");
}

export function stopStream(s: MediaStream | null | undefined) {
  if (!s) return;
  for (const t of s.getTracks()) {
    try {
      t.stop();
    } catch {}
  }
}
