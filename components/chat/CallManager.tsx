"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Volume2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { getPusherClient } from "@/lib/pusher";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const VideoCallRoom = dynamic(() => import("@/components/chat/VideoCallRoom"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-[480px] w-full bg-slate-950 text-slate-100 rounded-3xl border border-slate-800">
      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      <p className="mt-2 text-xs text-slate-400">Đang khởi tạo đường truyền cuộc gọi bảo mật ZEGOCLOUD...</p>
    </div>
  ),
});

interface CallPartner {
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
  activePartner: CallPartner | null;
}

export interface CallManagerHandle {
  startCall: (type: "audio" | "video") => void;
  canCall: boolean;
}

function CallTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <p className="text-3xs text-emerald-450 font-bold tracking-widest font-mono uppercase bg-slate-900 border border-slate-800 px-3 py-1 rounded-full animate-pulse shadow-md">
      🟢 Thời lượng cuộc gọi: {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
    </p>
  );
}

const AVATAR_FALLBACK = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=ffffff&bold=true`;

// Entirely self-contained: owns its own Pusher subscription for call
// signaling (separate from the messaging channel binding in
// MessagesContent), its own WebRTC peer connection, and its own render tree.
// MessagesContent mounts exactly ONE instance of this UNCONDITIONALLY at the
// top of its JSX (not nested inside "activeChat ? ... : ..."), so neither
// switching chats, receiving a message, nor deselecting the chat entirely
// (e.g. the mobile "Back" button) ever unmounts it mid-call. The header's
// call-trigger buttons live in MessagesContent and reach this component via
// the imperative `startCall` handle exposed below.
const CallManager = forwardRef<CallManagerHandle, CallManagerProps>(function CallManager(
  { currentUserId, currentUserName, currentUserAvatar, activePartner },
  ref
) {
  const { t } = useLanguage();

  const [showCallingModal, setShowCallingModal] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [callConnected, setCallConnected] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState<{ id: string; name: string } | null>(null);
  // Snapshot of who we're calling, captured once at call start — activePartner
  // can change under us (user switches chats mid-call) but the modal must
  // keep showing whoever the call is actually with.
  const [calleeSnapshot, setCalleeSnapshot] = useState<CallPartner | null>(null);

  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callerSignalRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<any[]>([]);

  const showCallingModalRef = useRef(showCallingModal);
  showCallingModalRef.current = showCallingModal;
  const receivingCallRef = useRef(receivingCall);
  receivingCallRef.current = receivingCall;

  const cleanupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setShowCallingModal(false);
    setCallConnected(false);
    setReceivingCall(false);
    setCallerInfo(null);
    setCalleeSnapshot(null);
    callerSignalRef.current = null;
    setMicMuted(false);
    setCameraMuted(false);
    pendingCandidatesRef.current = [];
  }, []);

  // Own Pusher subscription — bound once for the whole session (deps: just
  // currentUserId), fully independent of the messaging channel binding.
  useEffect(() => {
    if (!currentUserId) return;

    const pusher = getPusherClient();
    const channelName = `private-chat-${currentUserId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("incoming-call", (data: any) => {
      if (showCallingModalRef.current || receivingCallRef.current) return;
      setReceivingCall(true);
      setCallerInfo({ id: data.callerId, name: data.callerName });
      setCallType(data.callType || "audio");
      callerSignalRef.current = data.sdp;
    });

    channel.bind("call-candidate", async (data: any) => {
      if (!peerConnection.current) return;
      const candidate = new RTCIceCandidate(data.candidate);
      if (peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(candidate);
        } catch (e) {
          console.error("Error adding candidate:", e);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    });

    channel.bind("call-accepted", async (data: any) => {
      if (!peerConnection.current || peerConnection.current.signalingState !== "have-local-offer") return;
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        setCallConnected(true);
        for (const cand of pendingCandidatesRef.current) {
          try {
            await peerConnection.current.addIceCandidate(cand);
          } catch (err) {
            console.error("Error flushing candidate:", err);
          }
        }
        pendingCandidatesRef.current = [];
      } catch (err) {
        console.error("Failed to accept call answer sdp:", err);
      }
    });

    channel.bind("call-rejected", () => {
      toast.error("Cuộc gọi đã bị từ chối hoặc kết thúc.");
      cleanupCall();
    });

    channel.bind("camera-status", (data: any) => {
      setCameraMuted(Boolean(data.videoOff));
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [currentUserId, cleanupCall]);

  const setupPeerConnection = useCallback((remoteTargetId: string) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerConnection.current = pc;

    pc.ontrack = (event) => {
      if (!remoteAudioRef.current) return;
      let rStream = remoteAudioRef.current.srcObject as MediaStream;
      if (!rStream) {
        rStream = new MediaStream();
        remoteAudioRef.current.srcObject = rStream;
      }
      event.streams[0].getTracks().forEach((track) => {
        if (!rStream.getTracks().some((t) => t.id === track.id)) rStream.addTrack(track);
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: remoteTargetId, action: "candidate", candidate: event.candidate }),
      });
    };

    return pc;
  }, []);

  const handleStartCall = useCallback(async (type: "audio" | "video") => {
    if (!activePartner || activePartner.isGroup) return;
    setCalleeSnapshot(activePartner);
    setCallType(type);
    setShowCallingModal(true);
    setCallConnected(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video" ? { width: 640, height: 480 } : false,
      });
      localStreamRef.current = stream;

      const pc = setupPeerConnection(activePartner.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: activePartner.id, action: "offer", callType: type, sdp: offer }),
      });
    } catch (err) {
      console.error("Start call failed:", err);
      toast.error("Không thể truy cập camera hoặc micro.");
      cleanupCall();
    }
  }, [activePartner, setupPeerConnection, cleanupCall]);

  const handleAcceptCall = useCallback(async () => {
    if (!callerInfo) return;
    setReceivingCall(false);
    setShowCallingModal(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { width: 640, height: 480 } : false,
      });
      localStreamRef.current = stream;

      const pc = setupPeerConnection(callerInfo.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(callerSignalRef.current));
      setCallConnected(true);

      for (const cand of pendingCandidatesRef.current) {
        try {
          await pc.addIceCandidate(cand);
        } catch (err) {
          console.error("Error flushing candidate:", err);
        }
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: callerInfo.id, action: "accept", sdp: answer }),
      });
    } catch (err) {
      console.error("Accept call failed:", err);
      toast.error("Không thể kết nối cuộc gọi.");
      cleanupCall();
    }
  }, [callerInfo, callType, setupPeerConnection, cleanupCall]);

  const handleEndCall = useCallback(async () => {
    const targetId = calleeSnapshot?.id || callerInfo?.id;
    if (targetId) {
      try {
        await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId, action: "reject" }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    cleanupCall();
  }, [calleeSnapshot, callerInfo, cleanupCall]);

  const toggleMic = () => {
    const nextMute = !micMuted;
    setMicMuted(nextMute);
    localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !nextMute));
    toast.success(nextMute ? "🔇 Đã tắt micro" : "🎤 Đã bật micro");
  };

  const toggleCamera = () => {
    const nextMute = !cameraMuted;
    setCameraMuted(nextMute);
    localStreamRef.current?.getVideoTracks().forEach((track) => (track.enabled = !nextMute));
    const targetId = calleeSnapshot?.id || callerInfo?.id;
    if (targetId) {
      fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, action: "camera", videoOff: nextMute }),
      });
    }
  };

  const displayName = calleeSnapshot?.name || callerInfo?.name || "";
  const displayAvatar = calleeSnapshot?.avatarUrl || AVATAR_FALLBACK(displayName);
  const roomId = calleeSnapshot?.conversationId || "call-room-" + (calleeSnapshot?.id || callerInfo?.id || "unknown");

  // Exposed to MessagesContent so the header (which only exists while a chat
  // is open) can trigger a call without this component needing to live
  // inside that conditional — this component itself stays mounted always.
  useImperativeHandle(ref, () => ({
    startCall: handleStartCall,
    canCall: Boolean(activePartner && !activePartner.isGroup),
  }), [handleStartCall, activePartner]);

  return (
    <>

      {/* OUTGOING / ACTIVE CALL OVERLAY */}
      {showCallingModal && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between text-slate-100 overflow-hidden animate-fadeIn">
          <div className="absolute inset-0 -z-10">
            <img src={displayAvatar} alt="" aria-hidden className="w-full h-full object-cover scale-125 blur-2xl opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />
          </div>

          <div className="flex flex-col items-center space-y-2 pt-[max(3rem,env(safe-area-inset-top))] animate-scaleUp">
            <span className="bg-white/5 border border-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              {callType === "video" ? t("callUI.videoCallSecure") : t("callUI.audioCallSecure")}
            </span>
            <p className="text-3xs text-slate-400 font-semibold italic">{t("callUI.encryptedNote")}</p>
          </div>

          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl z-10 ring-4 ring-black/20">
                <img src={displayAvatar} alt={displayName} className="object-cover w-full h-full rounded-full" />
              </div>
              <div className="absolute inset-0 h-32 w-32 rounded-full bg-blue-500/20 animate-ping z-0 scale-110" />
              <div className="absolute inset-0 h-32 w-32 rounded-full bg-indigo-500/10 animate-ping z-0 scale-125" style={{ animationDelay: "0.5s" }} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-xl font-black text-slate-100 tracking-tight">{displayName}</h2>
              {callConnected ? (
                <CallTimer active={callConnected} />
              ) : (
                <p className="text-xs text-slate-300 font-semibold animate-pulse">
                  {t("callUI.calling")} {callType === "video" ? "Video" : "Audio"}...
                </p>
              )}
            </div>
          </div>

          {callConnected && callType === "audio" && (
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          )}

          {callConnected && callType === "video" && (
            <div className="absolute inset-x-3 top-28 bottom-36 bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl z-20 flex items-center justify-center">
              <VideoCallRoom
                roomId={roomId}
                userId={currentUserId}
                userName={currentUserName}
                onLeave={handleEndCall}
              />
            </div>
          )}

          <div className="w-full flex items-center justify-center gap-6 z-30 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 px-6 bg-white/[0.03] backdrop-blur-2xl border-t border-white/10 rounded-t-[2rem] animate-callSheetUp">
            {!callConnected ? (
              <>
                <button
                  type="button"
                  onClick={handleAcceptCall}
                  className="h-16 w-16 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 hover:scale-105 active:scale-90 transition-transform duration-200 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 cursor-pointer"
                  title={t("callUI.accept")}
                >
                  <Phone className="h-6 w-6 stroke-[2.5px]" />
                </button>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="h-16 w-16 rounded-full bg-gradient-to-b from-rose-500 to-red-600 hover:scale-105 active:scale-90 transition-transform duration-200 text-white flex items-center justify-center shadow-xl shadow-red-500/30 cursor-pointer"
                  title={t("callUI.decline")}
                >
                  <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`h-13 w-13 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${micMuted ? "bg-white text-slate-900" : "bg-white/10 border border-white/10 text-slate-100 hover:bg-white/15"}`}
                  title={micMuted ? t("callUI.unmute") : t("callUI.mute")}
                >
                  {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="h-16 w-16 rounded-full bg-gradient-to-b from-rose-500 to-red-600 text-white flex items-center justify-center cursor-pointer shadow-xl shadow-red-500/30 transition-transform duration-200 hover:scale-105 active:scale-90"
                  title={t("callUI.endCall")}
                >
                  <PhoneOff className="h-6 w-6" />
                </button>

                {callType === "audio" ? (
                  <button
                    type="button"
                    onClick={() => toast.success("🔊 Đã chuyển sang loa ngoài")}
                    className="h-13 w-13 rounded-full bg-white/10 border border-white/10 text-slate-100 hover:bg-white/15 flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-90"
                    title={t("callUI.speaker")}
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`h-13 w-13 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${cameraMuted ? "bg-white text-slate-900" : "bg-white/10 border border-white/10 text-slate-100 hover:bg-white/15"}`}
                    title={cameraMuted ? t("callUI.cameraOn") : t("callUI.cameraOff")}
                  >
                    {cameraMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* INCOMING CALL OVERLAY */}
      {receivingCall && callerInfo && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-between text-slate-100 overflow-hidden animate-fadeIn">
          <div className="absolute inset-0 -z-10">
            <img src={AVATAR_FALLBACK(callerInfo.name)} alt="" aria-hidden className="w-full h-full object-cover scale-125 blur-2xl opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />
          </div>

          <div className="flex flex-col items-center space-y-2 pt-[max(3rem,env(safe-area-inset-top))] animate-scaleUp">
            <span className="bg-blue-500/15 border border-blue-500/30 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-blue-300 uppercase tracking-widest flex items-center gap-1.5">
              📞 {t("callUI.ringing")}
            </span>
          </div>

          <div className="flex flex-col items-center space-y-6 max-w-sm text-center px-6">
            <div className="relative">
              <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl z-10 ring-4 ring-black/20">
                <img src={AVATAR_FALLBACK(callerInfo.name)} alt={callerInfo.name} className="object-cover w-full h-full rounded-full" />
              </div>
              <div className="absolute inset-0 h-32 w-32 rounded-full bg-blue-500/20 animate-ping z-0 scale-110" />
              <div className="absolute inset-0 h-32 w-32 rounded-full bg-indigo-500/10 animate-ping z-0 scale-125" style={{ animationDelay: "0.5s" }} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-sm font-semibold text-slate-300">{t("callUI.incoming")}</h2>
              <p className="text-xl font-black text-slate-100 tracking-tight">{callerInfo.name}</p>
            </div>
          </div>

          <div className="w-full flex items-center justify-around gap-6 z-30 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 px-10 bg-white/[0.03] backdrop-blur-2xl border-t border-white/10 rounded-t-[2rem] animate-callSheetUp">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleEndCall}
                className="h-16 w-16 rounded-full bg-gradient-to-b from-rose-500 to-red-600 text-white flex items-center justify-center shadow-xl shadow-red-500/30 cursor-pointer hover:scale-105 active:scale-90 transition-transform duration-200"
                title={t("callUI.decline")}
              >
                <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
              </button>
              <span className="text-[10px] font-semibold text-slate-400">{t("callUI.decline")}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAcceptCall}
                className="h-16 w-16 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 cursor-pointer hover:scale-105 active:scale-90 transition-transform duration-200 animate-pulse"
                title={t("callUI.accept")}
              >
                <Phone className="h-6 w-6 stroke-[2.5px]" />
              </button>
              <span className="text-[10px] font-semibold text-slate-400">{t("callUI.accept")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default CallManager;
