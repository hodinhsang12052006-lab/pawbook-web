"use client";

import { apiError } from "@/lib/i18n/apiError";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Phone, Video, VideoOff, PhoneOff, Loader2, Mic, MicOff, Volume2, VolumeX, MessageCircle, ShieldAlert, RefreshCw } from "lucide-react";
import { useAudioOutput } from "@/lib/useAudioOutput";
import toast from "react-hot-toast";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { getPusherClient } from "@/lib/pusherClient";
import { primeRingtone, startRingtone, stopRingtone } from "@/lib/ringtone";
import Avatar from "@/components/ui/Avatar";
import { isPlaceholderAvatar } from "@/lib/avatar";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { loadCallEngine, preloadCallSdk } from "@/lib/callPreload";
import { androidAppBuild, classifyMediaError, describeMediaError, peerMediaReason, type MediaErrorText } from "@/lib/calls/mediaErrors";
import { callAudioElement, countCameras, getCallMedia, getCameraTrack, playRemoteAudio, resetCallAudio, stopStream, unlockCallAudio, type Facing } from "@/lib/calls/media";
import type { CallPeer, NetState, Quality } from "@/lib/calls/peer";
import type { SignalInbox, SignalOutbox, OutboundMessage } from "@/lib/calls/signalQueue";
import type { SignalEvent, WireCtl, WireIce } from "@/lib/calls/signalWire";

const CallScreen = dynamic(() => import("@/components/chat/call/CallScreen"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-pn-canvas text-pn-text">
      <Loader2 className="h-8 w-8 text-pn-brand-ink motion-safe:animate-spin" />
      <p className="mt-2 text-xs text-pn-text-2">{tr("Đang kết nối cuộc gọi…", "Connecting call…")}</p>
    </div>
  ),
});

export interface CallPartner {
  id: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  conversationId?: string;
}

interface CallManagerProps {
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string | null;
}

export interface CallManagerHandle {
  startCall: (partner: CallPartner, type: "audio" | "video") => void;
}

type CallType = "audio" | "video";
// idle → outgoing (đang đổ chuông bên kia) / incoming (máy mình đang đổ chuông)
//      → connecting (đã nghe máy, WebRTC đang nối) → connected
//      error: chỉ còn hộp thoại lỗi micro / camera (không ai bị đổ chuông khi người gọi bị chặn quyền)
type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "connected" | "error";

interface Peer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ActiveCall {
  callId: string;
  token: string | null;
  peer: Peer;
  type: CallType;
  isCaller: boolean;
  /** the other device (leg) — caller: from call-accepted; callee: from incoming-call */
  remoteLeg: string | null;
  accepted: boolean;
  connectedAt: number | null;
  logged: boolean;
}

// Không ai nghe máy sau ngần này thì tự kết thúc + ghi "cuộc gọi nhỡ".
const RING_TIMEOUT_MS = 45_000;
// Người gọi đổ chuông lại (không gửi push) mỗi ngần này: máy vừa mở PawNail từ thông báo cuộc gọi vẫn kịp đổ chuông.
const RE_RING_MS = 6_000;
// Đã nghe máy mà không thông được trong ngần này → báo lỗi, kết thúc.
const CONNECT_TIMEOUT_MS = 35_000;
// "Mất kết nối" hiện tối đa ngần này rồi tự kết thúc nếu không bấm Thử lại.
const FAILED_GRACE_MS = 15_000;

const randomId = (n: number) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join("");
};

