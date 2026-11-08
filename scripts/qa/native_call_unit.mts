// Kiểm thử THUẦN (không trình duyệt, không mạng) cho cầu nối cuộc gọi native của app Android (lib/calls/nativeCallBridge.ts):
//   dò từng hàm qua window.Capacitor.PluginHeaders (web / bản app cũ ≤ 3 / bản thiếu hàm → no-op, KHÔNG BAO GIỜ gọi hàm
//   "not implemented"), chuẩn hoá tham số gửi xuống + kết quả trả về, lỗi của plugin không lọt ra, sự kiện callAction
//   (lọc dữ liệu lạ, huỷ đăng ký trước / sau khi addListener xong), không đụng "then" của proxy plugin Capacitor.
//   npx tsx scripts/qa/native_call_unit.mts
import {
  canSwitchNativeAudio,
  createNativeCallBridge,
  nextAudioRequest,
  normAudioState,
  normCallAction,
  normOngoingParams,
  NATIVE_CALL_METHODS,
  type NativeCallPluginLike,
  type PluginHeader,
} from "../../lib/calls/nativeCallBridge";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};
const tick = () => new Promise((r) => setTimeout(r, 0));

type Call = { method: string; args: unknown[] };
/** Plugin giả kiểu proxy Capacitor: ghi mọi lời gọi; truy cập "then" bị ghi lại (proxy thật biến nó thành lời gọi native). */
function fakePlugin(impl: Partial<Record<string, (...a: unknown[]) => unknown>> = {}) {
  const calls: Call[] = [];
  const listeners: ((d: unknown) => void)[] = [];
  let thenTouched = 0;
  let removed = 0;
  const base: Record<string, (...a: unknown[]) => unknown> = {
    startOngoingCall: async () => ({ started: true, audio: { active: true, route: "earpiece", earpiece: true, headset: false, bluetooth: false } }),
    updateOngoingCall: async () => ({ started: true, audio: { active: true, route: "speaker", earpiece: true, headset: false, bluetooth: false } }),
    stopOngoingCall: async () => undefined,
    setAudioRoute: async (o: unknown) => ({ active: true, route: (o as { route: string }).route === "speaker" ? "speaker" : "earpiece", earpiece: true, headset: false, bluetooth: false, ongoing: true }),
    getAudioState: async () => ({ active: true, route: "earpiece", earpiece: true, headset: false, bluetooth: false, ongoing: true }),
    takeCallAction: async () => ({}),
    addListener: (_e: unknown, cb: unknown) => {
      listeners.push(cb as (d: unknown) => void);
      const p = Promise.resolve({ remove: async () => void removed++ });
      return p;
    },
    ...impl,
  };
  const proxy = new Proxy({} as NativeCallPluginLike, {
    get(_t, prop: string) {
      if (prop === "then") {
        thenTouched++;
        return undefined;
      }
      const fn = base[prop];
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        if (!fn) throw new Error(`"PawNailNative.${prop}()" is not implemented on android`);
        return fn(...args);
      };
    },
  });
  return { proxy, calls, emit: (d: unknown) => listeners.forEach((cb) => cb(d)), listeners, stats: () => ({ thenTouched, removed }) };
}
const OLD_METHODS = ["getInfo", "setActiveConversation", "clearConversation", "clearAll", "openBubbleSettings", "openNotificationSettings", "addListener", "removeListener"];
const NEW_METHODS = [...OLD_METHODS, ...NATIVE_CALL_METHODS];
const headersWith = (methods: string[]): PluginHeader[] => [
  { name: "App", methods: [{ name: "getInfo" }] },
  { name: "PawNailNative", methods: methods.map((name) => ({ name })) },
];
const bridge = (o: { android?: boolean; headers?: () => PluginHeader[] | null | undefined; plugin: NativeCallPluginLike }) =>
  createNativeCallBridge({ isAndroidApp: () => o.android ?? true, headers: o.headers ?? (() => headersWith(NEW_METHODS)), plugin: () => o.plugin });

