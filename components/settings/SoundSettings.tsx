"use client";

import React, { useEffect, useState } from "react";
import { Volume2, VolumeX, Play, MessageCircle, Bell, Sparkles, Smartphone, BellRing } from "lucide-react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/pushClient";
import { DEFAULT_PREFS, getSoundPrefs, playSound, setSoundPrefs, type SoundKind, type SoundPrefs } from "@/lib/sounds";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${on ? "bg-gradient-to-r from-pink-500 to-fuchsia-500" : "bg-slate-700"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// Hàm (không phải hằng) để nhãn đổi theo VI/EN.
const GROUPS = (): { key: "messages" | "notifications" | "effects"; icon: typeof Bell; title: string; hint: string; demo: SoundKind }[] => [
  { key: "messages", icon: MessageCircle, title: tr("Tin nhắn", "Messages"), hint: tr("Tin mới, tin đến trong khung chat, gửi tin", "New, incoming and sent messages"), demo: "message" },
  { key: "notifications", icon: Bell, title: tr("Thông báo", "Notifications"), hint: tr("Lượt thích, bình luận, việc gấp gần bạn", "Likes, comments, urgent jobs near you"), demo: "notify" },
  { key: "effects", icon: Sparkles, title: tr("Hiệu ứng thao tác", "Action effects"), hint: tr("Thả tim, đăng bài, đăng tin thành công", "Likes, posting, job posted"), demo: "like" },
];

// Thông báo đẩy (kể cả khi đã tắt app) — trạng thái thật lấy từ trình duyệt.
function PushRow() {
  useTr(); // render lại khi đổi VI/EN
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getPushState().then(setState);
  }, []);
  if (state === null || state === "unsupported") return null;
  const hint =
    state === "ios-needs-install"
      ? tr("iPhone: bấm Chia sẻ → \"Thêm vào màn hình chính\", mở PawNail từ đó rồi bật.", "iPhone: tap Share → \"Add to Home Screen\", open PawNail from there, then turn this on.")
      : state === "denied"
      ? tr("Bạn đã chặn thông báo — mở cài đặt trình duyệt cho bitpawos.com để cho phép lại.", "You've blocked notifications — allow them again in your browser settings for bitpawos.com.")
      : tr("Việc gấp gần bạn, tin nhắn, cuộc gọi — kể cả khi đã tắt app.", "Urgent jobs nearby, messages, calls — even when the app is closed.");
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 ring-1 ring-pink-500/20">
      <BellRing className="h-4 w-4 flex-shrink-0 text-pink-300" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-200">{tr("Thông báo đẩy", "Push notifications")}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>
      </span>
      {(state === "on" || state === "off") && (
        <Switch
          on={state === "on"}
          label={tr("Thông báo đẩy", "Push notifications")}
          onChange={async (v) => {
            if (busy) return;
            setBusy(true);
            setState(await (v ? enablePush() : disablePush()).catch(() => "off" as PushState));
            setBusy(false);
          }}
        />
      )}
    </div>
  );
}

/** Cài đặt âm thanh & rung (lưu trên thiết bị này). */
export default function SoundSettings() {
  useTr(); // render lại khi đổi VI/EN
  const [prefs, setPrefs] = useState<SoundPrefs>(DEFAULT_PREFS);
  useEffect(() => setPrefs(getSoundPrefs()), []);
  const update = (patch: Partial<SoundPrefs>) => setPrefs(setSoundPrefs(patch));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 ring-1 ring-white/10">
        <span className="flex items-center gap-2.5">
          {prefs.enabled ? <Volume2 className="h-4 w-4 text-pink-300" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
          <span className="text-sm font-semibold text-slate-200">{tr("Âm thanh trong app", "In-app sounds")}</span>
        </span>
        <Switch on={prefs.enabled} onChange={(v) => update({ enabled: v })} label={tr("Bật âm thanh", "Sound on")} />
      </div>

      <div className={`space-y-3 transition-opacity ${prefs.enabled ? "" : "pointer-events-none opacity-40"}`}>
        <div className="flex items-center gap-3 px-1">
          <VolumeX className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            aria-label={tr("Âm lượng", "Volume")}
            onChange={(e) => update({ volume: Number(e.target.value) })}
            onPointerUp={() => playSound("notify", { force: true })}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-pink-500"
          />
          <Volume2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="w-9 text-right text-xs font-bold text-slate-400">{Math.round(prefs.volume * 100)}%</span>
        </div>

        {GROUPS().map((g) => (
          <div key={g.key} className="flex items-center gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 ring-1 ring-white/5">
            <g.icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-200">{g.title}</span>
              <span className="block truncate text-[11px] text-slate-500">{g.hint}</span>
            </span>
            <button
              type="button"
              onClick={() => playSound(g.demo, { force: true })}
              aria-label={tr(`Nghe thử âm ${g.title.toLowerCase()}`, `Preview ${g.title.toLowerCase()} sound`)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-pink-300 ring-1 ring-pink-500/30 hover:bg-pink-500/10"
            >
              <Play className="h-3 w-3 fill-pink-300" />{tr(" Nghe thử", " Preview")}
            </button>
            <Switch on={prefs[g.key]} onChange={(v) => update({ [g.key]: v })} label={tr(`Âm ${g.title.toLowerCase()}`, `${g.title} sound`)} />
          </div>
        ))}

        <div className="flex items-center gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 ring-1 ring-white/5">
          <Smartphone className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-200">Rung</span>
            <span className="block text-[11px] text-slate-500">{tr("Rung nhẹ khi có tin nhắn & việc gấp (Android)", "Light vibration for messages & urgent jobs (Android)")}</span>
          </span>
          <Switch on={prefs.vibrate} onChange={(v) => update({ vibrate: v })} label="Rung" />
        </div>
      </div>
      <PushRow />
      <p className="px-1 text-[11px] text-slate-500">{tr("Cuộc gọi đến luôn đổ chuông để bạn không lỡ cuộc gọi.", "Incoming calls always ring so you never miss one.")}</p>
    </div>
  );
}
