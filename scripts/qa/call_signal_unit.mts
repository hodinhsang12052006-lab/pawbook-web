// Kiểm thử THUẦN (không DB, không mạng) cho tín hiệu cuộc gọi WebRTC:
//   SignalInbox (bỏ callId/leg cũ, chống trùng, ghép nhiều phần, đúng thứ tự, bỏ qua khoảng trống sau 2s) ·
//   SignalOutbox (giữ tới khi biết máy bên kia, gửi lần lượt, gom ICE 150ms / xả khi hết ứng viên, thử lại) ·
//   bảng quyết định "perfect negotiation" (va chạm offer, lịch sự / không lịch sự) ·
//   kiểm tra dữ liệu tín hiệu + chia phần dưới giới hạn 10KB của Pusher ·
//   call token (ký / xác minh / sửa / hết hạn / sai người / sai callId).
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/call_signal_unit.mts
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
  console.error("Bỏ TURSO_* trước khi chạy — bài này không cần DB.");
  process.exit(2);
}
const { SignalInbox, SignalOutbox, isOfferCollision, shouldIgnoreOffer } = await import("../../lib/calls/signalQueue");
const { validateSignalData, chunkSerialized, MAX_PARTS } = await import("../../lib/calls/signalWire");
const { signCallToken, verifyCallToken, CALL_TOKEN_TTL_MS, newCallId, CALL_ID_RE } = await import("../../lib/calls/callToken");
type InboundMessage = import("../../lib/calls/signalQueue").InboundMessage;
type OutboundMessage = import("../../lib/calls/signalQueue").OutboundMessage;
type SignalEvent = import("../../lib/calls/signalWire").SignalEvent;

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};

// ---- đồng hồ giả ----
function fakeClock() {
  let t = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimeout: (fn: () => void, ms: number) => {
      timers.set(++id, { at: t + ms, fn });
      return id;
    },
    clearTimeout: (x: unknown) => void timers.delete(x as number),
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        t = next[1].at;
        next[1].fn();
      }
      t = end;
    },
    get pending() {
      return timers.size;
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function flush(clock: ReturnType<typeof fakeClock>, ms = 0, rounds = 30) {
  for (let i = 0; i < rounds; i++) {
    await tick();
    if (ms) clock.advance(ms);
  }
}

const CALL = "call1abc";
const ME = "leg-me01";
const PEER = "leg-peer1";
const ev = (seq: number, kind: "sdp" | "ice" | "ctl", data: unknown, over: Partial<SignalEvent> = {}): SignalEvent => ({ fromId: "u2", callId: CALL, fromLeg: PEER, toLeg: ME, seq, kind, part: 0, parts: 1, d: JSON.stringify(data), ...over });
function inbox(o: { remoteLeg?: string } = {}) {
  const clock = fakeClock();
  const got: InboundMessage[] = [];
  const box = new SignalInbox({ callId: CALL, myLeg: ME, remoteLeg: o.remoteLeg, onMessage: (m) => got.push(m), clock });
  return { box, got, clock };
}

// ================= SignalInbox =================
{
  const { box, got } = inbox();
  box.push(ev(0, "sdp", { type: "offer", sdp: "v=0" }));
  box.push(ev(1, "ice", [{ candidate: "c1" }]));
  ok("Q1", "Nhận đúng thứ tự → giao ngay, đúng dữ liệu", got.length === 2 && got[0].kind === "sdp" && (got[0].data as { type: string }).type === "offer" && got[1].kind === "ice", got);
}
{
  const { box, got } = inbox();
  box.push(ev(2, "ctl", { mic: false }));
  box.push(ev(1, "ice", [{ candidate: "c1" }]));
  ok("Q2", "Đến sai thứ tự (2,1) → chưa giao gì khi còn thiếu #0", got.length === 0);
  box.push(ev(0, "sdp", { type: "answer", sdp: "v=0" }));
  ok("Q3", "Có #0 → giao 0,1,2 đúng thứ tự", got.map((m) => m.seq).join() === "0,1,2", got.map((m) => m.seq));
}
{
  const { box, got } = inbox();
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }));
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }));
  box.push(ev(1, "ctl", { mic: true }));
  box.push(ev(1, "ctl", { mic: true }));
  ok("Q4", "Trùng (Pusher gửi lại) → chỉ giao 1 lần", got.length === 2 && box.stats.duplicates === 2, box.stats);
}
{
  const { box, got } = inbox();
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }, { callId: "oldcall1" }));
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }, { toLeg: "leg-other" }));
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }, { kind: "evil" as never }));
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }, { part: 3, parts: 2 }));
  ok("Q5", "Tín hiệu của cuộc gọi CŨ / gửi cho máy khác / loại lạ / phần sai → bỏ", got.length === 0 && box.stats.dropped === 4, box.stats);
}
{
  const { box, got } = inbox({ remoteLeg: PEER });
  box.push(ev(0, "ctl", { mic: false }, { fromLeg: "leg-intruder" }));
  box.push(ev(0, "ctl", { mic: false }));
  ok("Q6", "Đã khoá máy bên kia → tín hiệu từ máy khác của cùng người bị bỏ", got.length === 1 && got[0].fromLeg === PEER, got);
}
{
  const { box, got } = inbox();
  const sdp = "v=0\r\n" + "a=x-long:" + "y".repeat(9000) + "\r\n";
  const ser = JSON.stringify({ type: "offer", sdp });
  const parts = chunkSerialized(ser)!;
  [2, 0, 1].forEach((i) => box.push(ev(0, "sdp", null, { part: i, parts: parts.length, d: parts[i] })));
  ok("Q7", "SDP lớn chia 3 phần, đến lộn xộn → ghép lại đúng nguyên văn", parts.length === 3 && got.length === 1 && (got[0].data as { sdp: string }).sdp === sdp, { n: parts.length, got: got.length });
}
{
  const { box, got, clock } = inbox();
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }));
  box.push(ev(2, "ice", [{ candidate: "c2" }]));
  box.push(ev(3, "ctl", { cam: false }));
  clock.advance(1999);
  ok("Q8", "Thiếu #1: chờ (chưa tới 2s) → chưa giao #2", got.length === 1);
  clock.advance(2);
  ok("Q9", "Thiếu #1 quá 2s → bỏ qua khoảng trống, giao #2 #3", got.map((m) => m.seq).join() === "0,2,3" && box.stats.skipped === 1, { seqs: got.map((m) => m.seq), stats: box.stats });
  box.push(ev(1, "ice", [{ candidate: "late" }]));
  ok("Q10", "#1 đến muộn sau khi đã bỏ qua → không giao (coi như cũ)", got.length === 3);
}
{
  const { box, got, clock } = inbox();
  box.push(ev(0, "sdp", null, { part: 0, parts: 2, d: '{"type":"of' }));
  clock.advance(2100);
  box.push(ev(1, "ctl", { mic: true }));
  clock.advance(2100);
  ok("Q11", "Phần thiếu mãi không tới → bỏ tin đó, các tin sau vẫn tới", got.length === 1 && got[0].seq === 1, got.map((m) => m.seq));
}
{
  const { box, got } = inbox();
  box.close();
  box.push(ev(0, "sdp", { type: "offer", sdp: "x" }));
  ok("Q12", "Đã đóng (cúp máy) → không giao gì nữa", got.length === 0);
}

