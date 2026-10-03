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
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
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
        navigator.vibrate?.([400, 200, 400]);
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
  try {
    navigator.vibrate?.(0);
  } catch {}
}
