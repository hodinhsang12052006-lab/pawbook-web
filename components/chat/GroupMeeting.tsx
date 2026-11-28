"use client";

// HỌP NHÓM video (kiểu Zoom) trong nhóm chat: WebRTC mesh — mỗi cặp người 1 kết nối, tối đa 8 người.
// Tín hiệu qua /api/group-calls → kênh riêng của từng người (gc-join / gc-leave / gc-signal). Cặp nào cũng chỉ 1 bên
// tạo offer: người có id LỚN hơn (dù ai vào trước) → không bao giờ 2 offer chồng nhau.
// STUN/TURN: cùng danh sách với cuộc gọi 1-1 (/api/calls/ice) → qua 4G cần TURN đã cấu hình đúng.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, MonitorUp, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import toast from "react-hot-toast";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { createIceClient } from "@/lib/calls/iceClient";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { apiError } from "@/lib/i18n/apiError";

export interface MeetingMember { id: string; name: string | null; avatarUrl: string | null }
type Signal = { type: "offer" | "answer"; sdp: string } | { type: "ice"; candidates: RTCIceCandidateInit[] };
interface Peer { pc: RTCPeerConnection; stream: MediaStream | null; pendingIce: RTCIceCandidateInit[]; outIce: RTCIceCandidateInit[]; iceTimer: ReturnType<typeof setTimeout> | null }