// ================= SignalOutbox =================
{
  const clock = fakeClock();
  const posted: OutboundMessage[] = [];
  let inFlight = 0, maxInFlight = 0;
  const box = new SignalOutbox({
    clock,
    post: async (m) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      await tick();
      posted.push(m);
      inFlight--;
      return true;
    },
  });
  box.send("sdp", { type: "offer", sdp: "x" });
  box.addIce({ candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 });
  box.addIce({ candidate: "c2", sdpMid: "0", sdpMLineIndex: 0 });
  clock.advance(200);
  await flush(clock);
  ok("O1", "Chưa biết máy bên kia (chưa nghe máy) → giữ lại, không gửi gì", posted.length === 0 && box.pending === 2, { posted: posted.length, pending: box.pending });
  box.open(PEER);
  await flush(clock);
  ok("O2", "Nghe máy → gửi lần lượt theo thứ tự seq 0 (sdp), 1 (2 ứng viên ICE gộp 1 lần)", posted.map((m) => `${m.seq}:${m.kind}`).join() === "0:sdp,1:ice" && (posted[1].data as unknown[]).length === 2 && posted.every((m) => m.toLeg === PEER), posted);
  ok("O3", "Không bao giờ có 2 POST cùng lúc (giữ thứ tự trên Pusher)", maxInFlight === 1, maxInFlight);
  box.addIce({ candidate: "c3", sdpMid: "0", sdpMLineIndex: 0 });
  box.addIce(null);
  await flush(clock);
  ok("O4", "Hết ứng viên (null) → xả ngay không chờ 150ms", posted.length === 3 && posted[2].kind === "ice" && clock.pending === 0, posted.length);
  box.addIce({ candidate: "c4", sdpMid: "0", sdpMLineIndex: 0 });
  box.send("sdp", { type: "offer", sdp: "restart" });
  await flush(clock);
  ok("O5", "SDP mới → ứng viên đang chờ được gửi TRƯỚC SDP", posted.slice(3).map((m) => m.kind).join() === "ice,sdp", posted.slice(3).map((m) => m.kind));
  for (let i = 0; i < 31; i++) box.addIce({ candidate: "x" + i, sdpMid: "0", sdpMLineIndex: 0 });
  await flush(clock, 200);
  const big = posted.slice(5);
  ok("O6", "31 ứng viên → chia lô ≤ 30", big.length === 2 && (big[0].data as unknown[]).length === 30 && (big[1].data as unknown[]).length === 1, big.map((m) => (m.data as unknown[]).length));
}
{
  const clock = fakeClock();
  const calls: number[] = [];
  let failsLeft = 2;
  const box = new SignalOutbox({ clock, retryDelays: [100, 100, 100], post: async (m) => { calls.push(m.seq); if (failsLeft-- > 0) throw new Error("net"); return true; } });
  box.open(PEER);
  box.send("ctl", { mic: false });
  box.send("ctl", { mic: true });
  await flush(clock, 100);
  ok("O7", "POST lỗi → thử lại (cùng seq) rồi mới gửi tin sau", calls.join() === "0,0,0,1" && box.stats.retries === 2 && box.stats.posted === 2, { calls, stats: box.stats });
}
{
  const clock = fakeClock();
  const calls: number[] = [];
  const box = new SignalOutbox({ clock, retryDelays: [10, 10], post: async (m) => { calls.push(m.seq); return m.seq !== 0; } });
  box.open(PEER);
  box.send("ctl", { mic: false });
  box.send("ctl", { mic: true });
  await flush(clock, 10);
  ok("O8", "Lỗi mãi → bỏ tin đó (bên nhận bỏ qua khoảng trống), không kẹt hàng đợi", calls.join() === "0,0,0,1" && box.stats.failed === 1 && box.stats.posted === 1, { calls, stats: box.stats });
  box.close();
  box.send("ctl", { mic: true });
  await flush(clock, 10);
  ok("O9", "Đã đóng → không gửi gì thêm", calls.length === 4);
}

