"use client";

// Hệ thống âm thanh giao diện của PawNail — tổng hợp trực tiếp bằng Web Audio
// (không file âm thanh: nhẹ, không request mạng, không lo bản quyền).
//
//   message        tin nhắn mới (đang ở trang khác)     — "pling" 2 nốt kiểu Messenger
//   messageInChat  tin nhắn đến trong khung chat đang mở — "bóp" bong bóng nhẹ
//   sent           gửi tin thành công                    — "vút" ngắn
//   notify         chuông thông báo (thích, bình luận…)  — chuông kim loại ngân
//   urgent         việc gấp gần bạn                      — 3 nốt đi lên, rõ hơn
//   like           thả tim                               — "pop" + lấp lánh
//   success        đăng bài / đăng tin / gửi đánh giá    — hợp âm trưởng đi lên
//
// Tôn trọng người dùng: bật/tắt tổng, chỉnh âm lượng, bật/tắt từng nhóm (lưu
// trên thiết bị); chống phát dồn dập; hiệu ứng thao tác không kêu khi tab ẩn.

export type SoundKind = "message" | "messageInChat" | "sent" | "notify" | "urgent" | "like" | "success";
type Group = "messages" | "notifications" | "effects";

const GROUP_OF: Record<SoundKind, Group> = {
  message: "messages",
  messageInChat: "messages",
  sent: "messages",
  notify: "notifications",
  urgent: "notifications",
  like: "effects",
  success: "effects",
};

export interface SoundPrefs {
  enabled: boolean;
  volume: number; // 0..1
  messages: boolean;
  notifications: boolean;
  effects: boolean;
  vibrate: boolean;
}

const PREFS_KEY = "pn_sound_prefs";
export const DEFAULT_PREFS: SoundPrefs = { enabled: true, volume: 0.7, messages: true, notifications: true, effects: true, vibrate: true };

export function getSoundPrefs(): SoundPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setSoundPrefs(patch: Partial<SoundPrefs>): SoundPrefs {
  const next = { ...getSoundPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new CustomEvent("sound-prefs-change", { detail: next }));
  return next;
}

// ---------- Âm thanh ----------
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    // Nén nhẹ để các âm chồng nhau không bị rè/vỡ tiếng.
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return { c: ctx, out: master! };
}

// Trình duyệt chỉ cho phát âm thanh sau lần chạm/bấm đầu tiên — "mở khoá"
// AudioContext ngay lần tương tác đầu để tin nhắn đến sau đó kêu được.
if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

interface ToneOpts {
  freq: number;
  to?: number; // trượt tần số tới
  at?: number; // giây, tính từ bây giờ
  dur: number;
  vol: number;
  type?: OscillatorType;
  attack?: number;
}

function tone(c: AudioContext, out: GainNode, o: ToneOpts) {
  const t0 = c.currentTime + (o.at ?? 0) + 0.005;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur * 0.6);
  const atk = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

// Chuông kim loại: các hoạ âm "không hài hoà" tắt dần ở tốc độ khác nhau.
function bell(c: AudioContext, out: GainNode, freq: number, at: number, vol: number, dur = 1.1) {
  [
    [1, 1],
    [2.76, 0.45],
    [5.4, 0.22],
    [8.93, 0.08],
  ].forEach(([ratio, amp], i) => tone(c, out, { freq: freq * ratio, at, dur: dur / (1 + i * 0.6), vol: vol * amp, attack: 0.004 }));
}

const RECIPES: Record<SoundKind, (c: AudioContext, out: GainNode) => void> = {
  message: (c, out) => {
    tone(c, out, { freq: 1318.5, to: 1396.9, dur: 0.16, vol: 0.32, type: "sine" });
    tone(c, out, { freq: 1318.5 * 2, dur: 0.08, vol: 0.05, type: "sine" });
    tone(c, out, { freq: 1760, to: 1864.7, at: 0.11, dur: 0.24, vol: 0.3, type: "sine" });
    tone(c, out, { freq: 1760 * 2, at: 0.11, dur: 0.1, vol: 0.04, type: "sine" });
  },
  messageInChat: (c, out) => {
    tone(c, out, { freq: 520, to: 980, dur: 0.09, vol: 0.22, type: "sine", attack: 0.004 });
  },
  sent: (c, out) => {
    tone(c, out, { freq: 1500, to: 700, dur: 0.12, vol: 0.12, type: "sine", attack: 0.004 });
  },
  notify: (c, out) => {
    bell(c, out, 1046.5, 0, 0.22);
    bell(c, out, 1568, 0.13, 0.16, 0.9);
  },
  urgent: (c, out) => {
    [1046.5, 1318.5, 1568].forEach((f, i) => bell(c, out, f, i * 0.12, 0.2, 0.7));
    bell(c, out, 2093, 0.38, 0.14, 1.0);
  },
  like: (c, out) => {
    tone(c, out, { freq: 600, to: 1250, dur: 0.1, vol: 0.2, type: "sine", attack: 0.003 });
    tone(c, out, { freq: 2637, at: 0.06, dur: 0.12, vol: 0.05, type: "triangle" });
    tone(c, out, { freq: 3520, at: 0.1, dur: 0.1, vol: 0.035, type: "triangle" });
  },
  success: (c, out) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, out, { freq: f, at: i * 0.07, dur: 0.32, vol: 0.16, type: "triangle" }));
  },
};

const VIBRATE: Partial<Record<SoundKind, number | number[]>> = {
  message: [30, 40, 30],
  notify: 25,
  urgent: [60, 60, 60, 60, 120],
};

const lastPlayed = new Map<SoundKind, number>();
const MIN_GAP_MS = 700;

/** Phát 1 hiệu ứng âm thanh (tôn trọng cài đặt người dùng). `force` dùng cho nút "Nghe thử". */
export function playSound(kind: SoundKind, opts: { force?: boolean } = {}) {
  try {
    const prefs = getSoundPrefs();
    if (!opts.force) {
      if (!prefs.enabled || !prefs[GROUP_OF[kind]]) return;
      // Hiệu ứng thao tác chỉ có nghĩa khi người dùng đang nhìn màn hình.
      if (GROUP_OF[kind] === "effects" && document.hidden) return;
      const last = lastPlayed.get(kind) ?? 0;
      if (Date.now() - last < MIN_GAP_MS) return;
    }
    lastPlayed.set(kind, Date.now());
    const a = audio();
    if (a) {
      a.out.gain.setValueAtTime(Math.max(0, Math.min(1, prefs.volume)) * 1.4, a.c.currentTime);
      RECIPES[kind](a.c, a.out);
    }
    // Báo "đã phát âm X" — dùng cho kiểm thử tự động (không có tai) và thống kê.
    window.dispatchEvent(new CustomEvent("pn-sound", { detail: { kind, forced: !!opts.force } }));
    const v = VIBRATE[kind];
    if (v && prefs.vibrate && !opts.force && "vibrate" in navigator) navigator.vibrate(v);
  } catch {
    // Không có thiết bị âm thanh / trình duyệt chặn — bỏ qua, không làm gãy luồng chính.
  }
}
