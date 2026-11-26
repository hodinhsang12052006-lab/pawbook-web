// Email "Mẫu nail 48 giờ không có mẫu mới" (lib/designsStallAlert.ts) trên SQLite TẠM + Resend giả lập (không gửi thật).
//   TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx tsx scripts/qa/designs_stall_alert_unit.mts
import "./lib/temp_db.mts"; // trước lib/prisma
import type { PrismaClient } from "@prisma/client";
const db = (globalThis as unknown as { prisma: PrismaClient }).prisma;
import http from "node:http";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { if (c) pass++; else fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

const sent: { subject: string; text: string }[] = [];
const server = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { sent.push(JSON.parse(b)); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"id":"qa"}'); }); });
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
Object.assign(process.env, { RESEND_ALLOW_TEST: "1", RESEND_TEST_BASE: `http://127.0.0.1:${(server.address() as { port: number }).port}`, RESEND_API_KEY: "qa", EMAIL_FROM: "PawNail <qa@example.test>", OPS_ALERT_EMAIL: "ops@example.test", AI_DESIGNS_ALLOW_DATA_URL: "1" });

const { alertIfDesignsStalled, DESIGNS_ALERT_SENT_AT_KEY } = await import("../../lib/designsStallAlert");
const { setSetting } = await import("../../lib/settings");

const now = new Date("2026-11-26T06:30:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
let n = 0;
const design = (data: Record<string, unknown>) =>
  db.nailDesign.create({ data: { day: "2026-11-26", title: `QA ${++n}`, titleEn: "QA", description: "", descriptionEn: "", skills: "[]", difficulty: 1, minutes: 30, priceHint: "$40", materials: "[]", steps: "[]", prompt: "qa", provider: "pawnail", ...data } as never });

await design({ status: "draft", createdAt: ago(5) });
await design({ status: "draft", createdAt: ago(6) });
await setSetting("designs_review", "1");
const r1 = await alertIfDesignsStalled(now);
ok("DS1", "Không mẫu nào lên trang 48 giờ + duyệt đang bật → 1 thư nói '2 mẫu đang chờ duyệt' và chỉ cách tắt", r1 === "sent" && sent.length === 1 && /2 mẫu đang chờ duyệt/.test(sent[0].text) && /admin\/studio/.test(sent[0].text), JSON.stringify({ r1, t: sent[0]?.text }));
ok("DS2", "Chạy lại trong ngày → không gửi thêm", (await alertIfDesignsStalled(new Date(now.getTime() + 3_600_000))) === "already-sent" && sent.length === 1);

await setSetting(DESIGNS_ALERT_SENT_AT_KEY, "");
await setSetting("designs_review", "0");
await setSetting("design_render", "0");
await design({ status: "published", imageUrl: null, createdAt: ago(3), publishedAt: ago(3) });
const r3 = await alertIfDesignsStalled(now);
ok("DS3", "Mẫu đã đăng nhưng chưa có ảnh + máy vẽ TẮT → thư nói bật vẽ ảnh (không nhắc duyệt)", r3 === "sent" && /máy vẽ ảnh đang TẮT/.test(sent[1]?.text ?? "") && !/chờ duyệt/.test(sent[1]?.text ?? ""), sent[1]?.text);

await setSetting(DESIGNS_ALERT_SENT_AT_KEY, "");
await design({ status: "published", imageUrl: "data:image/jpeg;base64,AA", createdAt: ago(2), publishedAt: ago(2) });
ok("DS4", "Có ít nhất 1 mẫu mới đã lên trang trong 48 giờ → không gửi thư", (await alertIfDesignsStalled(now)) === "fresh" && sent.length === 2);

server.close();
await db.$disconnect();
console.log(`\nDesigns stall alert: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