// ================= Perfect negotiation =================
{
  const st = (makingOffer: boolean, signalingState: string, isSettingRemoteAnswerPending = false) => ({ makingOffer, signalingState, isSettingRemoteAnswerPending });
  const rows: [boolean, string, ReturnType<typeof st>, boolean, boolean][] = [
    // polite, type, state, collision, ignore
    [false, "offer", st(false, "stable"), false, false],
    [false, "offer", st(true, "stable"), true, true],
    [false, "offer", st(false, "have-local-offer"), true, true],
    [true, "offer", st(true, "stable"), true, false],
    [true, "offer", st(false, "have-local-offer"), true, false],
    [false, "offer", st(false, "have-local-offer", true), false, false],
    [false, "answer", st(true, "have-local-offer"), false, false],
    [true, "answer", st(false, "have-local-offer"), false, false],
  ];
  const bad = rows.filter(([polite, type, s, col, ign]) => isOfferCollision(type, s) !== col || shouldIgnoreOffer(polite, type, s) !== ign);
  ok("N1", "Bảng perfect negotiation: va chạm offer → bên gọi (impolite) bỏ qua, bên nhận (polite) nhường; answer không bao giờ bị bỏ", bad.length === 0, bad);
}

// ================= Dữ liệu tín hiệu + chia phần =================
{
  const v1 = validateSignalData("sdp", { type: "offer", sdp: "v=0" });
  const v2 = validateSignalData("sdp", { type: "pranswer", sdp: "v=0" });
  const v3 = validateSignalData("sdp", { type: "offer", sdp: "x".repeat(24 * 1024 + 1) });
  const v4 = validateSignalData("ice", [{ candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host", sdpMid: "0", sdpMLineIndex: 0, extra: "drop me" }]);
  const v5 = validateSignalData("ice", Array.from({ length: 31 }, () => ({ candidate: "c", sdpMid: "0", sdpMLineIndex: 0 })));
  const v6 = validateSignalData("ice", [{ candidate: "c", sdpMid: "0", sdpMLineIndex: 99 }]);
  const v7 = validateSignalData("ctl", { mic: false, cam: "paused", facing: "environment" });
  const v8 = validateSignalData("ctl", { mic: "yes" });
  const v9 = validateSignalData("ctl", { evil: 1 });
  const v10 = validateSignalData("nope", {});
  ok("V1", "SDP hợp lệ qua; type lạ → 400; > 24KB → 413", v1.ok && !v2.ok && v2.status === 400 && !v3.ok && v3.status === 413, [v2, v3]);
  ok("V2", "ICE: chỉ giữ trường chuẩn; > 30 ứng viên → 413; sdpMLineIndex ngoài 0-15 → 400", v4.ok && JSON.stringify(v4.data).indexOf("extra") < 0 && !v5.ok && v5.status === 413 && !v6.ok && v6.status === 400, [v4, v5, v6]);
  ok("V3", "ctl: chỉ nhận khoá/kiểu cho phép", v7.ok && !v8.ok && !v9.ok && !v10.ok);
  const sdp = "v=0\r\n" + Array.from({ length: 400 }, (_, i) => `a=candidate:${i} 1 udp 2122260223 192.168.1.${i % 250} ${50000 + i} typ host generation 0 "q"`).join("\r\n");
  const parts = chunkSerialized(JSON.stringify({ type: "offer", sdp }).slice(0, 24000))!;
  const worst = Math.max(...parts.map((d) => Buffer.byteLength(JSON.stringify({ fromId: "c".repeat(25), callId: "x".repeat(24), fromLeg: "l".repeat(24), toLeg: "l".repeat(24), seq: 999999, kind: "sdp", part: 9, parts: 10, d }))));
  ok("V4", "Mỗi phần sau khi Pusher JSON hoá lần 2 vẫn < 10KB; tối đa 10 phần / lô", worst < 10240 && parts.length <= MAX_PARTS, { worst, n: parts.length });
  ok("V5", "Quá 10 phần → từ chối (413)", chunkSerialized("x".repeat(4000 * 10 + 1)) === null);
}

// ================= Call token =================
{
  const env = { NEXTAUTH_SECRET: "test-nextauth-secret-xyz" };
  const now = 1_800_000_000_000;
  const tok = signCallToken({ callerId: "alice", calleeId: "bob", callId: "abcd1234", callType: "video" }, { env, now })!;
  const v = (o: Partial<{ userId: string; targetId: string; callId: string; now: number; env: Record<string, string> }> = {}) =>
    verifyCallToken(o.callId === undefined && "x" in o ? null : tok, { userId: "alice", targetId: "bob", callId: "abcd1234", now: now + 1000, env, ...o });
  ok("T1", "Ký → xác minh được cho người gọi (alice→bob) và người nhận (bob→alice)", !!tok && v()?.t === "video" && !!v({ userId: "bob", targetId: "alice" }));
  ok("T2", "Người thứ 3 dùng token của người khác → từ chối", !v({ userId: "carol", targetId: "bob" }) && !v({ userId: "carol", targetId: "alice" }));
  ok("T3", "Đúng người nhưng nhắm sai người (alice→carol) → từ chối", !v({ targetId: "carol" }));
  ok("T4", "Sai callId (cuộc gọi khác) → từ chối", !v({ callId: "zzzz9999" }));
  ok("T5", "Hết hạn (> 3h) → từ chối", !v({ now: now + CALL_TOKEN_TTL_MS + 1 }));
  const [body, sig] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), c: "mallory" })).toString("base64url") + "." + sig;
  const flipped = body + "." + (sig[0] === "A" ? "B" : "A") + sig.slice(1);
  ok("T6", "Sửa nội dung / chữ ký → từ chối", !verifyCallToken(forged, { userId: "mallory", targetId: "bob", callId: "abcd1234", now, env }) && !verifyCallToken(flipped, { userId: "alice", targetId: "bob", callId: "abcd1234", now, env }));
  ok("T7", "Khoá khác (NEXTAUTH_SECRET khác / CALL_SIGNING_SECRET) → từ chối", !v({ env: { NEXTAUTH_SECRET: "another-secret" } }) && !v({ env: { ...env, CALL_SIGNING_SECRET: "dedicated-call-secret-123" } }));
  ok("T8", "Rác / null / quá dài → null, không ném lỗi", [null, 1, "", "a.b.c", "x".repeat(5000), "%%%.%%%"].every((t) => verifyCallToken(t, { userId: "alice", targetId: "bob", callId: "abcd1234", now, env }) === null));
  ok("T9", "Không có khoá (thiếu NEXTAUTH_SECRET) → không ký được", signCallToken({ callerId: "a", calleeId: "b", callId: "abcd1234", callType: "audio" }, { env: {} }) === null);
  ok("T10", "Không tự gọi chính mình / callId sai định dạng", signCallToken({ callerId: "a", calleeId: "a", callId: "abcd1234", callType: "audio" }, { env }) === null && signCallToken({ callerId: "a", calleeId: "b", callId: "AB!", callType: "audio" }, { env }) === null);
  const ids = new Set(Array.from({ length: 200 }, () => newCallId()));
  ok("T11", "newCallId: đúng định dạng, không trùng", [...ids].every((i) => CALL_ID_RE.test(i)) && ids.size === 200);
}

console.log(`\nCall signaling: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
