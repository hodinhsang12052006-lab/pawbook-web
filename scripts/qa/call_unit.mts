// Cuộc gọi — phần THUẦN (không cần máy chủ / ZEGOCLOUD): phân loại lỗi micro / camera, câu báo + hướng dẫn bật quyền EN / VI
// theo nơi chạy (app Android / app iPhone / Safari iPhone / trình duyệt), câu lỗi đăng nhập phòng ZEGOCLOUD, xin quyền trước khi
// vào phòng (camera lỗi → vẫn gọi, camera tắt), bộ sinh token đúng điều kiện cấu hình (App ID + secret 32 ký tự).
//   npx tsx scripts/qa/call_unit.mts
import { classifyMediaError, checkCallMedia, mediaProblemText, zegoJoinErrorText } from "../../lib/callMedia";
import { setTrLocale } from "../../lib/i18n/tr";
import { generateToken04 } from "../../lib/zegoServerAssistant";

let pass = 0;
let fail = 0;
function check(id: string, desc: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail}`);
}
const err = (name: string) => Object.assign(new Error(name), { name });

// CU1 — phân loại lỗi getUserMedia
const kinds = ["NotAllowedError", "PermissionDeniedError", "SecurityError", "NotFoundError", "OverconstrainedError", "NotReadableError", "AbortError", "TypeError", "NotSupportedError"].map((n) => classifyMediaError(err(n)));
check("CU1", "NotAllowed / PermissionDenied / Security → denied; NotFound / Overconstrained → nodevice; NotReadable / Abort → busy; TypeError / NotSupported → unsupported",
  JSON.stringify(kinds) === JSON.stringify(["denied", "denied", "denied", "nodevice", "nodevice", "busy", "busy", "unsupported", "unsupported"]), JSON.stringify(kinds));

// CU2 — câu báo + hướng dẫn theo nơi chạy, đủ EN + VI, không lẫn ngôn ngữ
const plats = ["android-app", "ios-app", "ios-web", "web"] as const;
const out: Record<string, { title: string; hint?: string }> = {};
for (const lang of ["en", "vi"] as const) {
  setTrLocale(lang);
  for (const p of plats) for (const v of [false, true]) out[`${lang}:${p}:${v}`] = mediaProblemText("denied", v, p);
  for (const k of ["nodevice", "busy", "unsupported"] as const) out[`${lang}:${k}`] = mediaProblemText(k, false, "web");
}
const viOk = Object.entries(out).filter(([k]) => k.startsWith("vi:")).every(([, t]) => /[ăâđêôơưạảấầẩậắằẳặẹẻẽếềểệỉịọỏốồổộớờởợụủứừửựỳỵỷỹáàãéèíìóòõúùý]/i.test(t.title + (t.hint || "")));
const enOk = Object.entries(out).filter(([k]) => k.startsWith("en:")).every(([, t]) => !/[ăâđêôơưạảấầẩậắằẳặẹẻẽếềểệỉịọỏốồổộớờởợụủứừửựỳỵỷỹ]/i.test(t.title + (t.hint || "")));
check("CU2", "Bị chặn quyền: có hướng dẫn bật cho từng nơi (Android: Settings → Apps → PawNail → Permissions; iPhone app; Safari 'aA'; trình duyệt: ổ khoá) — EN không dấu, VI có dấu",
  /Settings → Apps → PawNail → Permissions/.test(out["en:android-app:false"].hint || "") &&
    /Cài đặt → Ứng dụng → PawNail → Quyền/.test(out["vi:android-app:false"].hint || "") &&
    /Settings → PawNail/.test(out["en:ios-app:false"].hint || "") && /aA/.test(out["en:ios-web:false"].hint || "") && /lock icon/.test(out["en:web:false"].hint || "") &&
    /camera/i.test(out["en:web:true"].title) && !/camera/i.test(out["en:web:false"].title) && /Máy ảnh/.test(out["vi:android-app:true"].hint || "") &&
    viOk && enOk && Object.values(out).every((t) => t.title.length > 10),
  JSON.stringify({ a: out["en:android-app:false"], v: out["vi:android-app:true"], viOk, enOk }).slice(0, 300));

// CU3 — lỗi đăng nhập phòng ZEGOCLOUD có mã, đúng loại
setTrLocale("en");
const tok = zegoJoinErrorText(1102016);
const net = zegoJoinErrorText(1002053);
const other = zegoJoinErrorText(1002099);
const noCode = zegoJoinErrorText(0);
setTrLocale("vi");
const tokVi = zegoJoinErrorText(1102018);
const appVi = zegoJoinErrorText(1001004);
check("CU3", "Lỗi đăng nhập phòng: token (1102016/18) → 'rejected this session (code …)'; mạng (1002053) → 'Network problem'; khác (1001004 App ID sai…) → 'Couldn't join the call (code …)'; không có mã → câu chung, không '(code 0)'; VI có mã",
  /rejected this session \(code 1102016\)/.test(tok) && /Network problem \(code 1002053\)/.test(net) && /code 1002099/.test(other) && /mã 1102018/.test(tokVi) && /mã 1001004/.test(appVi) && !/code 0/.test(noCode) && /Couldn't join the call\./.test(noCode),
  JSON.stringify({ tok, net, other, noCode, tokVi, appVi }));

// CU4 — xin quyền trước khi vào phòng: thứ tự + dọn thiết bị + camera lỗi thì vẫn gọi
type Req = { audio: boolean; video: boolean };
function fakeMedia(fail: (r: Req) => string | null) {
  const calls: Req[] = [];
  let stopped = 0;
  const g = globalThis as unknown as { navigator?: unknown };
  Object.defineProperty(g, "navigator", {
    configurable: true,
    value: {
      userAgent: "test",
      mediaDevices: {
        getUserMedia: async (c: Req) => {
          calls.push({ audio: !!c.audio, video: !!c.video });
          const f = fail({ audio: !!c.audio, video: !!c.video });
          if (f) throw err(f);
          return { getTracks: () => [{ stop: () => stopped++ }, ...(c.video ? [{ stop: () => stopped++ }] : [])] };
        },
      },
    },
  });
  return { calls, stopped: () => stopped };
}
let m = fakeMedia(() => null);
const ok = await checkCallMedia(true);
const okStopped = m.stopped();
m = fakeMedia((r) => (r.video ? "NotReadableError" : null));
const camBusy = await checkCallMedia(true);
const camCalls = m.calls.length;
m = fakeMedia(() => "NotAllowedError");
const denied = await checkCallMedia(false);
m = fakeMedia((r) => (r.video ? "NotAllowedError" : "NotAllowedError"));
const deniedVideo = await checkCallMedia(true);
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "old" } });
const unsupported = await checkCallMedia(false);
check("CU4", "Xin quyền trước khi vào phòng: được → trả thiết bị ngay (ZEGOCLOUD tự mở lại); camera bận → vẫn gọi, camera tắt; micro bị chặn → chặn cuộc gọi; trình duyệt không có mediaDevices → unsupported",
  ok.problem === null && ok.video === true && okStopped === 2 && camBusy.problem === null && camBusy.video === false && camBusy.camProblem === "busy" && camCalls === 2 &&
    denied.problem === "denied" && deniedVideo.problem === "denied" && unsupported.problem === "unsupported",
  JSON.stringify({ ok, okStopped, camBusy, camCalls, denied, deniedVideo, unsupported }));

// CU5 — điều kiện cấu hình = điều kiện bộ sinh token chấp nhận (route GET /api/zego/token báo enabled đúng)
const secret32 = "0123456789abcdef0123456789abcdef";
let t1 = "";
let e31 = "";
try {
  t1 = generateToken04(123456789, "user_abc", secret32, 3600, "");
} catch (e) {
  t1 = String(e);
}
try {
  generateToken04(123456789, "user_abc", secret32.slice(1), 3600, "");
} catch (e) {
  e31 = String(e);
}
check("CU5", "Token04: App ID số + secret 32 ký tự → token '04…'; secret 31 ký tự → lỗi (route báo 'chưa cấu hình' thay vì 500)", /^04/.test(t1) && /32 byte/.test(e31), JSON.stringify({ t1: t1.slice(0, 6), e31 }));

console.log(`\ncall_unit: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
