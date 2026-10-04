"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Phone, Video, PhoneOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import Avatar from "@/components/ui/Avatar";
import { isPlaceholderAvatar } from "@/lib/avatar";

const VideoCallRoom = dynamic(() => import("@/components/chat/VideoCallRoom"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.75rem] bg-slate-950 text-slate-100">
      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      <p className="mt-2 text-xs text-slate-400">Đang kết nối cuộc gọi…</p>
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
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
}

export interface CallManagerHandle {
  startCall: (partner: CallPartner, type: "audio" | "video") => void;
}

type CallType = "audio" | "video";
// idle → outgoing (đang đổ chuông bên kia) / incoming (máy mình đang đổ chuông)
//      → connecting (đã nghe máy, đang vào phòng ZEGOCLOUD) → connected
type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "connected";

interface Peer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

// Không ai nghe máy sau ngần này thì tự kết thúc + ghi "cuộc gọi nhỡ".
const RING_TIMEOUT_MS = 45_000;

// Toàn bộ cuộc gọi chạy qua ZEGOCLOUD (cả thoại lẫn video — có máy chủ trung
// chuyển nên kết nối được qua 4G/5G); Pusher chỉ dùng để đổ chuông / nghe máy
// / từ chối / báo bận. Mount DUY NHẤT 1 lần ở root layout (xem
// lib/CallManagerContext.tsx) nên cuộc gọi không bị ngắt khi chuyển trang.
const CallManager = forwardRef<CallManagerHandle, CallManagerProps>(function CallManager(
  { currentUserId, currentUserName },
  ref
) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [callType, setCallType] = useState<CallType>("audio");
  const [peer, setPeer] = useState<Peer | null>(null);
  // Mỗi cuộc gọi 1 phòng riêng: gọi lại ngay sau khi cúp máy mà dùng chung
  // phòng cũ thì phiên cũ chưa kịp thoát hẳn trên ZEGOCLOUD → 2 phiên tranh
  // nhau, cuộc gọi mới không kết nối được.
  const [callId, setCallId] = useState("");

  // Handler Pusher chỉ bind 1 lần → đọc trạng thái mới nhất qua ref.
  const stateRef = useRef({ phase, callType, peer, isCaller: false });
  const isCallerRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const loggedRef = useRef(false);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = { phase, callType, peer, isCaller: isCallerRef.current };
  }, [phase, callType, peer]);

  const signal = useCallback((targetId: string, action: string, extra: Record<string, unknown> = {}) => {
    return fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, action, ...extra }),
    });
  }, []);

  // Nhật ký cuộc gọi trong khung chat ("Cuộc gọi nhỡ", "Cuộc gọi thoại · 2:05").
  // CHỈ người gọi ghi để không bị 2 dòng trùng.
  const logCall = useCallback((outcome: "missed" | "declined" | "ended") => {
    const s = stateRef.current;
    if (!s.peer || !isCallerRef.current || loggedRef.current) return;
    loggedRef.current = true;
    const seconds = outcome === "ended" && connectedAtRef.current ? Math.round((Date.now() - connectedAtRef.current) / 1000) : null;
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiverId: s.peer.id,
        type: "CALL",
        content: `${outcome}:${s.callType}${seconds !== null ? `:${seconds}` : ""}`,
      }),
    }).catch(() => {});
  }, []);

  const resetCall = useCallback(() => {
    stopRingtone();
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    ringTimerRef.current = null;
    connectedAtRef.current = null;
    isCallerRef.current = false;
    setPhase("idle");
    setPeer(null);
  }, []);

  // ---------- Tín hiệu đến qua Pusher ----------
  useEffect(() => {
    if (!currentUserId) return;
    const channel = acquireUserChannel(currentUserId);
    if (!channel) return;

    // Bỏ qua mọi tín hiệu không đến từ đúng đối phương của cuộc gọi hiện tại
    // (server gắn fromId từ session — không giả mạo được).
    const fromPeer = (data: { fromId?: string }) => !!stateRef.current.peer && data?.fromId === stateRef.current.peer.id;

    const onIncoming = (data: { fromId?: string; callerId: string; callerName?: string; callerAvatar?: string | null; callType?: CallType; callId?: string }) => {
      const callerId = data.callerId || data.fromId;
      if (!callerId) return;
      // Đang trong cuộc gọi khác → báo bận cho người gọi thay vì để họ chờ mãi.
      if (stateRef.current.phase !== "idle") {
        signal(callerId, "busy").catch(() => {});
        return;
      }
      isCallerRef.current = false;
      loggedRef.current = false;
      setPeer({ id: callerId, name: data.callerName || "Người dùng", avatarUrl: data.callerAvatar || null });
      setCallId(data.callId || "");
      setCallType(data.callType === "video" ? "video" : "audio");
      setPhase("incoming");
      startRingtone("incoming");
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        if (stateRef.current.phase === "incoming") resetCall();
      }, RING_TIMEOUT_MS + 2000);
    };

    const onAccepted = (data: { fromId?: string }) => {
      if (!fromPeer(data) || stateRef.current.phase !== "outgoing") return;
      stopRingtone();
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      setPhase("connecting");
    };

    const onRejected = (data: { fromId?: string }) => {
      if (!fromPeer(data)) return;
      const p = stateRef.current.phase;
      if (p === "outgoing") {
        logCall("declined");
        toast.error(`${stateRef.current.peer?.name || "Người nhận"} đã từ chối cuộc gọi.`);
      } else if (p === "incoming") {
        // Người gọi huỷ trước khi mình nghe máy.
        toast(`Cuộc gọi nhỡ từ ${stateRef.current.peer?.name || "người dùng"}`, { icon: "📞" });
      } else if (p === "connecting" || p === "connected") {
        logCall("ended");
        toast("Cuộc gọi đã kết thúc.", { icon: "📞" });
      }
      resetCall();
    };

    const onBusy = (data: { fromId?: string }) => {
      if (!fromPeer(data) || stateRef.current.phase !== "outgoing") return;
      logCall("missed");
      toast.error(`${stateRef.current.peer?.name || "Người nhận"} đang bận cuộc gọi khác.`);
      resetCall();
    };

    channel.bind("incoming-call", onIncoming);
    channel.bind("call-accepted", onAccepted);
    channel.bind("call-rejected", onRejected);
    channel.bind("call-busy", onBusy);
    return () => {
      channel.unbind("incoming-call", onIncoming);
      channel.unbind("call-accepted", onAccepted);
      channel.unbind("call-rejected", onRejected);
      channel.unbind("call-busy", onBusy);
      releaseUserChannel(currentUserId);
    };
  }, [currentUserId, signal, logCall, resetCall]);

  // Dừng chuông nếu component bị gỡ (đăng xuất…).
  useEffect(() => () => stopRingtone(), []);

  // ---------- Hành động của người dùng ----------
  const handleStartCall = useCallback(
    async (partner: CallPartner, type: CallType) => {
      if (!partner || partner.isGroup) return;
      if (stateRef.current.phase !== "idle") {
        toast.error("Bạn đang trong một cuộc gọi khác.");
        return;
      }
      isCallerRef.current = true;
      loggedRef.current = false;
      const nextPeer = { id: partner.id, name: partner.name, avatarUrl: partner.avatarUrl || null };
      stateRef.current = { phase: "outgoing", callType: type, peer: nextPeer, isCaller: true };
      const newCallId = Math.random().toString(36).slice(2, 10);
      setPeer(nextPeer);
      setCallId(newCallId);
      setCallType(type);
      setPhase("outgoing");
      startRingtone("outgoing");

      try {
        const res = await signal(partner.id, "offer", { callType: type, callId: newCallId });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể bắt đầu cuộc gọi.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể bắt đầu cuộc gọi.");
        resetCall();
        return;
      }

      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        if (stateRef.current.phase !== "outgoing") return;
        signal(partner.id, "reject").catch(() => {});
        logCall("missed");
        toast(`${partner.name} không nghe máy.`, { icon: "📞" });
        resetCall();
      }, RING_TIMEOUT_MS);
    },
    [signal, logCall, resetCall]
  );

  const handleAccept = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "incoming" || !s.peer) return;
    stopRingtone();
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    setPhase("connecting");
    signal(s.peer.id, "accept").catch(() => {});
  }, [signal]);

  // Từ chối (máy đang đổ chuông), huỷ (đang gọi đi) hoặc cúp máy (đang nói).
  const handleHangUp = useCallback(() => {
    const s = stateRef.current;
    if (!s.peer || s.phase === "idle") return;
    signal(s.peer.id, "reject").catch(() => {});
    if (s.phase === "outgoing") logCall("missed");
    else if (s.phase === "connecting" || s.phase === "connected") logCall("ended");
    resetCall();
  }, [signal, logCall, resetCall]);

  const handleConnected = useCallback(() => {
    if (!connectedAtRef.current) connectedAtRef.current = Date.now();
    setPhase("connected");
  }, []);

  const handlePeerLeft = useCallback(() => {
    // Đối phương rời phòng ZEGOCLOUD (cúp máy hoặc rớt mạng hẳn).
    if (stateRef.current.phase === "idle") return;
    logCall("ended");
    toast("Cuộc gọi đã kết thúc.", { icon: "📞" });
    resetCall();
  }, [logCall, resetCall]);

  useImperativeHandle(ref, () => ({ startCall: handleStartCall }), [handleStartCall]);

  if (phase === "idle" || !peer) return null;

  // roomId đối xứng: 2 bên luôn tính ra cùng 1 chuỗi bất kể ai gọi.
  const roomId = "call-" + [currentUserId, peer.id].sort().join("-") + (callId ? `-${callId}` : "");
  const hasPhoto = !isPlaceholderAvatar(peer.avatarUrl);
  const typeLabel = callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
  const inRoom = phase === "connecting" || phase === "connected";

  return (
    <>
    {/* overflow-clip (không phải overflow-hidden): giao diện mobile của
          ZEGOCLOUD tự focus phần tử bên trong khiến khung overflow-hidden bị
          cuộn ngang ~50px — cả màn hình gọi lệch trái, nút lật camera bị cắt,
          lộ trang chat phía sau. overflow-clip không cho cuộn kiểu đó. */}
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-between overflow-clip text-slate-100 animate-fadeIn" role="dialog" aria-label={typeLabel} data-call-phase={phase}>
      {/* Nền: avatar đối phương phóng to + mờ, phủ gradient thương hiệu */}
      <div className="absolute inset-0 -z-10 bg-slate-950">
        {hasPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peer.avatarUrl!} alt="" aria-hidden className="h-full w-full scale-125 object-cover opacity-35 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/85 to-slate-950" />
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-pink-600/25 blur-[90px]" />
      </div>

      <div className={`flex-col items-center gap-1.5 pt-[max(2.5rem,env(safe-area-inset-top))] ${inRoom ? "hidden md:flex" : "flex"}`}>
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-200 backdrop-blur-md">
          {callType === "video" ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
          {typeLabel}
        </span>
        {inRoom && <p className="text-sm font-bold text-white">{peer.name}</p>}
      </div>

      {inRoom ? (
        // Đã nghe máy: phòng ZEGOCLOUD chiếm phần giữa, dùng thanh điều khiển
        // của chính ZEGOCLOUD (mic / camera / thiết bị / cúp máy).
        // Mobile: TOÀN MÀN HÌNH — giao diện mobile của ZEGOCLOUD được thiết kế
        // cho khung full-screen (bỏ vào khung có lề thì bị lệch, nút cúp máy
        // tràn ra ngoài). Desktop: khung lớn giữa màn hình.
        <div className="absolute inset-0 md:inset-auto md:bottom-6 md:left-1/2 md:top-24 md:w-[min(960px,92vw)] md:-translate-x-1/2">
          <VideoCallRoom
            roomId={roomId}
            userId={currentUserId}
            userName={currentUserName || "Người dùng"}
            mode={callType}
            peerId={peer.id}
            onConnected={handleConnected}
            onLeave={handleHangUp}
            onPeerLeft={handlePeerLeft}
          />
          {phase === "connecting" && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur">
              Đang chờ {peer.name} vào cuộc gọi…
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 px-6 text-center">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-pink-500/25" />
              <span className="absolute -inset-3 animate-ping rounded-full bg-fuchsia-500/10" style={{ animationDelay: "0.5s" }} />
              <Avatar src={peer.avatarUrl} name={peer.name} seed={peer.id} loading="eager" className="relative h-32 w-32 ring-4 ring-white/10 shadow-2xl" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black tracking-tight text-white">{peer.name}</h2>
              <p className="text-sm font-semibold text-slate-300">
                {phase === "incoming" ? `${typeLabel} đến…` : "Đang đổ chuông…"}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center justify-center gap-16 rounded-t-[2rem] border-t border-white/10 bg-white/[0.03] px-10 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 backdrop-blur-2xl animate-callSheetUp">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleHangUp}
                title={phase === "incoming" ? "Từ chối" : "Huỷ cuộc gọi"}
                aria-label={phase === "incoming" ? "Từ chối" : "Huỷ cuộc gọi"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-xl shadow-red-500/30 transition-transform hover:scale-105 active:scale-90"
              >
                <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
              </button>
              <span className="text-[11px] font-semibold text-slate-400">{phase === "incoming" ? "Từ chối" : "Huỷ"}</span>
            </div>
            {phase === "incoming" && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  title="Trả lời"
                  aria-label="Trả lời"
                  className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-90"
                >
                  {callType === "video" ? <Video className="h-6 w-6 stroke-[2.5px]" /> : <Phone className="h-6 w-6 stroke-[2.5px]" />}
                </button>
                <span className="text-[11px] font-semibold text-slate-400">Trả lời</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </>
  );
});

export default CallManager;
