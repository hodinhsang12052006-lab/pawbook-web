"use client";

// Âm "ting" báo tin nhắn mới, tổng hợp trực tiếp bằng Web Audio API — không
// cần file audio asset nào (nhẹ, không lo bản quyền, không tốn 1 request
// mạng). Hai nốt ngắn tăng dần nghe giống "ting" của Messenger/Zalo hơn 1
// tiếng bíp đơn điệu.
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function playTone(ctx: AudioContext, freq: number, startAt: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function playNotifySound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // Trình duyệt có thể tạo AudioContext ở trạng thái "suspended" cho tới
    // khi có tương tác người dùng đầu tiên trong trang — resume() là no-op
    // an toàn nếu đã "running" rồi.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.14);
    playTone(ctx, 1318.5, now + 0.09, 0.18);
  } catch {
    // Không có mic/audio output hoặc trình duyệt chặn — bỏ qua âm thanh,
    // không được để tính năng phụ này làm gãy luồng nhận tin nhắn.
  }
}