// ---------- 1. Dò hàm ----------
{
  const web = fakePlugin();
  const b = bridge({ android: false, plugin: web.proxy });
  const r = await b.start({ peerName: "Lan", video: false, camera: false, state: "connected" });
  await b.stop();
  const route = await b.setRoute("speaker");
  const act = await b.takeAction();
  const off = b.onAction(() => {});
  off();
  ok("N1", "Web / iPhone (không phải app Android) → không hỗ trợ; start = {started:false}, stop / setRoute / takeAction / onAction không gọi plugin",
    !b.supported() && r.started === false && r.audio === null && route === null && act === null && web.calls.length === 0, web.calls);
}
{
  const old = fakePlugin();
  const b = bridge({ headers: () => headersWith(OLD_METHODS), plugin: old.proxy });
  const r = await b.start({ peerName: "Lan", video: true, camera: true, state: "calling" });
  await b.update({ peerName: "Lan", video: true, camera: true, state: "connected" });
  await b.stop();
  const s = await b.audioState();
  b.onAction(() => {});
  ok("N2", "App Android bản cũ (≤ 3: PawNailNative chỉ có getInfo / chat) → không hỗ trợ, KHÔNG gọi hàm nào (tránh 'not implemented'), không lỗi",
    !b.supported() && r.started === false && s === null && old.calls.length === 0, old.calls);
}
{
  const partial = fakePlugin();
  const missingOne = NEW_METHODS.filter((m) => m !== "takeCallAction");
  const b1 = bridge({ headers: () => headersWith(missingOne), plugin: partial.proxy });
  const b2 = bridge({ headers: () => undefined, plugin: partial.proxy });
  const b3 = bridge({ headers: () => { throw new Error("boom"); }, plugin: partial.proxy });
  const b4 = bridge({ headers: () => [{ name: "PawNailNative" }], plugin: partial.proxy });
  ok("N3", "Thiếu 1 hàm / không có PluginHeaders / đọc headers lỗi / header không có methods → không hỗ trợ",
    !b1.supported() && !b2.supported() && !b3.supported() && !b4.supported() && partial.calls.length === 0);
}

// ---------- 2. Bản app 4+: gọi đúng, chuẩn hoá ----------
{
  const p = fakePlugin();
  const b = bridge({ plugin: p.proxy });
  const r = await b.start({ peerName: "  Lan \n Nguyen  " + "x".repeat(100), video: false, camera: false, state: "calling", since: null });
  const u = await b.update({ peerName: "Lan", video: true, camera: true, state: "connected", since: 1_762_500_000_123.7 });
  const bad = normOngoingParams({ peerName: "Lan", video: false, camera: false, state: "weird" as never, since: -5 });
  const sent0 = p.calls[0]?.args[0] as Record<string, unknown>;
  const sent1 = p.calls[1]?.args[0] as Record<string, unknown>;
  ok("N4", "Bản 4+ → hỗ trợ; startOngoingCall nhận tên gọn (≤ 80, không xuống dòng), trạng thái, không gửi since rỗng; update gửi since nguyên; kết quả {started, audio} chuẩn hoá",
    b.supported() && p.calls[0]?.method === "startOngoingCall" && typeof sent0.peerName === "string" && (sent0.peerName as string).startsWith("Lan Nguyen x") && (sent0.peerName as string).length === 80 &&
      sent0.state === "calling" && !("since" in sent0) && sent0.video === false && p.calls[1]?.method === "updateOngoingCall" && sent1.since === 1_762_500_000_123 && sent1.camera === true &&
      r.started === true && r.audio?.route === "earpiece" && u.audio?.route === "speaker" && bad.state === "connected" && !("since" in bad),
    { sent0, sent1, r, u, bad });
  const route = await b.setRoute("speaker");
  const st = await b.audioState();
  await b.stop();
  ok("N5", "setRoute → setAudioRoute({route}) + trạng thái mới; audioState có ongoing; stop → stopOngoingCall",
    route?.route === "speaker" && (p.calls.find((c) => c.method === "setAudioRoute")?.args[0] as { route: string }).route === "speaker" && st?.ongoing === true && st.route === "earpiece" &&
      p.calls.some((c) => c.method === "stopOngoingCall") && p.stats().thenTouched === 0,
    { route, st, then: p.stats().thenTouched });
}

// ---------- 3. Lỗi của plugin không lọt ra ----------
{
  const reject = async () => { throw new Error("native exploded"); };
  const p = fakePlugin({ startOngoingCall: reject, updateOngoingCall: reject, stopOngoingCall: reject, setAudioRoute: reject, getAudioState: reject, takeCallAction: reject, addListener: () => { throw new Error("no listener"); } });
  const b = bridge({ plugin: p.proxy });
  let threw = false;
  let r, u, s, a, st;
  try {
    r = await b.start({ peerName: "Lan", video: false, camera: false, state: "connecting" });
    u = await b.update({ peerName: "Lan", video: false, camera: false, state: "connected" });
    await b.stop();
    s = await b.setRoute("earpiece");
    a = await b.takeAction();
    st = await b.audioState();
    b.onAction(() => {})();
  } catch {
    threw = true;
  }
  const weird = fakePlugin({ startOngoingCall: async () => null, getAudioState: async () => "nope" });
  const bw = bridge({ plugin: weird.proxy });
  const wr = await bw.start({ peerName: "Lan", video: false, camera: false, state: "connected" });
  const ws = await bw.audioState();
  ok("N6", "Plugin ném / trả dữ liệu lạ → start {started:false}, setRoute / takeAction / audioState null, stop & onAction không ném",
    !threw && r?.started === false && u?.started === false && s === null && a === null && st === null && wr.started === false && wr.audio === null && ws === null, { threw, r, u, s, a, st, wr, ws });
}

