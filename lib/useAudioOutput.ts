"use client";

import { useCallback, useEffect, useState } from "react";

// Chọn ĐẦU RA ÂM THANH cho cuộc gọi (loa ngoài / tai nghe / loa máy tính…) bằng setSinkId.
// Trình duyệt hỗ trợ: Chrome/Edge máy tính, Chrome Android (khi máy báo ≥ 2 đầu ra).
// Safari/iPhone KHÔNG cho web chọn đầu ra (iOS tự điều phối) → nút tự ẩn, không hiện nút "chết".
type SinkEl = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };

const supported = () => typeof window !== "undefined" && typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/** root: khung cuộc gọi — mọi thẻ audio/video bên trong (kể cả thẻ SDK tạo sau) đều đổi đầu ra. */
export function useAudioOutput(root: HTMLElement | null, active: boolean) {
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [current, setCurrent] = useState<string>("default");

  const refresh = useCallback(async () => {
    if (!supported() || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      // "communications" là bản sao của 1 thiết bị khác trên Windows → bỏ cho khỏi trùng.
      setOutputs(all.filter((d) => d.kind === "audiooutput" && d.deviceId !== "communications"));
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh();
    const md = navigator.mediaDevices;
    md?.addEventListener?.("devicechange", refresh);
    // Nhãn thiết bị chỉ có sau khi cấp quyền micro → đọc lại sau vài giây.
    const t = setTimeout(refresh, 3000);
    return () => { md?.removeEventListener?.("devicechange", refresh); clearTimeout(t); };
  }, [active, refresh]);

  // Áp đầu ra cho mọi thẻ media hiện có + thẻ mới SDK chèn vào sau.
  useEffect(() => {
    if (!active || !root || !supported()) return;
    const apply = () => root.querySelectorAll<SinkEl>("audio, video").forEach((el) => { el.setSinkId?.(current).catch(() => {}); });
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [active, root, current]);

  /** Chuyển sang đầu ra kế tiếp (vòng tròn). */
  const next = useCallback(() => {
    if (outputs.length < 2) return;
    const i = outputs.findIndex((o) => o.deviceId === current);
    setCurrent(outputs[(i + 1) % outputs.length].deviceId);
  }, [outputs, current]);

  const label = outputs.find((o) => o.deviceId === current)?.label || "";
  return { canSwitch: supported() && outputs.length >= 2, next, label, isDefault: current === "default" };
}
