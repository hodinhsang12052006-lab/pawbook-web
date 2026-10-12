"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { uploadVoice } from "@/lib/mediaUpload";

// Thanh ghi âm thay cho ô nhập (như Messenger): chấm đỏ + đồng hồ + sóng âm theo giọng thật,
// 🗑 huỷ · ➤ gửi. Tối đa 2 phút (tự gửi khi hết giờ). Dưới 1 giây coi như bấm nhầm → bỏ.
const MAX_SECS = 120;
const BARS = 28;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

export default function VoiceRecorder({ onSend, onCancel }: { onSend: (url: string, secs: number) => void; onCancel: () => void }) {
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const [uploading, setUploading] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const startedAt = useRef(0);
  const sendOnStop = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const mime = pickMime();
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
        recRef.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        rec.onstop = () => finish(rec.mimeType || mime);
        rec.start(250);
        startedAt.current = Date.now();

        // Sóng âm thật theo micro (AnalyserNode) — cuộn từ phải sang trái.
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let last = 0;
        const tick = (t: number) => {
          raf = requestAnimationFrame(tick);
          const s = Math.floor((Date.now() - startedAt.current) / 1000);
          setSecs(s);
          if (s >= MAX_SECS) stop(true);
          if (t - last < 90) return;
          last = t;
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
          setLevels((prev) => [...prev.slice(1), Math.max(0.08, Math.min(1, peak / 64))]);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        const denied = (err as DOMException)?.name === "NotAllowedError";
        toast.error(denied ? tr("Bạn chưa cho phép dùng micro. Mở cài đặt trình duyệt / ứng dụng để bật micro.", "Microphone access is blocked. Enable it in your browser or app settings.") : tr("Máy không ghi âm được.", "Couldn't start recording."));
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }

  function stop(send: boolean) {
    if (doneRef.current) return;
    doneRef.current = true;
    sendOnStop.current = send;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else { cleanup(); if (!send) onCancel(); }
  }

  async function finish(mime: string) {
    cleanup();
    const dur = Math.round((Date.now() - startedAt.current) / 1000);
    if (!sendOnStop.current) return onCancel();
    if (dur < 1) { toast(tr("Giữ lâu hơn chút để ghi âm nhé", "Record a bit longer"), { icon: "🎤" }); return onCancel(); }
    setUploading(true);
    try {
      const url = await uploadVoice(new Blob(chunksRef.current, { type: mime || "audio/webm" }));
      onSend(url, Math.min(dur, MAX_SECS));
    } catch (e) {
      toast.error((e as Error).message || tr("Gửi tin nhắn thoại thất bại.", "Couldn't send the voice message."));
      onCancel();
    }
  }

  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2" role="group" aria-label={tr("Đang ghi âm", "Recording")}>
      <button type="button" onClick={() => stop(false)} disabled={uploading} aria-label={tr("Huỷ ghi âm", "Discard recording")} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-rose-400 hover:bg-rose-500/10 disabled:opacity-40">
        <Trash2 className="h-5 w-5" />
      </button>
      <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full bg-gradient-to-r from-pink-600/25 to-fuchsia-600/20 px-4 ring-1 ring-pink-500/30">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <span className="w-10 flex-shrink-0 text-sm font-bold tabular-nums text-white">{mm}</span>
        <div className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
          {levels.map((l, i) => (
            <span key={i} className="w-[3px] flex-shrink-0 rounded-full bg-white/85" style={{ height: `${Math.round(l * 100)}%` }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => stop(true)}
        disabled={uploading}
        aria-label={tr("Gửi tin nhắn thoại", "Send voice message")}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-md shadow-pink-500/30 active:scale-95"
      >
        {uploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px] -translate-x-px translate-y-px" />}
      </button>
    </div>
  );
}
