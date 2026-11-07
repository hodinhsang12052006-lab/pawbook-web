"use client";

// Camera / microphone helpers for calls + the ONE <audio> element that plays the other person's voice.
//
// Autoplay: browsers only play sound after a tap. The dial / answer tap calls unlockCallAudio() synchronously, which
// starts (and so "unlocks") this element; the remote voice is later attached to the same element. The remote <video>
// is always muted, so the voice is never played twice.

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export type Facing = "user" | "environment";

export function videoConstraints(facing: Facing = "user", o: { exact?: boolean; deviceId?: string } = {}): MediaTrackConstraints {
  return {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 24, max: 30 },
    ...(o.deviceId ? { deviceId: { exact: o.deviceId } } : { facingMode: o.exact ? { exact: facing } : facing }),
  };
}

export function mediaSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== "undefined";
}

function unsupported(): Error {
  const e = new Error("getUserMedia unavailable");
  e.name = "NotSupportedError";
  return e;
}

/** Microphone (+ camera). Throws the browser's DOMException (NotAllowedError, NotFoundError, …). */
export async function getCallMedia(video: boolean, facing: Facing = "user"): Promise<MediaStream> {
  if (!mediaSupported()) throw unsupported();
  return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: video ? videoConstraints(facing) : false });
}

/** A fresh camera track. With `next`, tries the other facing mode, then cycles through the other cameras. */
export async function getCameraTrack(facing: Facing, o: { switchFrom?: MediaStreamTrack | null } = {}): Promise<MediaStreamTrack> {
  if (!mediaSupported()) throw unsupported();
  if (!o.switchFrom) {
    const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facing) });
    return s.getVideoTracks()[0];
  }
  const oldId = o.switchFrom.getSettings?.().deviceId;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facing, { exact: true }) });
    const t = s.getVideoTracks()[0];
    if (!oldId || t.getSettings?.().deviceId !== oldId) return t;
    t.stop(); // same physical camera (desktop webcams have no facing mode) → cycle by deviceId below
  } catch {}
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId);
  if (!cams.length) throw Object.assign(new Error("no camera"), { name: "NotFoundError" });
  const i = cams.findIndex((d) => d.deviceId === oldId);
  const next = cams[(i + 1) % cams.length];
  const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facing, { deviceId: next.deviceId }) });
  return s.getVideoTracks()[0];
}

export async function countCameras(): Promise<number> {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput").length;
  } catch {
    return 0;
  }
}

export function stopStream(s: MediaStream | null | undefined) {
  if (!s) return;
  for (const t of s.getTracks()) {
    try {
      t.stop();
    } catch {}
  }
}

let sharedAudio: HTMLAudioElement | null = null;

export function callAudioElement(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedAudio) {
    const a = document.createElement("audio");
    a.autoplay = true;
    a.setAttribute("playsinline", "");
    a.setAttribute("data-call-audio", "");
    a.style.display = "none";
    document.body.appendChild(a);
    sharedAudio = a;
  }
  return sharedAudio;
}

/** Call SYNCHRONOUSLY inside the dial / answer tap handler. */
export function unlockCallAudio() {
  const a = callAudioElement();
  if (!a) return;
  try {
    if (!a.srcObject && typeof MediaStream !== "undefined") a.srcObject = new MediaStream();
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {}
}

/** Play the other person's voice. Resolves false when the browser still blocks autoplay (show a "tap for sound" button). */
export async function playRemoteAudio(stream: MediaStream): Promise<boolean> {
  const a = callAudioElement();
  if (!a) return false;
  if (a.srcObject !== stream) a.srcObject = stream;
  a.muted = false;
  try {
    await a.play();
    return true;
  } catch (err) {
    return (err as { name?: string })?.name !== "NotAllowedError";
  }
}

export function resetCallAudio() {
  const a = sharedAudio;
  if (!a) return;
  try {
    a.pause();
  } catch {}
  a.srcObject = null;
  if (a.parentElement !== document.body) document.body.appendChild(a);
}