// Cuộc gọi thoại + video 1-1 bằng WebRTC có sẵn của trình duyệt (không SDK, không phí): Pusher chỉ chở tín hiệu
// (đổ chuông / nghe máy / SDP / ICE qua /api/calls), âm thanh + hình đi thẳng giữa 2 máy hoặc qua TURN khi có.
// Mount DUY NHẤT 1 lần ở root layout (lib/CallManagerContext.tsx) nên cuộc gọi không bị ngắt khi chuyển trang.
const CallManager = forwardRef<CallManagerHandle, CallManagerProps>(function CallManager({ currentUserId }, ref) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [callType, setCallType] = useState<CallType>("audio");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [ringing, setRinging] = useState(false);
  const [ringSecs, setRingSecs] = useState(0);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  // media + connection
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [facing, setFacing] = useState<Facing>("user");
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<MediaStream | null>(null);
  const [remoteVideoLive, setRemoteVideoLive] = useState(false);
  const [remoteMic, setRemoteMic] = useState(true);
  const [remoteCam, setRemoteCam] = useState<boolean | "paused">(false);
  const [videoMode, setVideoMode] = useState(false);
  const [net, setNet] = useState<NetState>("new");
  const [quality, setQuality] = useState<Quality | null>(null);
  const [relay, setRelay] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [canFlip, setCanFlip] = useState(false);
  const [camBusy, setCamBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [mediaError, setMediaError] = useState<(MediaErrorText & { role: "caller" | "callee" | "camera" }) | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const callRef = useRef<ActiveCall | null>(null);
  // This tab / app instance ("leg"): the other side addresses its WebRTC signals to exactly this device.
  const [leg] = useState(() => "w" + randomId(11));
  const peerRef = useRef<CallPeer | null>(null);
  const inboxRef = useRef<SignalInbox | null>(null);
  const outboxRef = useRef<SignalOutbox | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackAudioRef = useRef<MediaStream | null>(null);
  const camOnRef = useRef(false);
  const facingRef = useRef<Facing>("user");
  const iceRef = useRef<{ servers: RTCIceServer[]; until: number } | null>(null);
  const endedRef = useRef<string[]>([]);
  const timers = useRef<{ ring?: ReturnType<typeof setTimeout>; reRing?: ReturnType<typeof setInterval>; connect?: ReturnType<typeof setTimeout>; failed?: ReturnType<typeof setTimeout> }>({});

  const setPhase = useCallback((p: Phase) => {
    const ringingNow = p === "outgoing" || p === "incoming";
    if (ringingNow && phaseRef.current !== p) setRingSecs(0);
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const clearTimers = useCallback(() => {
    const t = timers.current;
    if (t.ring) clearTimeout(t.ring);
    if (t.reRing) clearInterval(t.reRing);
    if (t.connect) clearTimeout(t.connect);
    if (t.failed) clearTimeout(t.failed);
    timers.current = {};
  }, []);

  const markEnded = (callId: string) => {
    const l = endedRef.current;
    if (!l.includes(callId)) l.push(callId);
    if (l.length > 50) l.shift();
  };

  // ---------- network helpers ----------
  const postCall = useCallback(async (call: ActiveCall, action: string, extra: Record<string, unknown> = {}) => {
    return fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: call.peer.id, action, callId: call.callId, callToken: call.token, ...extra }),
    });
  }, []);

  const getIce = useCallback(async (): Promise<RTCIceServer[]> => {
    const c = iceRef.current;
    if (c && c.until > Date.now()) return c.servers;
    try {
      const r = await fetch("/api/calls/ice", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.iceServers)) {
          iceRef.current = { servers: d.iceServers, until: Date.now() + Math.max(60, Number(d.ttlSec) || 600) * 500 };
          return d.iceServers;
        }
      }
    } catch {}
    return c?.servers ?? [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  }, []);

  // Nhật ký cuộc gọi trong khung chat ("Cuộc gọi nhỡ", "Cuộc gọi thoại · 2:05"). CHỈ người gọi ghi để không bị 2 dòng.
  const logCall = useCallback((outcome: "missed" | "declined" | "ended", beacon = false) => {
    const call = callRef.current;
    if (!call || !call.isCaller || call.logged || !call.token) return;
    call.logged = true;
    const seconds = outcome === "ended" ? (call.connectedAt ? Math.round((Date.now() - call.connectedAt) / 1000) : 0) : null;
    const body = JSON.stringify({ receiverId: call.peer.id, type: "CALL", content: `${outcome}:${call.type}${seconds !== null ? `:${seconds}` : ""}` });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/messages", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, []);

  // Dọn sạch MỌI thứ của cuộc gọi (mọi lối thoát đều đi qua đây): chuông, hẹn giờ, kết nối, micro / camera.
  const teardown = useCallback(
    (opts: { keepError?: boolean } = {}) => {
      const call = callRef.current;
      if (call) markEnded(call.callId);
      stopRingtone();
      clearTimers();
      peerRef.current?.close();
      peerRef.current = null;
      inboxRef.current?.close();
      inboxRef.current = null;
      outboxRef.current?.close();
      outboxRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      stopStream(fallbackAudioRef.current);
      fallbackAudioRef.current = null;
      resetCallAudio();
      callRef.current = null;
      camOnRef.current = false;
      setPreview(null);
      setRemoteVideo(null);
      setRemoteVideoLive(false);
      setRemoteMic(true);
      setRemoteCam(false);
      setVideoMode(false);
      setNet("new");
      setQuality(null);
      setRelay(false);
      setConnectedAt(null);
      setRinging(false);
      setMicOn(true);
      setCamOn(false);
      setCamBusy(false);
      setAudioBlocked(false);
      setFacing("user");
      facingRef.current = "user";
      if (opts.keepError) {
        setPhase("error");
      } else {
        setMediaError(null);
        setPeer(null);
        setPhase("idle");
      }
    },
    [clearTimers, setPhase]
  );

  // Kết thúc chủ động (cúp máy / huỷ / từ chối / hết giờ / rớt mạng): báo bên kia + ghi nhật ký rồi dọn.
  const endCall = useCallback(
    (reason: "hangup" | "cancel" | "decline" | "timeout" | "failed", opts: { toast?: string; keepError?: boolean } = {}) => {
      const call = callRef.current;
      if (!call) return;
      const ph = phaseRef.current;
      try {
        peerRef.current?.sendCtl({ bye: reason });
      } catch {}
      if (call.token) postCall(call, "reject", { reason, socketId: getPusherClient()?.connection?.socket_id }).catch(() => {});
      if (call.isCaller) {
        if (ph === "outgoing") logCall("missed");
        else if (ph === "connecting" || ph === "connected") logCall(reason === "failed" && !call.connectedAt ? "missed" : "ended");
      }
      if (opts.toast) toast(opts.toast, { icon: "📞" });
      teardown({ keepError: opts.keepError });
    },
    [logCall, postCall, teardown]
  );

  // ---------- call engine (RTCPeerConnection + signaling queues) ----------
  const handleNet = useCallback(
    (call: ActiveCall, s: NetState) => {
      if (callRef.current !== call) return;
      setNet(s);
      if (s === "connected") {
        if (timers.current.connect) clearTimeout(timers.current.connect);
        if (timers.current.failed) clearTimeout(timers.current.failed);
        timers.current.connect = undefined;
        timers.current.failed = undefined;
        if (!call.connectedAt) {
          call.connectedAt = Date.now();
          setConnectedAt(call.connectedAt);
        }
        setPhase("connected");
      } else if (s === "failed") {
        if (timers.current.failed) clearTimeout(timers.current.failed);
        timers.current.failed = setTimeout(() => {
          if (callRef.current === call) endCall("failed", { toast: tr("Cuộc gọi đã ngắt do mất kết nối.", "Call dropped — connection lost.") });
        }, FAILED_GRACE_MS);
      }
    },
    [endCall, setPhase]
  );

  const handleRemoteBye = useRef<(call: ActiveCall, reason: string) => void>(() => {});

  const handleCtl = useCallback((call: ActiveCall, c: WireCtl) => {
    if (callRef.current !== call) return;
    if (typeof c.mic === "boolean") setRemoteMic(c.mic);
    if (c.cam !== undefined) {
      setRemoteCam(c.cam);
      if (c.cam === true) setVideoMode(true);
    }
    if (c.bye) handleRemoteBye.current(call, c.bye);
  }, []);

  const startEngine = useCallback(
    async (call: ActiveCall, stream: MediaStream, polite: boolean): Promise<boolean> => {
      const [eng, iceServers] = await Promise.all([loadCallEngine(), getIce()]);
      if (callRef.current !== call) return false;
      const myLeg = leg;
      const outbox = new eng.SignalOutbox({
        post: async (m: OutboundMessage) => {
          const r = await postCall(call, "signal", { fromLeg: myLeg, toLeg: m.toLeg, seq: m.seq, kind: m.kind, data: m.data });
          // 4xx (call over / invalid) are final; network errors, 429 and 5xx are retried by the outbox
          return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);
        },
      });
      const inbox = new eng.SignalInbox({
        callId: call.callId,
        myLeg,
        remoteLeg: call.remoteLeg,
        onMessage: (m) => {
          peerRef.current?.handle(m.kind, m.data);
        },
      });
      const debug = typeof window !== "undefined" && (window as unknown as { __pnCallDebug?: boolean }).__pnCallDebug;
      const peerConn = new eng.CallPeer({
        polite,
        iceServers,
        localStream: stream,
        send: (kind, data) => {
          if (kind === "ice") outbox.addIce(data as WireIce | null);
          else outbox.send(kind, data);
        },
        onRemoteAudio: (s) => {
          playRemoteAudio(s).then((ok) => {
            if (callRef.current === call) setAudioBlocked(!ok);
          });
        },
        onRemoteVideo: (s) => {
          setRemoteVideo(s);
          const t = s.getVideoTracks()[0];
          if (t) {
            setRemoteVideoLive(!t.muted);
            t.onmute = () => callRef.current === call && setRemoteVideoLive(false);
            t.onunmute = () => callRef.current === call && setRemoteVideoLive(true);
          }
        },
        onNetState: (s) => handleNet(call, s),
        onCtl: (c) => handleCtl(call, c),
        onQuality: (q, r) => {
          if (callRef.current !== call) return;
          setQuality(q);
          setRelay(r);
        },
        onMediaUp: () => {
          // tell the other side our real mic / camera state once the data channel is up
          setTimeout(() => {
            if (callRef.current !== call) return;
            peerRef.current?.sendCtl({ mic: streamRef.current?.getAudioTracks()[0]?.enabled !== false, cam: camOnRef.current });
          }, 300);
        },
        log: debug ? (...a: unknown[]) => console.info(...a) : undefined,
      });
      peerRef.current = peerConn;
      inboxRef.current = inbox;
      outboxRef.current = outbox;
      if (call.remoteLeg) outbox.open(call.remoteLeg);
      return true;
    },
    [getIce, handleCtl, handleNet, leg, postCall]
  );

  const showMediaError = useCallback(
    async (err: unknown, role: "caller" | "callee" | "camera", o: { video: boolean; cameraOnly?: boolean }) => {
      const kind = classifyMediaError(err);
      const build = kind === "denied" ? await androidAppBuild() : null;
      setMediaError({ ...describeMediaError(kind, { video: o.video, cameraOnly: o.cameraOnly, oldAppBuild: build !== null && build < 3 }), role });
    },
    []
  );

  // ---------- outgoing ----------
  const ringPeer = useCallback(
    async (call: ActiveCall) => {
      startRingtone("outgoing");
      let res: Response;
      try {
        res = await postCall(call, "offer", { callType: call.type, leg });
      } catch {
        res = new Response(JSON.stringify({}), { status: 599 });
      }
      if (callRef.current !== call) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(apiError(data, "Không thể bắt đầu cuộc gọi.", "Couldn't start the call."));
        teardown();
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (typeof d.callToken !== "string") {
        teardown();
        return;
      }
      call.token = d.callToken;
      setRinging(true);
      timers.current.ring = setTimeout(() => {
        if (callRef.current !== call || phaseRef.current !== "outgoing") return;
        endCall("timeout", { toast: tr(`${call.peer.name} không nghe máy.`, `${call.peer.name} didn't answer.`) });
      }, RING_TIMEOUT_MS);
      timers.current.reRing = setInterval(() => {
        if (callRef.current !== call || phaseRef.current !== "outgoing") return;
        postCall(call, "ring", { leg }).catch(() => {});
      }, RE_RING_MS);
    },
    [endCall, leg, postCall, teardown]
  );

  const dial = useCallback(
    async (call: ActiveCall, audioOnlyStream?: MediaStream) => {
      preloadCallSdk();
      getIce().catch(() => {});
      let stream = audioOnlyStream || null;
      if (!stream) {
        try {
          stream = await getCallMedia(call.type === "video", facingRef.current);
        } catch (err) {
          if (callRef.current !== call) return;
          // Video call: is it only the camera? Then offer "continue as voice call".
          if (call.type === "video" && classifyMediaError(err) !== "denied") {
            try {
              const a = await getCallMedia(false);
              if (callRef.current !== call) return stopStream(a);
              fallbackAudioRef.current = a;
              await showMediaError(err, "caller", { video: true, cameraOnly: true });
              setPhase("error");
              return;
            } catch {}
          }
          await showMediaError(err, "caller", { video: call.type === "video" });
          setPhase("error");
          return;
        }
      }
      if (callRef.current !== call) return stopStream(stream);
      streamRef.current = stream;
      const v = stream.getVideoTracks()[0] || null;
      camOnRef.current = !!v;
      setCamOn(!!v);
      setPreview(v ? new MediaStream([v]) : null);
      setVideoMode(!!v);
      countCameras().then((n) => callRef.current === call && setCanFlip(n > 1 || /Android|iPhone|iPad/i.test(navigator.userAgent)));
      setMediaError(null);
      setPhase("outgoing");
      try {
        if (!(await startEngine(call, stream, false))) return;
      } catch {
        if (callRef.current !== call) return;
        toast.error(tr("Trình duyệt này không gọi được.", "This browser can't make calls."));
        teardown();
        return;
      }
      await ringPeer(call);
    },
    [getIce, ringPeer, setPhase, showMediaError, startEngine, teardown]
  );

  const handleStartCall = useCallback(
    (partner: CallPartner, type: CallType) => {
      if (!partner || partner.isGroup) return;
      if (callRef.current) {
        toast.error(tr("Bạn đang trong một cuộc gọi khác.", "You're already on another call."));
        return;
      }
      if (!currentUserId || !getPusherClient()) {
        toast.error(tr("Cuộc gọi tạm thời không khả dụng.", "Calls are temporarily unavailable."));
        return;
      }
      // Trong lúc chạm: mở khoá âm thanh (iPhone / Chrome chỉ cho phát tiếng sau 1 thao tác của người dùng).
      unlockCallAudio();
      primeRingtone();
      const call: ActiveCall = {
        callId: randomId(12),
        token: null,
        peer: { id: partner.id, name: partner.name, avatarUrl: partner.avatarUrl || null },
        type,
        isCaller: true,
        remoteLeg: null,
        accepted: false,
        connectedAt: null,
        logged: false,
      };
      callRef.current = call;
      setPeer(call.peer);
      setCallType(type);
      setRemoteCam(type === "video");
      setMediaError(null);
      setPhase("outgoing");
      void dial(call);
    },
    [currentUserId, dial, setPhase]
  );

  // ---------- incoming ----------
  const answer = useCallback(
    async (call: ActiveCall) => {
      let stream: MediaStream | null = null;
      let firstErr: unknown = null;
      try {
        stream = await getCallMedia(call.type === "video", facingRef.current);
      } catch (err) {
        firstErr = err;
        if (call.type === "video" && classifyMediaError(err) !== "denied") {
          try {
            stream = await getCallMedia(false);
            toast(tr("Không mở được camera — bạn vào cuộc gọi chỉ với âm thanh.", "Camera unavailable — you joined with audio only."), { icon: "🎙️" });
          } catch (e2) {
            firstErr = e2;
          }
        }
      }
      if (callRef.current !== call) return stopStream(stream);
      if (!stream) {
        // Bên gọi thấy "<tên> không vào được (micro bị chặn)" + ghi cuộc gọi nhỡ.
        postCall(call, "reject", { reason: "media-error", socketId: getPusherClient()?.connection?.socket_id }).catch(() => {});
        await showMediaError(firstErr, "callee", { video: call.type === "video" });
        teardown({ keepError: true });
        return;
      }
      streamRef.current = stream;
      const v = stream.getVideoTracks()[0] || null;
      camOnRef.current = !!v;
      setCamOn(!!v);
      setPreview(v ? new MediaStream([v]) : null);
      setVideoMode(call.type === "video");
      countCameras().then((n) => callRef.current === call && setCanFlip(n > 1 || /Android|iPhone|iPad/i.test(navigator.userAgent)));
      try {
        if (!(await startEngine(call, stream, true))) return;
      } catch {
        if (callRef.current !== call) return;
        toast.error(tr("Trình duyệt này không gọi được.", "This browser can't make calls."));
        endCall("hangup");
        return;
      }
      const res = await postCall(call, "accept", { leg, socketId: getPusherClient()?.connection?.socket_id }).catch(() => null);
      if (callRef.current !== call) return;
      if (!res || !res.ok) {
        const data = res ? await res.json().catch(() => ({})) : {};
        toast.error(apiError(data, "Cuộc gọi không còn nữa.", "This call is no longer available."));
        teardown();
        return;
      }
      call.accepted = true;
      timers.current.connect = setTimeout(() => {
        if (callRef.current === call && phaseRef.current !== "connected") endCall("failed", { toast: tr("Không kết nối được cuộc gọi. Kiểm tra mạng rồi thử lại.", "Couldn't connect the call. Check your connection and try again.") });
      }, CONNECT_TIMEOUT_MS);
    },
    [endCall, leg, postCall, showMediaError, startEngine, teardown]
  );

  const handleAccept = useCallback(() => {
    const call = callRef.current;
    if (!call || phaseRef.current !== "incoming") return;
    unlockCallAudio();
    primeRingtone();
    stopRingtone();
    if (timers.current.ring) clearTimeout(timers.current.ring);
    timers.current.ring = undefined;
    setPhase("connecting");
    void answer(call);
  }, [answer, setPhase]);

  // Từ chối (máy đang đổ chuông), huỷ (đang gọi đi) hoặc cúp máy (đang nói).
  const handleHangUp = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const ph = phaseRef.current;
    if (ph === "incoming") endCall("decline");
    else if (ph === "outgoing") endCall("cancel");
    else if (ph === "error") teardown();
    else endCall("hangup");
  }, [endCall, teardown]);

  // ---------- incoming Pusher events ----------
  const handlers = useRef<{
    incoming: (d: IncomingData) => void;
    accepted: (d: { fromId?: string; callId?: string; leg?: string }) => void;
    rejected: (d: { fromId?: string; callId?: string; reason?: string }) => void;
    busy: (d: { fromId?: string; callId?: string }) => void;
    handled: (d: { callId?: string }) => void;
    signal: (d: SignalEvent) => void;
  } | null>(null);

  handlers.current = {
    incoming: (d) => {
      const callerId = d.callerId || d.fromId;
      if (!callerId || !d.callId || typeof d.callToken !== "string" || !d.callerLeg) return;
      if (endedRef.current.includes(d.callId)) return; // re-ring of a call that already ended / was answered elsewhere
      const cur = callRef.current;
      if (cur) {
        if (cur.callId === d.callId) return; // duplicate / re-ring of the call we already have
        // Both called each other at the same moment: the call with the smaller id wins, no "busy" for anyone.
        if (phaseRef.current === "outgoing" && cur.peer.id === callerId && !cur.accepted) {
          if (cur.callId > d.callId) {
            if (cur.token) postCall(cur, "reject", { reason: "cancel" }).catch(() => {});
            cur.logged = true;
            teardown();
          } else return;
        } else {
          // Đang trong cuộc gọi khác → báo bận cho người gọi thay vì để họ chờ mãi.
          fetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetId: callerId, action: "busy", callId: d.callId, callToken: d.callToken, socketId: getPusherClient()?.connection?.socket_id }),
          }).catch(() => {});
          return;
        }
      }
      const call: ActiveCall = {
        callId: d.callId,
        token: d.callToken,
        peer: { id: callerId, name: d.callerName || tr("Người dùng", "User"), avatarUrl: d.callerAvatar || null },
        type: d.callType === "video" ? "video" : "audio",
        isCaller: false,
        remoteLeg: d.callerLeg,
        accepted: false,
        connectedAt: null,
        logged: false,
      };
      callRef.current = call;
      setPeer(call.peer);
      setCallType(call.type);
      setRemoteCam(call.type === "video");
      setMediaError(null);
      setPhase("incoming");
      startRingtone("incoming");
      preloadCallSdk(); // tải màn hình gọi trong lúc đổ chuông
      getIce().catch(() => {});
      clearTimers();
      timers.current.ring = setTimeout(() => {
        if (callRef.current === call && phaseRef.current === "incoming") teardown();
      }, RING_TIMEOUT_MS + 2000);
    },
    accepted: (d) => {
      const call = callRef.current;
      if (!call || !call.isCaller || d.fromId !== call.peer.id || d.callId !== call.callId || phaseRef.current !== "outgoing" || !d.leg) return;
      stopRingtone();
      if (timers.current.ring) clearTimeout(timers.current.ring);
      if (timers.current.reRing) clearInterval(timers.current.reRing);
      timers.current.ring = timers.current.reRing = undefined;
      call.remoteLeg = d.leg;
      call.accepted = true;
      inboxRef.current?.setRemoteLeg(d.leg);
      outboxRef.current?.open(d.leg);
      setPhase("connecting");
      timers.current.connect = setTimeout(() => {
        if (callRef.current === call && phaseRef.current !== "connected") endCall("failed", { toast: tr("Không kết nối được cuộc gọi. Kiểm tra mạng rồi thử lại.", "Couldn't connect the call. Check your connection and try again.") });
      }, CONNECT_TIMEOUT_MS);
    },
    rejected: (d) => {
      const call = callRef.current;
      if (!call || d.fromId !== call.peer.id || d.callId !== call.callId) return;
      handleRemoteBye.current(call, d.reason || "hangup");
    },
    busy: (d) => {
      const call = callRef.current;
      if (!call || !call.isCaller || d.fromId !== call.peer.id || d.callId !== call.callId || phaseRef.current !== "outgoing") return;
      logCall("missed");
      toast.error(tr(`${call.peer.name || "Người nhận"} đang bận cuộc gọi khác.`, `${call.peer.name || "They"} are on another call.`));
      teardown();
    },
    handled: (d) => {
      // Máy khác của chính mình đã nghe / từ chối / báo bận → máy này ngừng đổ chuông, không ghi gì.
      const call = callRef.current;
      if (!call || call.isCaller || d.callId !== call.callId || phaseRef.current !== "incoming") return;
      teardown();
    },
    signal: (d) => {
      const call = callRef.current;
      if (!call || d?.fromId !== call.peer.id || d.callId !== call.callId) return;
      inboxRef.current?.push(d);
    },
  };

  handleRemoteBye.current = (call, reason) => {
    if (callRef.current !== call) return;
    const ph = phaseRef.current;
    const name = call.peer.name || tr("Người nhận", "They");
    if (ph === "outgoing") {
      if (reason === "media-error") {
        logCall("missed");
        toast.error(tr(`${name} không vào được cuộc gọi (${peerMediaReason()}).`, `${name} couldn't join (${peerMediaReason()}).`));
      } else {
        logCall("declined");
        toast.error(tr(`${name} đã từ chối cuộc gọi.`, `${name} declined the call.`));
      }
    } else if (ph === "incoming") {
      // Người gọi huỷ / hết giờ trước khi mình nghe máy.
      toast(tr(`Cuộc gọi nhỡ từ ${call.peer.name || "người dùng"}`, `Missed call from ${call.peer.name || "a user"}`), { icon: "📞" });
    } else if (ph === "connecting" || ph === "connected") {
      logCall(reason === "failed" && !call.connectedAt ? "missed" : "ended");
      toast(reason === "failed" ? tr("Cuộc gọi đã ngắt do mất kết nối.", "Call dropped — connection lost.") : tr("Cuộc gọi đã kết thúc.", "Call ended."), { icon: "📞" });
    }
    teardown();
  };

  useEffect(() => {
    if (!currentUserId) return;
    const channel = acquireUserChannel(currentUserId);
    if (!channel) return;
    const on = {
      incoming: (d: IncomingData) => handlers.current?.incoming(d),
      accepted: (d: { fromId?: string; callId?: string; leg?: string }) => handlers.current?.accepted(d),
      rejected: (d: { fromId?: string; callId?: string; reason?: string }) => handlers.current?.rejected(d),
      busy: (d: { fromId?: string; callId?: string }) => handlers.current?.busy(d),
      handled: (d: { callId?: string }) => handlers.current?.handled(d),
      signal: (d: SignalEvent) => handlers.current?.signal(d),
    };
    channel.bind("incoming-call", on.incoming);
    channel.bind("call-accepted", on.accepted);
    channel.bind("call-rejected", on.rejected);
    channel.bind("call-busy", on.busy);
    channel.bind("call-handled", on.handled);
    channel.bind("call-signal", on.signal);
    return () => {
      channel.unbind("incoming-call", on.incoming);
      channel.unbind("call-accepted", on.accepted);
      channel.unbind("call-rejected", on.rejected);
      channel.unbind("call-busy", on.busy);
      channel.unbind("call-handled", on.handled);
      channel.unbind("call-signal", on.signal);
      releaseUserChannel(currentUserId);
    };
  }, [currentUserId]);

  // Đăng xuất / gỡ component giữa cuộc gọi → kết thúc tử tế.
  useEffect(
    () => () => {
      if (callRef.current) endCall(phaseRef.current === "incoming" ? "decline" : phaseRef.current === "outgoing" ? "cancel" : "hangup");
      stopRingtone();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Đóng tab / tải lại trang giữa cuộc gọi: báo bên kia ngay (sendBeacon vẫn gửi được lúc trang đang đóng).
  useEffect(() => {
    const onPageHide = () => {
      const call = callRef.current;
      const ph = phaseRef.current;
      if (!call || !call.token || ph === "incoming" || ph === "error" || ph === "idle") return;
      const reason = ph === "outgoing" ? "cancel" : "hangup";
      try {
        navigator.sendBeacon?.(
          "/api/calls",
          new Blob([JSON.stringify({ targetId: call.peer.id, action: "reject", callId: call.callId, callToken: call.token, reason })], { type: "application/json" })
        );
      } catch {}
      if (call.isCaller) logCall(ph === "outgoing" ? "missed" : "ended", true);
      teardown();
    };
    // Màn hình tắt / chuyển app: camera điện thoại thường bị hệ điều hành dừng → báo "tạm dừng video";
    // quay lại thì mở lại camera / micro nếu track đã bị dừng.
    const onVisibility = async () => {
      const call = callRef.current;
      const ph = phaseRef.current;
      if (!call || (ph !== "connecting" && ph !== "connected")) return;
      const p = peerRef.current;
      const stream = streamRef.current;
      if (document.visibilityState === "hidden") {
        if (camOnRef.current) p?.sendCtl({ cam: "paused" });
        return;
      }
      if (!stream || !p) return;
      const a = stream.getAudioTracks()[0];
      if (!a || a.readyState === "ended") {
        try {
          const s = await getCallMedia(false);
          const na = s.getAudioTracks()[0];
          if (a) stream.removeTrack(a);
          na.enabled = a ? a.enabled : true;
          stream.addTrack(na);
          await p.replaceAudioTrack(na);
        } catch {}
      }
      if (camOnRef.current) {
        const v = stream.getVideoTracks()[0];
        if (!v || v.readyState === "ended") {
          try {
            const nv = await getCameraTrack(facingRef.current);
            if (v) stream.removeTrack(v);
            stream.addTrack(nv);
            await p.replaceVideoTrack(nv);
            setPreview(new MediaStream([nv]));
          } catch {}
        }
        p.sendCtl({ cam: true });
      }
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [logCall, teardown]);

  useEffect(() => {
    if (phase !== "outgoing" && phase !== "incoming") return;
    const t = setInterval(() => setRingSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Thẻ <audio> phát giọng bên kia nằm TRONG khung gọi → nút đổi loa (setSinkId) áp được cho nó.
  useEffect(() => {
    if (!rootEl) return;
    const a = callAudioElement();
    if (a && a.parentElement !== rootEl) rootEl.appendChild(a);
  }, [rootEl]);

  useImperativeHandle(ref, () => ({ startCall: handleStartCall }), [handleStartCall]);

  const speaker = useAudioOutput(rootEl, phase !== "idle");

  // ---------- in-call controls ----------
  const toggleMic = useCallback(() => {
    const next = !micOn;
    setMicOn(next);
    for (const t of streamRef.current?.getAudioTracks() || []) t.enabled = next;
    peerRef.current?.setMicEnabled(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || camBusy) return;
    setCamBusy(true);
    try {
      if (camOnRef.current) {
        for (const t of stream.getVideoTracks()) {
          t.stop(); // camera light off, not just a black frame
          stream.removeTrack(t);
        }
        await peerRef.current?.replaceVideoTrack(null);
        camOnRef.current = false;
        setCamOn(false);
        setPreview(null);
        peerRef.current?.sendCtl({ cam: false });
      } else {
        const v = await getCameraTrack(facingRef.current);
        if (!streamRef.current || streamRef.current !== stream) return v.stop();
        stream.addTrack(v);
        await peerRef.current?.replaceVideoTrack(v);
        camOnRef.current = true;
        setCamOn(true);
        setVideoMode(true);
        setPreview(new MediaStream([v]));
        peerRef.current?.sendCtl({ cam: true });
        countCameras().then((n) => setCanFlip(n > 1 || /Android|iPhone|iPad/i.test(navigator.userAgent)));
      }
    } catch (err) {
      await showMediaError(err, "camera", { video: true, cameraOnly: true });
    } finally {
      setCamBusy(false);
    }
  }, [camBusy, showMediaError]);

  const flipCamera = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || camBusy || !camOnRef.current) return;
    setCamBusy(true);
    const old = stream.getVideoTracks()[0] || null;
    const next: Facing = facingRef.current === "user" ? "environment" : "user";
    try {
      // Nhiều điện thoại không mở được 2 camera cùng lúc → dừng camera cũ TRƯỚC.
      old?.stop();
      const v = await getCameraTrack(next, { switchFrom: old });
      if (old) stream.removeTrack(old);
      stream.addTrack(v);
      await peerRef.current?.replaceVideoTrack(v);
      const f = (v.getSettings?.().facingMode as Facing | undefined) || next;
      facingRef.current = f === "environment" ? "environment" : "user";
      setFacing(facingRef.current);
      setPreview(new MediaStream([v]));
      peerRef.current?.sendCtl({ facing: facingRef.current });
    } catch (err) {
      // could not open the other camera: try to get the previous one back
      try {
        const v = await getCameraTrack(facingRef.current);
        if (old) stream.removeTrack(old);
        stream.addTrack(v);
        await peerRef.current?.replaceVideoTrack(v);
        setPreview(new MediaStream([v]));
      } catch {
        await showMediaError(err, "camera", { video: true, cameraOnly: true });
      }
    } finally {
      setCamBusy(false);
    }
  }, [camBusy, showMediaError]);

  const retryConnection = useCallback(() => {
    if (timers.current.failed) clearTimeout(timers.current.failed);
    timers.current.failed = undefined;
    peerRef.current?.retry();
  }, []);

  const messageInstead = useCallback(() => {
    const id = callRef.current?.peer.id;
    endCall("hangup");
    if (id) router.push(`/messages?to=${id}`);
  }, [endCall, router]);

  // Máy đang đổ chuông mà bận: từ chối + nhắn sẵn 1 câu (như "Trả lời bằng tin nhắn" của iPhone).
  const handleBusyReply = useCallback(() => {
    const p = callRef.current?.peer;
    if (!p) return;
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: p.id, content: tr("Mình đang bận chút, lát mình gọi lại nha 🙏", "I'm busy right now, I'll call you back soon 🙏") }),
    }).catch(() => {});
    handleHangUp();
  }, [handleHangUp]);

  // Lỗi micro / camera: thử lại (sau khi người dùng đã cho phép), chuyển sang gọi thoại, hoặc đóng.
  const retryMedia = useCallback(() => {
    const err = mediaError;
    const call = callRef.current;
    setMediaError(null);
    if (err?.role === "caller" && call) {
      stopStream(fallbackAudioRef.current);
      fallbackAudioRef.current = null;
      setPhase("outgoing");
      void dial(call);
    } else if (err?.role !== "camera") {
      teardown();
    }
  }, [dial, mediaError, setPhase, teardown]);

  const continueAsVoice = useCallback(() => {
    const call = callRef.current;
    const a = fallbackAudioRef.current;
    fallbackAudioRef.current = null;
    setMediaError(null);
    if (!call || !a) return teardown();
    call.type = "audio";
    setCallType("audio");
    setRemoteCam(false);
    setPhase("outgoing");
    void dial(call, a);
  }, [dial, setPhase, teardown]);

  const closeMediaError = useCallback(() => {
    const role = mediaError?.role;
    setMediaError(null);
    if (role !== "camera") teardown();
  }, [mediaError, teardown]);

  if (phase === "idle" || !peer) return null;

  const hasPhoto = !isPlaceholderAvatar(peer.avatarUrl);
  const typeLabel = callType === "video" ? tr("Cuộc gọi video", "Video call") : tr("Cuộc gọi thoại", "Voice call");
  const inRoom = phase === "connecting" || phase === "connected";
  const showOutgoingPreview = phase === "outgoing" && camOn && !!preview;

  return (
    <div
      ref={setRootEl}
      className="fixed inset-0 z-[2000] flex h-[100dvh] flex-col items-center justify-between overflow-clip bg-pn-canvas text-pn-text motion-safe:animate-fadeIn"
      role="dialog"
      aria-label={typeLabel}
      data-call-phase={phase}
      data-call-type={callType}
      data-call-ringing={ringing ? "1" : "0"}
    >
      {/* Nền: avatar đối phương phóng to + mờ, phủ gradient thương hiệu (hoặc camera của mình khi gọi video đi) */}
      <div className="absolute inset-0 -z-10 bg-pn-canvas">
        {showOutgoingPreview ? (
          <OutgoingPreview stream={preview} mirror={facing === "user"} />
        ) : (
          hasPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={peer.avatarUrl!} alt="" aria-hidden className="h-full w-full scale-125 object-cover opacity-35 blur-2xl" />
          )
        )}
        <div className={`absolute inset-0 bg-gradient-to-b ${showOutgoingPreview ? "from-pn-canvas/60 via-pn-canvas/30 to-pn-canvas/85" : "from-pn-canvas/70 via-pn-canvas/85 to-pn-canvas"}`} />
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-pn-brand/25 blur-[90px]" />
      </div>

      {inRoom ? (
        <CallScreen
          phase={phase as "connecting" | "connected"}
          peer={peer}
          video={videoMode}
          localStream={preview}
          localVideoOn={camOn}
          facing={facing}
          remoteVideo={remoteVideo}
          remoteVideoLive={remoteVideoLive}
          remoteCam={remoteCam}
          remoteMic={remoteMic}
          micOn={micOn}
          net={net}
          quality={quality}
          relay={relay}
          connectedAt={connectedAt}
          canFlip={canFlip}
          busy={camBusy}
          speaker={speaker}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onFlip={flipCamera}
          onHangUp={handleHangUp}
          onRetry={retryConnection}
          onMessageInstead={messageInstead}
        />
      ) : phase === "error" ? null : (
        <>
          <div className="flex flex-col items-center gap-1.5 pt-[max(2.5rem,env(safe-area-inset-top))]">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-pn-text-2 backdrop-blur-md">
              {callType === "video" ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
              {typeLabel}
            </span>
          </div>
          {/* Máy tính: gom vào 1 thẻ giữa màn hình. Điện thoại: toàn màn hình như cuộc gọi của máy. */}
          <div className="flex w-full flex-1 items-center justify-center pb-44 md:px-6 md:pb-0">
            <div className="flex w-full flex-col items-center gap-7 px-6 text-center md:max-w-md md:rounded-[2rem] md:border md:border-white/10 md:bg-white/[0.04] md:px-10 md:py-12 md:shadow-2xl md:shadow-black/40 md:backdrop-blur-2xl">
              <div className="relative">
                <span className="absolute -inset-4 rounded-full bg-pn-brand/20 motion-safe:animate-ping motion-safe:[animation-duration:2s]" />
                <span className="absolute -inset-8 rounded-full bg-pn-brand/10 motion-safe:animate-ping motion-safe:[animation-duration:2s]" style={{ animationDelay: "0.7s" }} />
                <Avatar src={peer.avatarUrl} name={peer.name} seed={peer.id} loading="eager" className="relative h-32 w-32 ring-4 ring-white/15 shadow-2xl shadow-black/40" />
              </div>
              <div className="space-y-2">
                <h2 className="text-[28px] font-black leading-tight tracking-tight text-pn-text">{peer.name}</h2>
                <p className="flex items-center justify-center gap-2 text-sm font-medium text-pn-text-2" data-call-status>
                  {callType === "video" ? <Video className="h-4 w-4 text-pn-brand-ink" /> : <Phone className="h-4 w-4 text-pn-brand-ink" />}
                  {phase === "incoming" ? tr(`${typeLabel} đến`, `Incoming ${typeLabel.toLowerCase()}`) : ringing ? tr("Đang đổ chuông", "Ringing") : tr("Đang gọi…", "Calling…")}
                  <span className="tabular-nums text-pn-text-3">
                    · {String(Math.floor(ringSecs / 60)).padStart(2, "0")}:{String(ringSecs % 60).padStart(2, "0")}
                  </span>
                </p>
              </div>

              {phase === "outgoing" && (
                // Điều khiển trước khi bên kia nghe máy — giữ nguyên khi vào cuộc gọi.
                <div className="flex items-start justify-center gap-5 pt-2">
                  <CallToggle on={micOn} onClick={toggleMic} label={micOn ? tr("Tắt tiếng", "Mute") : tr("Bật tiếng", "Unmute")} iconOn={<Mic className="h-6 w-6" />} iconOff={<MicOff className="h-6 w-6" />} data="mic" />
                  {speaker.canSwitch && <CallToggle on={speaker.isDefault} onClick={speaker.next} label={tr("Loa", "Speaker")} iconOn={<Volume2 className="h-6 w-6" />} iconOff={<Volume2 className="h-6 w-6" />} data="speaker" />}
                  {callType === "video" && (
                    <CallToggle on={camOn} onClick={toggleCam} label={camOn ? tr("Tắt camera", "Camera off") : tr("Bật camera", "Camera on")} iconOn={<Video className="h-6 w-6" />} iconOff={<VideoOff className="h-6 w-6" />} data="cam" />
                  )}
                </div>
              )}

              <div className="fixed inset-x-0 bottom-0 flex w-full flex-col items-center gap-5 px-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 motion-safe:animate-callSheetUp md:static md:mt-2 md:px-0 md:pb-0 md:pt-2">
                {phase === "incoming" && (
                  <button type="button" onClick={handleBusyReply} className="flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-pn-text ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-white/15">
                    <MessageCircle className="h-4 w-4" />
                    {tr("Bận — nhắn lại", "Busy — send a message")}
                  </button>
                )}
                <div className="flex items-center justify-center gap-20">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHangUp}
                      data-call-control={phase === "incoming" ? "decline" : "cancel"}
                      title={phase === "incoming" ? tr("Từ chối", "Decline") : tr("Huỷ cuộc gọi", "Cancel call")}
                      aria-label={phase === "incoming" ? tr("Từ chối", "Decline") : tr("Huỷ cuộc gọi", "Cancel call")}
                      className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-xl shadow-red-600/40 motion-safe:transition-transform hover:scale-105 active:scale-90"
                    >
                      <PhoneOff className="h-7 w-7 stroke-[2.5px]" />
                    </button>
                    <span className="text-xs font-semibold text-pn-text-2">{phase === "incoming" ? tr("Từ chối", "Decline") : tr("Kết thúc", "End")}</span>
                  </div>
                  {phase === "incoming" && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAccept}
                        data-call-control="answer"
                        title={tr("Trả lời", "Answer")}
                        aria-label={tr("Trả lời", "Answer")}
                        className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-xl shadow-emerald-500/40 motion-safe:transition-transform hover:scale-105 active:scale-90"
                      >
                        <span className="absolute inset-0 rounded-full bg-emerald-400/30 motion-safe:animate-ping motion-safe:[animation-duration:1.6s]" />
                        {callType === "video" ? <Video className="relative h-7 w-7 stroke-[2.5px]" /> : <Phone className="relative h-7 w-7 stroke-[2.5px]" />}
                      </button>
                      <span className="text-xs font-semibold text-pn-text-2">{tr("Trả lời", "Answer")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Trình duyệt vẫn chặn tự phát âm thanh → 1 nút chạm để nghe (không bao giờ im lặng mà không báo). */}
      {audioBlocked && inRoom && (
        <button
          type="button"
          data-call-audio-blocked
          onClick={() => {
            const a = callAudioElement();
            a?.play().then(() => setAudioBlocked(false)).catch(() => {});
          }}
          className="absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-50 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-pn-brand px-5 text-sm font-bold text-white shadow-xl"
        >
          <VolumeX className="h-4 w-4" />
          {tr("Chạm để bật âm thanh", "Tap to turn on sound")}
        </button>
      )}

      {mediaError && (
        <div data-call-error="media" data-call-error-kind={mediaError.kind} role="alertdialog" aria-label={mediaError.title} className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-pn-card bg-pn-surface p-6 text-center shadow-2xl ring-1 ring-pn-line motion-safe:animate-fadeIn">
            <ShieldAlert className="mx-auto h-9 w-9 text-pn-brand-ink" />
            <h3 className="mt-3 text-lg font-bold text-pn-text">{mediaError.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-pn-text-2">{mediaError.hint}</p>
            {mediaError.role === "callee" && <p className="mt-2 text-xs text-pn-text-3">{tr(`Đã báo cho ${peer.name} là bạn chưa vào được cuộc gọi.`, `${peer.name} was told you couldn't join.`)}</p>}
            <div className="mt-5 flex flex-col gap-2">
              {mediaError.canFallBackToVoice && mediaError.role === "caller" && (
                <button type="button" onClick={continueAsVoice} className="flex h-12 items-center justify-center gap-2 rounded-full bg-pn-brand font-bold text-white hover:bg-pn-brand-hover active:bg-pn-brand-press">
                  <Phone className="h-4 w-4" />
                  {tr("Tiếp tục gọi thoại", "Continue as voice call")}
                </button>
              )}
              {mediaError.role === "caller" && mediaError.kind !== "unsupported" && (
                <button type="button" onClick={retryMedia} className={`flex h-12 items-center justify-center gap-2 rounded-full font-bold ${mediaError.canFallBackToVoice ? "bg-pn-raised text-pn-text ring-1 ring-pn-line hover:bg-pn-overlay" : "bg-pn-brand text-white hover:bg-pn-brand-hover"}`}>
                  <RefreshCw className="h-4 w-4" />
                  {tr("Thử lại", "Try again")}
                </button>
              )}
              <button type="button" onClick={closeMediaError} className="h-12 rounded-full font-semibold text-pn-text-2 ring-1 ring-pn-line hover:text-pn-text">
                {tr("Đóng", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

interface IncomingData {
  fromId?: string;
  callerId: string;
  callerName?: string;
  callerAvatar?: string | null;
  callType?: CallType;
  callId?: string;
  callToken?: string;
  callerLeg?: string | null;
  ring?: boolean;
}

function OutgoingPreview({ stream, mirror }: { stream: MediaStream | null; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) el.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} muted autoPlay playsInline data-local-preview="ringing" className="h-full w-full object-cover" style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
}

function CallToggle({ on, onClick, label, iconOn, iconOff, data }: { on: boolean; onClick: () => void; label: string; iconOn: React.ReactNode; iconOff: React.ReactNode; data: string }) {
  return (
    <div className="flex w-16 flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        data-call-control={data}
        aria-pressed={!on}
        aria-label={label}
        className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md motion-safe:transition-all active:scale-90 ${on ? "bg-white/12 text-white ring-1 ring-white/15 hover:bg-white/20" : "bg-white text-pn-canvas"}`}
      >
        {on ? iconOn : iconOff}
      </button>
      <span className="text-[11px] font-semibold leading-tight text-pn-text-2">{label}</span>
    </div>
  );
}

export default CallManager;
