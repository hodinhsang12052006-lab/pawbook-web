// Web Worker của Thử mẫu: khớp khuôn móng + vẽ mẫu chạy nền, giao diện không đơ (xem lib/tryon/session.ts).
import { TryOnSession, type TryOnMsg } from "./session";

const session = new TryOnSession();
const post = (data: unknown, transfer: ArrayBuffer[] = []) => (self as unknown as { postMessage: (d: unknown, t: ArrayBuffer[]) => void }).postMessage(data, transfer);

self.onmessage = (e: MessageEvent<{ id: number; msg: TryOnMsg }>) => {
  const { id, msg } = e.data;
  try {
    const { reply, transfer } = session.handle(msg);
    post({ id, ok: true, reply }, transfer);
  } catch (err) {
    post({ id, ok: false, error: (err as Error)?.message || String(err) });
  }
};
