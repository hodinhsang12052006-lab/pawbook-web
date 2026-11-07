"use client";

// In-call screen for PawNail's own 1:1 WebRTC calls (replaces the ZEGOCLOUD room). Purely presentational: media,
// signaling and state live in components/chat/CallManager.tsx, which renders this inside its [data-call-phase] root.
//   - phones: full screen (100dvh, safe areas); remote video covers the screen, local preview is a draggable tile
//     that snaps to the nearest corner above the controls
//   - voice: avatar + name + timer / status, same control row (camera button upgrades to video)
//   - big tap targets (56 px, end 72 px), v2 warm tokens, motion only with motion-safe:
import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Volume2, WifiOff, MessageCircle, RefreshCw, Signal } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useTr } from "@/lib/i18n/useTr";

export type CallNet = "new" | "connecting" | "connected" | "reconnecting" | "failed" | "closed";
export type CallQuality = "good" | "fair" | "poor";
type Corner = "tl" | "tr" | "bl" | "br";

export interface CallScreenProps {
  phase: "connecting" | "connected";
  peer: { id: string; name: string; avatarUrl: string | null };
  /** video layout (either side has a camera on, or it started as a video call) */
  video: boolean;
  localStream: MediaStream | null;
  localVideoOn: boolean;
  facing: "user" | "environment";
  remoteVideo: MediaStream | null;
  /** remote camera frames are actually arriving */
  remoteVideoLive: boolean;
  remoteCam: boolean | "paused";
  remoteMic: boolean;
  micOn: boolean;
  net: CallNet;
  quality: CallQuality | null;
  relay: boolean;
  connectedAt: number | null;
  canFlip: boolean;
  busy: boolean;
  speaker: { canSwitch: boolean; next: () => void; label: string; isDefault: boolean };
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlip: () => void;
  onHangUp: () => void;
  onRetry: () => void;
  onMessageInstead: () => void;
}

