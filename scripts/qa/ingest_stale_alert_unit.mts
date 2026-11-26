// Email cảnh báo bot nhóm Facebook ngừng gửi tin (lib/jobIngest/staleAlert.ts) trên SQLite TẠM + máy chủ Resend giả lập
// (127.0.0.1, RESEND_ALLOW_TEST) — không bao giờ gửi thư thật, không đụng prisma/dev.db hay production.
//   TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx tsx scripts/qa/ingest_stale_alert_unit.mts
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …");
import { execSync } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { if (c) pass++; else fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

const dbFile = path.join(os.tmpdir(), `pawnail_stalealert_${Date.now()}.db`).replace(/\\/g, "/");
const url = `file:${dbFile}`;
execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
const db = new PrismaClient({ datasources: { db: { url } } });
(globalThis as unknown as { prisma: PrismaClient }).prisma = db;

const sent: { to: string[]; subject: string; text: string }[] = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => { sent.push(JSON.parse(body)); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"id":"qa"}'); });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;
Object.assign(process.env, { RESEND_ALLOW_TEST: "1", RESEND_TEST_BASE: `http://127.0.0.1:${port}`, RESEND_API_KEY: "qa", EMAIL_FROM: "PawNail <qa@example.test>", OPS_ALERT_EMAIL: "ops@example.test" });
delete process.env.INGEST_AGGREGATED;

const { alertIfIngestStale, INGEST_ALERT_SENT_AT_KEY } = await import("../../lib/jobIngest/staleAlert");
const { INGEST_LAST_AT_KEY, INGEST_LAST_BATCH_AT_KEY } = await import("../../lib/jobIngest/ingest");
const { setSetting, getSetting } = await import("../../lib/settings");

const now = new Date("2026-11-26T03:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

await setSetting(INGEST_LAST_AT_KEY, hoursAgo(3));
ok("SA1", "Bot gửi tin 3 giờ trước → không gửi thư", (await alertIfIngestStale(now)) === "fresh" && sent.length === 0);

await setSetting(INGEST_LAST_AT_KEY, hoursAgo(14 * 24));
const r2 = await alertIfIngestStale(now);
const m = sent[0];
ok("SA2", "Bot im 14 ngày → 1 thư tới OPS_ALERT_EMAIL, tiêu đề nói số ngày, nội dung chỉ cách đổi cookie", r2 === "sent" && sent.length === 1 && m?.to?.[0] === "ops@example.test" && /14 ngày/.test(m.subject) && /CAP_NHAT_COOKIE\.bat/.test(m.text), JSON.stringify({ r2, m }));
ok("SA3", "Đã ghi mốc gửi thư", (await getSetting(INGEST_ALERT_SENT_AT_KEY)) === now.toISOString());

ok("SA4", "Cron chạy lại sau 6 giờ → không gửi thêm (tối đa 1 thư / ngày)", (await alertIfIngestStale(new Date(now.getTime() + 6 * 3_600_000))) === "already-sent" && sent.length === 1);
ok("SA5", "Ngày hôm sau vẫn im → gửi thư nhắc", (await alertIfIngestStale(new Date(now.getTime() + 24 * 3_600_000))) === "sent" && sent.length === 2);

await setSetting(INGEST_ALERT_SENT_AT_KEY, "");
await setSetting(INGEST_LAST_BATCH_AT_KEY, hoursAgo(1));
const r6 = await alertIfIngestStale(now);
ok("SA6", "Bot vẫn gửi lô nhưng mọi bài bị loại → thư nói đúng nguyên nhân (không bảo đổi cookie)", r6 === "sent" && /bị loại/.test(sent[2]?.text ?? "") && !/CAP_NHAT_COOKIE/.test(sent[2]?.text ?? ""), sent[2]?.text);

await setSetting(INGEST_ALERT_SENT_AT_KEY, "");
process.env.INGEST_AGGREGATED = "off";
ok("SA7", "Chủ tắt nhận tin (INGEST_AGGREGATED=off) → không gửi thư", (await alertIfIngestStale(now)) === "intake-off" && sent.length === 3);
delete process.env.INGEST_AGGREGATED;

delete process.env.RESEND_API_KEY;
ok("SA8", "Chưa cấu hình Resend → không lỗi, trả 'email-off'", (await alertIfIngestStale(now)) === "email-off");

server.close();
await db.$disconnect();
console.log(`\nIngest stale alert: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