const post = (body: object) =>
  fetch("/api/group-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }));

/** Đang có ai họp trong nhóm này (để hiện "Đang họp · N người — Tham gia" ở đầu khung chat). */
export function useGroupMeetingCount(convId: string | null, meId: string | null | undefined): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!convId || !meId) return;
    let live = true;
    fetch(`/api/group-calls?c=${encodeURIComponent(convId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d) setCount((d.members || []).length); })
      .catch(() => {});
    const ch = acquireUserChannel(meId);
    const onEv = (d: { c?: string; count?: number }) => { if (d?.c === convId && typeof d.count === "number") setCount(d.count); };
    ch?.bind("gc-join", onEv);
    ch?.bind("gc-leave", onEv);
    return () => {
      live = false;
      ch?.unbind("gc-join", onEv);
      ch?.unbind("gc-leave", onEv);
      releaseUserChannel(meId);
    };
  }, [convId, meId]);
  return count;
}

function Tile({ stream, name, self, mirrored, muted }: { stream: MediaStream | null; name: string; self?: boolean; mirrored?: boolean; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    const check = () => setHasVideo(!!stream && stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled && !t.muted));
    check();
    const iv = setInterval(check, 1000);
    if (stream) v.play().catch(() => {});
    return () => clearInterval(iv);
  }, [stream]);
  const initials = (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div data-gm-tile={self ? "me" : name} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#17111c] ring-1 ring-white/10">
      <video ref={ref} autoPlay playsInline muted={self || muted} className={`h-full w-full object-cover ${hasVideo ? "" : "invisible"} ${mirrored ? "-scale-x-100" : ""}`} />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-fuchsia-700 text-xl font-bold text-white">{initials}</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{self ? tr("Bạn", "You") : name}</span>
    </div>
  );
}

export default function GroupMeeting({ convId, groupName, me, members, onClose }: { convId: string; groupName: string; me: { id: string; name: string | null }; members: MeetingMember[]; onClose: () => void }) {
  useTr();
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, MediaStream | null>>({});
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [state, setState] = useState<"joining" | "in" | "full" | "error">("joining");
  const [elapsed, setElapsed] = useState(0);
  const peersRef = useRef(new Map<string, Peer>());
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStreamTrack | null>(null);
  const iceRef = useRef<RTCIceServer[]>([]);
  const leftRef = useRef(false);
  const nameOf = useCallback((id: string) => members.find((m) => m.id === id)?.name || tr("Thành viên", "Member"), [members]);

  const send = useCallback((to: string, data: Signal) => post({ c: convId, action: "signal", to, data }), [convId]);

  const closePeer = useCallback((id: string) => {
    const p = peersRef.current.get(id);
    if (!p) return;
    try { p.pc.close(); } catch {}
    if (p.iceTimer) clearTimeout(p.iceTimer);
    peersRef.current.delete(id);
    setPeers((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const ensurePeer = useCallback((id: string): Peer => {
    const have = peersRef.current.get(id);
    if (have) return have;
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    const peer: Peer = { pc, stream: null, pendingIce: [], outIce: [], iceTimer: null };
    peersRef.current.set(id, peer);
    const tracks = localRef.current?.getTracks() ?? [];
    for (const t of tracks) {
      const out = t.kind === "video" && screenRef.current ? screenRef.current : t;
      pc.addTrack(out, localRef.current!);
    }
    pc.ontrack = (e) => {
      peer.stream = e.streams[0] || new MediaStream([e.track]);
      setPeers((prev) => ({ ...prev, [id]: peer.stream }));
    };
    // ICE gom 250 ms / lần gửi (ít request hơn)
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      peer.outIce.push(e.candidate.toJSON());
      if (!peer.iceTimer) peer.iceTimer = setTimeout(() => {
        const batch = peer.outIce.splice(0);
        peer.iceTimer = null;
        if (batch.length) send(id, { type: "ice", candidates: batch });
      }, 250);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce?.();
    };
    setPeers((prev) => (id in prev ? prev : { ...prev, [id]: null }));
    return peer;
  }, [send]);

  const call = useCallback(async (id: string) => {
    const p = ensurePeer(id);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    await send(id, { type: "offer", sdp: offer.sdp || "" });
  }, [ensurePeer, send]);

  const onSignal = useCallback(async (from: string, data: Signal) => {
    if (leftRef.current) return;
    const p = ensurePeer(from);
    try {
      if (data.type === "offer") {
        await p.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        for (const c of p.pendingIce.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        const answer = await p.pc.createAnswer();
        await p.pc.setLocalDescription(answer);
        await send(from, { type: "answer", sdp: answer.sdp || "" });
      } else if (data.type === "answer") {
        await p.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        for (const c of p.pendingIce.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
      } else if (data.type === "ice") {
        for (const c of data.candidates || []) {
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {});
          else p.pendingIce.push(c);
        }
      }
    } catch (e) {
      console.warn("group meeting signal:", e);
    }
  }, [ensurePeer, send]);

  const leave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    post({ c: convId, action: "leave" }).catch(() => {});
    for (const id of [...peersRef.current.keys()]) closePeer(id);
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.stop();
    onClose();
  }, [convId, closePeer, onClose]);

  // Vào phòng: mic + camera (không có camera → chỉ tiếng), ICE, kênh tín hiệu, rồi báo máy chủ
  useEffect(() => {
    let cancelled = false;
    const ch = acquireUserChannel(me.id);
    const onSig = (d: { c?: string; from?: string; data?: Signal }) => { if (d?.c === convId && d.from && d.data) onSignal(d.from, d.data); };
    const onJoin = (d: { c?: string; userId?: string }) => {
      if (d?.c !== convId || !d.userId || d.userId === me.id || leftRef.current || !localRef.current) return;
      if (me.id > d.userId) call(d.userId).catch(() => {});
      else ensurePeer(d.userId);
    };
    const onLeave = (d: { c?: string; userId?: string }) => { if (d?.c === convId && d.userId) closePeer(d.userId); };
    ch?.bind("gc-signal", onSig);
    ch?.bind("gc-join", onJoin);
    ch?.bind("gc-leave", onLeave);
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setCam(false);
        } catch {
          toast.error(tr("Không bật được micro / camera. Cho phép trong cài đặt trình duyệt rồi thử lại.", "Couldn't start your microphone or camera. Allow them in your browser settings and try again."));
          setState("error");
          return;
        }
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      localRef.current = stream;
      setLocal(stream);
      try {
        let storage: Storage | null = null;
        try { storage = window.sessionStorage; } catch {}
        iceRef.current = (await createIceClient(me.id, { storage }).get()).servers;
      } catch {
        iceRef.current = [{ urls: ["stun:stun.l.google.com:19302"] }];
      }
      const r = await post({ c: convId, action: "join" });
      if (cancelled) return;
      if (!r.ok) {
        if (r.status === 429) setState("full");
        else setState("error");
        toast.error(apiError(r.data, "Không vào được cuộc họp.", "Couldn't join the meeting."));
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setState("in");
      for (const id of (r.data.members || []) as string[]) {
        if (me.id > id) call(id).catch(() => {});
        else ensurePeer(id);
      }
    })();
    const hb = setInterval(() => { if (!leftRef.current) post({ c: convId, action: "heartbeat" }).catch(() => {}); }, 20_000);
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    const onUnload = () => { if (!leftRef.current) navigator.sendBeacon?.("/api/group-calls", new Blob([JSON.stringify({ c: convId, action: "leave" })], { type: "application/json" })); };
    window.addEventListener("pagehide", onUnload);
    return () => {
      cancelled = true;
      clearInterval(hb);
      clearInterval(tick);
      window.removeEventListener("pagehide", onUnload);
      ch?.unbind("gc-signal", onSig);
      ch?.unbind("gc-join", onJoin);
      ch?.unbind("gc-leave", onLeave);
      releaseUserChannel(me.id);
      if (!leftRef.current) {
        leftRef.current = true;
        post({ c: convId, action: "leave" }).catch(() => {});
        for (const p of peersRef.current.values()) { try { p.pc.close(); } catch {} }
        localRef.current?.getTracks().forEach((t) => t.stop());
        screenRef.current?.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, me.id]);

  const toggleMic = () => {
    const on = !mic;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = on));
    setMic(on);
  };
  const toggleCam = () => {
    const on = !cam;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = on));
    setCam(on);
  };
  const replaceVideo = async (track: MediaStreamTrack | null) => {
    for (const p of peersRef.current.values()) {
      const s = p.pc.getSenders().find((x) => x.track?.kind === "video" || (x.track === null && x !== undefined));
      if (s) await s.replaceTrack(track).catch(() => {});
    }
  };
  const toggleShare = async () => {
    if (sharing) {
      screenRef.current?.stop();
      screenRef.current = null;
      await replaceVideo(localRef.current?.getVideoTracks()[0] ?? null);
      setSharing(false);
      return;
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const t = ds.getVideoTracks()[0];
      screenRef.current = t;
      t.onended = () => { if (screenRef.current === t) { screenRef.current = null; replaceVideo(localRef.current?.getVideoTracks()[0] ?? null); setSharing(false); } };
      await replaceVideo(t);
      setSharing(true);
    } catch {
      /* người dùng huỷ chọn màn hình */
    }
  };

  const ids = Object.keys(peers);
  const total = ids.length + 1;
  const cols = total <= 1 ? "grid-cols-1" : total <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const btn = "flex h-12 w-12 items-center justify-center rounded-full transition-colors";

  return (
    <div data-gm-root={state} className="fixed inset-0 z-[130] flex flex-col bg-[#0f0b12] text-slate-100" role="dialog" aria-label={tr(`Họp nhóm ${groupName}`, `${groupName} meeting`)}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{groupName}</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="h-3.5 w-3.5" /> <span data-gm-count>{total}</span> {tr("người", total === 1 ? "person" : "people")}
            <span aria-hidden>·</span> {state === "in" ? `${mm}:${ss}` : state === "joining" ? tr("Đang vào…", "Joining…") : state === "full" ? tr("Cuộc họp đã đủ người", "Meeting is full") : tr("Không vào được", "Couldn't join")}
          </p>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className={`mx-auto grid max-w-6xl gap-3 ${cols}`}>
          <Tile stream={local} name={me.name || ""} self mirrored={!sharing} />
          {ids.map((id) => <Tile key={id} stream={peers[id]} name={nameOf(id)} />)}
        </div>
        {state === "in" && ids.length === 0 && (
          <p className="mt-4 text-center text-sm text-slate-400">{tr("Đang chờ thành viên khác vào họp… Mọi người trong nhóm đã nhận thông báo.", "Waiting for others to join… Everyone in the group has been notified.")}</p>
        )}
      </main>
      <footer className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
        <button type="button" data-gm-mic={mic ? "on" : "off"} onClick={toggleMic} aria-label={mic ? tr("Tắt micro", "Mute") : tr("Bật micro", "Unmute")} className={`${btn} ${mic ? "bg-white/10 hover:bg-white/15" : "bg-white text-slate-900"}`}>
          {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button type="button" data-gm-cam={cam ? "on" : "off"} onClick={toggleCam} aria-label={cam ? tr("Tắt camera", "Stop video") : tr("Bật camera", "Start video")} className={`${btn} ${cam ? "bg-white/10 hover:bg-white/15" : "bg-white text-slate-900"}`}>
          {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        {typeof navigator !== "undefined" && !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices && (
          <button type="button" data-gm-share={sharing ? "on" : "off"} onClick={toggleShare} aria-label={sharing ? tr("Dừng chia sẻ màn hình", "Stop sharing") : tr("Chia sẻ màn hình", "Share screen")} className={`${btn} hidden sm:flex ${sharing ? "bg-emerald-500 text-white" : "bg-white/10 hover:bg-white/15"}`}>
            <MonitorUp className="h-5 w-5" />
          </button>
        )}
        <button type="button" data-gm-leave onClick={leave} aria-label={tr("Rời cuộc họp", "Leave meeting")} className="flex h-12 items-center gap-2 rounded-full bg-rose-600 px-5 font-bold text-white hover:bg-rose-500">
          <PhoneOff className="h-5 w-5" /> {tr("Rời họp", "Leave")}
        </button>
      </footer>
    </div>
  );
}