function useClock(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function MediaVideo({ stream, mirror, className, label }: { stream: MediaStream | null; mirror?: boolean; className?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) el.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      // audio is played by CallManager's single unlocked <audio> element — never twice
      muted
      autoPlay
      playsInline
      aria-label={label}
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

export default function CallScreen(p: CallScreenProps) {
  const { tr } = useTr();
  const timer = useClock(p.phase === "connected" ? p.connectedAt : null);
  const [corner, setCorner] = useState<Corner>("tr");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; rect: DOMRect; moved: boolean } | null>(null);

  const remoteShowing = p.video && p.remoteVideoLive && p.remoteCam === true;
  const status =
    p.net === "reconnecting"
      ? tr("Đang kết nối lại…", "Reconnecting…")
      : p.phase === "connecting" || p.net === "connecting" || p.net === "new"
        ? tr("Đang kết nối…", "Connecting…")
        : timer || "00:00";
  const weak = p.phase === "connected" && p.net === "connected" && p.quality === "poor";

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, rect: el.getBoundingClientRect(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStart.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) < 6) return;
    s.moved = true;
    setDrag({ x: dx, y: dy });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s || !s.moved) {
      setDrag(null);
      return;
    }
    const cx = s.rect.left + s.rect.width / 2 + (e.clientX - s.x);
    const cy = s.rect.top + s.rect.height / 2 + (e.clientY - s.y);
    setCorner(`${cy < window.innerHeight / 2 ? "t" : "b"}${cx < window.innerWidth / 2 ? "l" : "r"}` as Corner);
    setDrag(null);
  };
  const cornerStyle: React.CSSProperties = {
    ...(corner[0] === "t" ? { top: "calc(max(0.75rem, env(safe-area-inset-top)) + 4.5rem)" } : { bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 8.5rem)" }),
    ...(corner[1] === "l" ? { left: "max(0.75rem, env(safe-area-inset-left))" } : { right: "max(0.75rem, env(safe-area-inset-right))" }),
    ...(drag ? { transform: `translate3d(${drag.x}px, ${drag.y}px, 0)` } : {}),
  };

  const peerChip = !p.remoteMic ? (
    <span data-peer-muted-chip className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-pn-text ring-1 ring-white/10 backdrop-blur">
      <MicOff className="h-3.5 w-3.5" />
      {tr("Đã tắt tiếng", "Muted")}
    </span>
  ) : null;

  return (
    <div
      className="absolute inset-0 flex h-[100dvh] flex-col overflow-hidden bg-pn-canvas text-pn-text"
      data-call-net={p.net === "new" ? "connecting" : p.net}
      data-call-quality={p.quality || ""}
      data-call-relay={p.relay ? "1" : "0"}
      data-peer-muted={p.remoteMic ? "0" : "1"}
      data-peer-cam={p.remoteCam === "paused" ? "paused" : p.remoteCam ? (remoteShowing ? "1" : "pending") : "0"}
      data-call-video={p.video ? "1" : "0"}
    >
      {/* ---------- stage ---------- */}
      {p.video ? (
        <div className="absolute inset-0">
          <MediaVideo stream={p.remoteVideo} label={tr(`Video của ${p.peer.name}`, `${p.peer.name}'s video`)} className={`h-full w-full object-cover transition-opacity duration-300 ${remoteShowing ? "opacity-100" : "opacity-0"}`} />
          {!remoteShowing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-pn-canvas-top to-pn-canvas">
              <Avatar src={p.peer.avatarUrl} name={p.peer.name} seed={p.peer.id} loading="eager" className="h-28 w-28 ring-4 ring-white/10" />
              <p className="text-lg font-bold">{p.peer.name}</p>
              <span className="rounded-full bg-pn-raised px-3 py-1 text-xs font-semibold text-pn-text-2 ring-1 ring-pn-line">
                {p.remoteCam === "paused" ? tr("Video tạm dừng", "Video paused") : p.remoteCam === false ? tr("Camera đang tắt", "Camera off") : tr("Đang chờ video…", "Waiting for video…")}
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-pn-canvas-top via-pn-canvas to-pn-canvas">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-pn-brand/20 blur-[90px]" />
        </div>
      )}

      {/* ---------- top bar ---------- */}
      <div className="relative z-10 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {p.video ? (
          <div className="min-w-0 pt-1">
            <p className="truncate text-base font-bold drop-shadow">{p.peer.name}</p>
            <p className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-white/85" data-call-status>
              {status}
            </p>
          </div>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 items-center gap-2">
          {p.phase === "connected" && p.quality && (
            <span
              title={p.quality === "good" ? tr("Kết nối tốt", "Good connection") : p.quality === "fair" ? tr("Kết nối trung bình", "Fair connection") : tr("Mạng yếu", "Weak connection")}
              className={`flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold ring-1 backdrop-blur ${p.quality === "good" ? "bg-black/30 text-emerald-300 ring-white/10" : p.quality === "fair" ? "bg-black/30 text-pn-champagne ring-pn-champagne-line" : "bg-rose-950/60 text-rose-200 ring-rose-400/30"}`}
            >
              <Signal className="h-4 w-4" />
              <span className="sr-only">{p.quality}</span>
            </span>
          )}
          {p.speaker.canSwitch && (
            <button
              type="button"
              onClick={p.speaker.next}
              title={p.speaker.label || tr("Đổi loa", "Switch speaker")}
              className="flex h-12 items-center gap-1.5 rounded-full bg-black/35 px-3.5 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/50"
            >
              <Volume2 className="h-4 w-4" />
              <span className="max-w-[8rem] truncate">{p.speaker.isDefault ? tr("Loa", "Speaker") : p.speaker.label || tr("Loa", "Speaker")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------- voice layout ---------- */}
      {!p.video && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-40 text-center">
          <div className="relative">
            {p.phase === "connecting" && <span className="absolute -inset-4 rounded-full bg-pn-brand/15 motion-safe:animate-ping motion-safe:[animation-duration:2s]" />}
            <Avatar src={p.peer.avatarUrl} name={p.peer.name} seed={p.peer.id} loading="eager" className="relative h-32 w-32 ring-4 ring-white/10 shadow-2xl shadow-black/40" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[28px] font-black leading-tight tracking-tight">{p.peer.name}</h2>
            <p className="text-sm font-semibold tabular-nums text-pn-text-2" data-call-status>
              {status}
            </p>
          </div>
          <div className="flex min-h-7 flex-wrap items-center justify-center gap-2">
            {peerChip}
            {weak && <span className="rounded-full bg-rose-950/60 px-2.5 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/30">{tr("Mạng yếu", "Weak connection")}</span>}
          </div>
        </div>
      )}

      {/* ---------- video overlays (chips, reconnecting) ---------- */}
      {p.video && (
        <div className="pointer-events-none relative z-10 mt-2 flex flex-wrap items-center justify-center gap-2 px-4">
          {peerChip}
          {weak && <span className="rounded-full bg-rose-950/70 px-2.5 py-1 text-[11px] font-semibold text-rose-100 ring-1 ring-rose-400/30">{tr("Mạng yếu", "Weak connection")}</span>}
        </div>
      )}
      {p.net === "reconnecting" && (
        <div role="status" className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 backdrop-blur">
          <RefreshCw className="h-4 w-4 motion-safe:animate-spin" />
          {tr("Đang kết nối lại…", "Reconnecting…")}
        </div>
      )}

      {/* ---------- local preview ---------- */}
      {p.video && p.localVideoOn && p.localStream && (
        <div
          data-local-preview={corner}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={cornerStyle}
          className={`absolute z-20 aspect-[3/4] w-[28vw] min-w-[96px] max-w-[176px] touch-none select-none overflow-hidden rounded-2xl bg-pn-surface shadow-xl shadow-black/50 ring-1 ring-white/15 md:w-[176px] ${drag ? "cursor-grabbing" : "cursor-grab motion-safe:transition-[top,left,right,bottom] motion-safe:duration-200"}`}
        >
          <MediaVideo stream={p.localStream} mirror={p.facing === "user"} label={tr("Camera của bạn", "Your camera")} className="pointer-events-none h-full w-full object-cover" />
        </div>
      )}

      {/* ---------- controls ---------- */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex w-full max-w-md items-end justify-center gap-3 sm:gap-5">
          <Control
            label={p.micOn ? tr("Tắt tiếng", "Mute") : tr("Bật tiếng", "Unmute")}
            pressed={!p.micOn}
            onClick={p.onToggleMic}
            icon={p.micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            data="mic"
          />
          <Control
            label={p.localVideoOn ? tr("Tắt camera", "Stop video") : tr("Bật camera", "Start video")}
            pressed={!p.localVideoOn}
            onClick={p.onToggleCam}
            disabled={p.busy}
            icon={p.localVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            data="cam"
          />
          {p.canFlip && p.localVideoOn && <Control label={tr("Đổi camera", "Flip")} onClick={p.onFlip} disabled={p.busy} icon={<SwitchCamera className="h-6 w-6" />} data="flip" />}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              data-call-control="end"
              onClick={p.onHangUp}
              aria-label={tr("Kết thúc cuộc gọi", "End call")}
              title={tr("Kết thúc cuộc gọi", "End call")}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-xl shadow-red-600/40 motion-safe:transition-transform hover:brightness-110 active:scale-90"
            >
              <PhoneOff className="h-7 w-7 stroke-[2.5px]" />
            </button>
            <span className="text-[11px] font-semibold text-white/85">{tr("Kết thúc", "End")}</span>
          </div>
        </div>
      </div>

      {/* ---------- connection lost ---------- */}
      {p.net === "failed" && (
        <div data-call-error="network" role="alertdialog" aria-label={tr("Mất kết nối", "Connection lost")} className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-pn-card bg-pn-surface p-6 text-center shadow-2xl ring-1 ring-pn-line motion-safe:animate-fadeIn">
            <WifiOff className="mx-auto h-9 w-9 text-pn-brand-ink" />
            <h3 className="mt-3 text-lg font-bold">{tr("Mất kết nối", "Connection lost")}</h3>
            <p className="mt-1 text-sm text-pn-text-2">
              {p.relay
                ? tr("Không giữ được kết nối với " + p.peer.name + ". Kiểm tra mạng rồi thử lại.", "Couldn't keep the connection to " + p.peer.name + ". Check your network and try again.")
                : tr("Không kết nối được tới " + p.peer.name + ". Thử lại, hoặc chuyển sang Wi-Fi.", "Couldn't reach " + p.peer.name + ". Try again, or switch to Wi-Fi.")}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={p.onRetry} className="flex h-12 items-center justify-center gap-2 rounded-full bg-pn-brand font-bold text-white hover:bg-pn-brand-hover active:bg-pn-brand-press">
                <RefreshCw className="h-4 w-4" />
                {tr("Thử lại", "Retry")}
              </button>
              <button type="button" onClick={p.onMessageInstead} className="flex h-12 items-center justify-center gap-2 rounded-full bg-pn-raised font-bold text-pn-text ring-1 ring-pn-line hover:bg-pn-overlay">
                <MessageCircle className="h-4 w-4" />
                {tr("Nhắn tin thay thế", "Message instead")}
              </button>
              <button type="button" onClick={p.onHangUp} className="h-12 rounded-full font-semibold text-pn-text-2 hover:text-pn-text">
                {tr("Kết thúc cuộc gọi", "End call")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Control({ label, pressed, onClick, icon, disabled, data }: { label: string; pressed?: boolean; onClick: () => void; icon: React.ReactNode; disabled?: boolean; data: string }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1.5">
      <button
        type="button"
        data-call-control={data}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed === undefined ? undefined : pressed}
        aria-label={label}
        title={label}
        className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md motion-safe:transition-[background-color,transform] active:scale-90 disabled:opacity-50 ${
          pressed ? "bg-white text-pn-canvas" : "bg-white/12 text-white ring-1 ring-white/15 hover:bg-white/20"
        }`}
      >
        {icon}
      </button>
      <span className="text-center text-[11px] font-semibold leading-tight text-white/85">{label}</span>
    </div>
  );
}
