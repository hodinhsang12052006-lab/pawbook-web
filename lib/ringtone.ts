"use client";

// Nhạc chuông / tiếng chờ cuộc gọi bằng Web Audio (không cần file âm thanh).
// Trước đây cuộc gọi đến hoàn toàn IM LẶNG — điện thoại trong túi là không
// biết có người gọi.
// - "incoming": chuông 2 nốt lặp lại + rung (Android) cho người nhận.
// - "outgoing": tiếng "tút… tút…" cho người gọi trong lúc chờ nghe máy.
// Trình duyệt có thể chặn âm thanh khi người dùng chưa từng chạm vào trang
// (autoplay policy) — khi đó vẫn còn rung + giao diện đổ chuông.

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
// Each cycle schedules its notes ahead of time (up to ~1.5 s): stopRingtone() must stop those too, or the ring keeps
// sounding after Answer / Decline and the ringback plays over the first "hello".
const live = new Set<OscillatorNode>();
// True only while a ring vibration pattern was actually accepted by navigator.vibrate(): stopRingtone() runs on every
// call-UI cleanup (layout remounts included) with no user gesture, and an unconditional vibrate(0) there is what
// Chrome logs as "[Intervention] Blocked call to navigator.vibrate".
let vibrating = false;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, duration: number, volume: number) {
  const c = audioCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.setValueAtTime(volume, t0 + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, t0 + duration);
  osc.connect(gain).connect(c.destination);
  live.add(osc);
  osc.onended = () => {
    live.delete(osc);
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {}
  };
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function silence() {
  for (const o of live) {
    try {
      o.stop();
    } catch {}
  }
  live.clear();
}

/** Gọi đồng bộ trong thao tác chạm (bấm gọi / nghe máy): mở khoá Web Audio cho tiếng chờ / chuông. */
export function primeRingtone() {
  audioCtx();
}

export function startRingtone(kind: "incoming" | "outgoing") {
  stopRingtone();
  const play = () => {
    try {
      if (kind === "incoming") {
        tone(880, 0, 0.35, 0.18);
        tone(660, 0.4, 0.35, 0.18);
        tone(880, 0.8, 0.35, 0.18);
        tone(660, 1.2, 0.35, 0.18);
        if (navigator.vibrate?.([400, 200, 400])) vibrating = true;
      } else {
        tone(440, 0, 1.0, 0.08);
        tone(480, 0, 1.0, 0.06);
      }
    } catch {
      /* không phát được âm thanh — giao diện đổ chuông vẫn hiện */
    }
  };
  play();
  timer = setInterval(play, kind === "incoming" ? 2500 : 3000);
}

export function stopRingtone() {
  if (timer) clearInterval(timer);
  timer = null;
  silence();
  if (!vibrating) return;
  vibrating = false;
  try {
    navigator.vibrate?.(0);
  } catch {}
}

/** Short tone when a call ends: "end" = two falling notes (hang-up), "busy" = three short beeps (busy / declined). */
export function playEndTone(kind: "end" | "busy" = "end") {
  stopRingtone();
  try {
    if (kind === "busy") {
      tone(480, 0, 0.22, 0.08);
      tone(480, 0.45, 0.22, 0.08);
      tone(480, 0.9, 0.22, 0.08);
    } else {
      tone(620, 0, 0.16, 0.09);
      tone(460, 0.2, 0.24, 0.09);
    }
  } catch {}
}