// ---------- 4. Hành động từ thông báo ----------
{
  ok("N7", "normCallAction: hangup; answer / declined cần callId hợp lệ; dữ liệu lạ → null",
    JSON.stringify(normCallAction({ action: "hangup", callId: "zzz" })) === '{"action":"hangup"}' &&
      JSON.stringify(normCallAction({ action: "answer", callId: "abc123xyz" })) === '{"action":"answer","callId":"abc123xyz"}' &&
      JSON.stringify(normCallAction({ action: "declined", callId: "k9k9k9" })) === '{"action":"declined","callId":"k9k9k9"}' &&
      normCallAction({ action: "answer" }) === null && normCallAction({ action: "answer", callId: "../evil" }) === null && normCallAction({ action: "answer", callId: "ABC123" }) === null &&
      normCallAction({ action: "launchMissiles", callId: "abc123" }) === null && normCallAction(null) === null && normCallAction("hangup") === null);
  const p = fakePlugin({ takeCallAction: async () => ({ action: "answer", callId: "abc123xyz" }) });
  const b = bridge({ plugin: p.proxy });
  const taken = await b.takeAction();
  const got: unknown[] = [];
  const off = b.onAction((x) => got.push(x));
  await tick();
  p.emit({ action: "hangup" });
  p.emit({ action: "answer", callId: "abc123xyz" });
  p.emit({ action: "answer", callId: "<script>" });
  p.emit({ nonsense: true });
  off();
  await tick();
  p.emit({ action: "hangup" }); // sau khi huỷ: bỏ qua
  ok("N8", "takeAction → {answer, callId}; onAction nhận hangup + answer hợp lệ, bỏ dữ liệu lạ; huỷ → remove() và không nhận nữa",
    taken?.action === "answer" && taken.callId === "abc123xyz" && JSON.stringify(got) === '[{"action":"hangup"},{"action":"answer","callId":"abc123xyz"}]' && p.stats().removed === 1,
    { taken, got, removed: p.stats().removed });
  // huỷ TRƯỚC khi addListener kịp xong (React unmount ngay sau mount)
  let resolveAdd: (v: { remove: () => Promise<void> }) => void = () => {};
  let removedLate = 0;
  const slow = fakePlugin({ addListener: () => new Promise((r) => (resolveAdd = r)) });
  const bs = bridge({ plugin: slow.proxy });
  const got2: unknown[] = [];
  const off2 = bs.onAction((x) => got2.push(x));
  off2();
  resolveAdd({ remove: async () => void removedLate++ });
  await tick();
  await tick();
  ok("N9", "Huỷ đăng ký trước khi addListener xong → listener vẫn được gỡ khi xong", removedLate === 1 && got2.length === 0, { removedLate });
}

// ---------- 5. Nút Loa ----------
{
  const st = (o: Partial<ReturnType<typeof normAudioState> & object>) => ({ active: true, route: "earpiece" as const, earpiece: true, headset: false, bluetooth: false, ...o });
  ok("N10", "Nút Loa: loa ngoài → nghe riêng (earpiece), còn lại → loa ngoài; chỉ hiện khi đang có cuộc gọi native + có loa trong / tai nghe / Bluetooth",
    nextAudioRequest("speaker") === "earpiece" && nextAudioRequest("earpiece") === "speaker" && nextAudioRequest("headset") === "speaker" && nextAudioRequest(null) === "speaker" &&
      canSwitchNativeAudio(st({})) && canSwitchNativeAudio(st({ earpiece: false, headset: true })) && !canSwitchNativeAudio(st({ earpiece: false })) && !canSwitchNativeAudio(st({ active: false })) &&
      !canSwitchNativeAudio(null));
  ok("N11", "normAudioState: route lạ → null, cờ chỉ true khi đúng true",
    JSON.stringify(normAudioState({ active: "yes", route: "laser", earpiece: 1, headset: true })) === '{"active":false,"route":null,"earpiece":false,"headset":true,"bluetooth":false}' && normAudioState("x") === null);
}

console.log(`\nnative call bridge unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
