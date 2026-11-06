// Cầu nối ảnh Google Flow (lib/flowMarks, lib/flowBriefs, lib/designArt, lib/flowBridge + chặn ghi đè trong lib/aiDesigns):
// dấu prompt, resolveCode, kiểm tra link Cloudinary, nhập lại không đổi gì, hoàn tác, máy tự vẽ bỏ qua ảnh Flow.
// CHỈ chạy trên BẢN SAO của một DB SQLite local (mặc định prisma/dev.db → file tạm, xoá khi xong):
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/flow_bridge_unit.mts
//   (FLOW_UNIT_DB=<đường dẫn .db> để dùng DB local khác làm bản gốc — bản gốc không bao giờ bị ghi)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

if (process.env.TURSO_DATABASE_URL) {
  console.error("❌ TURSO_DATABASE_URL đang đặt — bài test chỉ chạy trên bản sao DB local. Chạy: env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/flow_bridge_unit.mts");
  process.exit(1);
}
const SRC = path.resolve(process.env.FLOW_UNIT_DB || "prisma/dev.db");
if (!fs.existsSync(SRC) || !/\.db$/i.test(SRC)) { console.error(`❌ Không thấy DB SQLite local: ${SRC}`); process.exit(1); }
const TMP = path.join(os.tmpdir(), `flow_bridge_unit_${process.pid}_${Date.now()}.db`);
fs.copyFileSync(SRC, TMP);
const DB_URL = `file:${TMP.replace(/\\/g, "/")}`;
// @prisma/client tự nạp file .env cạnh schema của bản cài (với node_modules dùng chung có thể là .env trỏ DB PRODUCTION).
// Biến đã có (kể cả rỗng) không bị .env ghi đè → đặt trước mọi import có prisma.
Object.assign(process.env, {
  TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", DATABASE_URL: DB_URL,
  CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "", AI_DESIGNS_ALLOW_DATA_URL: "1",
  CF_ACCOUNT_ID: "", CF_AI_TOKEN: "", GEMINI_API_KEY: "", PUSHER_APP_ID: "", PUSHER_SECRET: "", NEXT_PUBLIC_PUSHER_APP_KEY: "",
});

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x: unknown = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + (typeof x === "string" ? x : JSON.stringify(x))}`); };

// ---- bản sao DB: bổ sung bảng còn thiếu theo prisma/schema.prisma (prisma migrate diff, chỉ đọc/ghi file tạm) ----
const diff = spawnSync(process.execPath, [path.join("node_modules", "prisma", "build", "index.js"), "migrate", "diff", "--from-url", DB_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", env: process.env });
if (diff.status !== 0) { console.error("❌ prisma migrate diff lỗi:", String(diff.stderr).slice(0, 400)); process.exit(1); }
const { createClient } = await import("@libsql/client");
const raw = createClient({ url: DB_URL });
if (diff.stdout.trim() && !/^-- This is an empty migration/m.test(diff.stdout)) await raw.executeMultiple(diff.stdout);
raw.close();

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });
(globalThis as unknown as { prisma: unknown }).prisma = db; // lib/prisma dùng client này (global.prisma)
const prismaMod = await import("../../lib/prisma");
const pm = prismaMod as unknown as { default: { default?: unknown } };
const libPrisma = pm.default?.default ?? pm.default;
const real = (f: string) => { try { return fs.realpathSync.native(f).toLowerCase(); } catch { return path.resolve(f).toLowerCase(); } };
const dbList = (await db.$queryRawUnsafe("PRAGMA database_list")) as { file: string }[];
ok("DB0", "lib/prisma dùng đúng bản sao DB tạm (không phải DB gốc / production)", libPrisma === db && real(dbList[0]?.file ?? "") === real(TMP), dbList);

const M = await import("../../lib/flowMarks");
const B = await import("../../lib/flowBriefs");
const A = await import("../../lib/designArt");
const FB = await import("../../lib/flowBridge");
const AI = await import("../../lib/aiDesigns");

// ---------------- bảng mã lô 2026-11 + resolveCode ----------------
const man = B.FLOW_MANIFEST;
ok("M1", "bảng mã 2026-11 có 213 mã D001…D213, mã & mẫu không trùng", man.length === 213 && new Set(man.map((b) => b.code)).size === 213 && new Set(man.map((b) => b.designId)).size === 213 && man.every((b, i) => b.code === `D${String(i + 1).padStart(3, "0")}`));
const arch = JSON.parse(fs.readFileSync("scripts/qa/data/design_archive_2026-11.json", "utf8")) as Record<string, { id: string }[]>;
const archived = new Set([...arch.hide_now, ...arch.hide_now_tier1b_sticker_motifs].map((x) => x.id));
ok("M2", "không mã nào trỏ vào mẫu đã cất (archive 2026-11)", man.every((b) => !archived.has(b.designId)));
const d1 = man[0];
ok("R1", "resolveCode D001 / d001 / ' D001 ' → đúng mẫu", ["D001", "d001", " D001 "].every((c) => B.resolveCode(c)?.designId === d1.designId && B.resolveCode(c)?.code === "D001"));
ok("R2", "resolveCode mã không có trong lô (D999, D000) → null", B.resolveCode("D999") === null && B.resolveCode("D000") === null);
ok("R3", "resolveCode id mẫu → chính nó (lô sau)", B.resolveCode("cabcdefghij0123456789klmn")?.designId === "cabcdefghij0123456789klmn" && B.resolveCode("cabcdefghij0123456789klmn")?.code === "cabcdefghij0123456789klmn");
ok("R4", "resolveCode id mẫu của lô 2026-11 → kèm brief", B.resolveCode(d1.designId)?.brief?.code === "D001");
ok("R5", "resolveCode rác (rỗng, D01, ../x, URL, số) → null", ["", "D01", "D0011", "../x", "https://x", 12, null, "C" + "a".repeat(24)].every((c) => B.resolveCode(c) === null));

// ---------------- tên file → mã ----------------
const fn: [string, string | null][] = [
  ["D001.png", "D001"], ["D017 (1).jpeg", "D017"], ["flow_d042_final.webp", "D042"], ["Raspberry D213.jpg", "D213"],
  ["cmw4kaz9k0005k4081bilju8i.jpg", "cmw4kaz9k0005k4081bilju8i"], ["D001_cmw4kaz9k0005k4081bilju8i.png", "cmw4kaz9k0005k4081bilju8i"],
  ["random.jpg", null], ["ND001.png", null], ["D0012.png", null], ["chocolatebrownandgoldnailsx.jpg", null], ["IMG_2001.jpg", null],
];
const badFn = fn.filter(([n, want]) => M.codeFromFilename(n) !== want);
ok("F1", "đọc mã từ tên file (D-mã ở bất kỳ đâu, id mẫu ưu tiên, không bắt nhầm từ dài / số ảnh)", !badFn.length, badFn.map(([n]) => `${n}→${M.codeFromFilename(n)}`));
ok("F2", "public_id theo mẫu (không đè ảnh mẫu khác khi lô sau dùng lại D001)", M.flowPublicId("D001", d1.designId) === `D001_${d1.designId}` && M.flowPublicId(d1.designId, d1.designId) === d1.designId);
let threw = false;
try { M.flowPublicId("../D001", d1.designId); } catch { threw = true; }
ok("F3", "public_id từ mã lạ → ném lỗi", threw);

// ---------------- kiểm tra kết quả tải lên Cloudinary ----------------
const CLOUD = "qa-cloud";
const nowS = Math.round(Date.now() / 1000);
const pid = `D001_${d1.designId}`;
const good = { secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v${nowS}/pawbook/designs-flow/${pid}.jpg`, public_id: `pawbook/designs-flow/${pid}`, width: 2048, height: 2048, bytes: 912_345 };
const chk = (u: Partial<typeof good>) => M.checkFlowUpload({ ...good, ...u }, { cloudName: CLOUD, publicId: pid, nowS });
ok("U1", "ảnh hợp lệ (đúng kho, thư mục, public_id, 2048², vuông) → không lỗi", chk({}) === null, chk({}));
ok("U2", "vuông lệch ≤ 2% vẫn nhận (1024×1040)", chk({ width: 1024, height: 1040 }) === null);
const bads: [string, Partial<typeof good>][] = [
  ["http", { secure_url: good.secure_url.replace("https:", "http:") }],
  ["host khác", { secure_url: good.secure_url.replace("res.cloudinary.com", "res.cloudinary.com.evil.test") }],
  ["kho Cloudinary khác", { secure_url: good.secure_url.replace(`/${CLOUD}/`, "/other-cloud/") }],
  ["thư mục khác", { secure_url: good.secure_url.replace("designs-flow", "designs"), public_id: `pawbook/designs/${pid}` }],
  ["public_id lệch link", { public_id: `pawbook/designs-flow/D002_${d1.designId}` }],
  ["public_id của mã khác", { secure_url: good.secure_url.replace(pid, `D002_${man[1].designId}`), public_id: `pawbook/designs-flow/D002_${man[1].designId}` }],
  ["có query", { secure_url: `${good.secure_url}?x=1` }],
  ["có biến đổi ảnh", { secure_url: good.secure_url.replace("/upload/", "/upload/w_100/") }],
  ["đuôi lạ", { secure_url: good.secure_url.replace(".jpg", ".svg") }],
  ["nhỏ hơn 1024", { width: 1000, height: 1000 }],
  ["không vuông", { width: 1024, height: 1100 }],
  ["bytes 0", { bytes: 0 }],
  ["bytes quá lớn", { bytes: 40 * 1024 * 1024 }],
  ["width không phải số nguyên", { width: 2048.5 }],
  ["tải lên quá cũ", { secure_url: good.secure_url.replace(`v${nowS}`, `v${nowS - 3 * 86_400}`) }],
];
const passedBad = bads.filter(([, u]) => chk(u) === null).map(([n]) => n);
ok("U3", `từ chối ${bads.length} kiểu kết quả tải lên sai`, !passedBad.length, passedBad);

// ---------------- dấu prompt: nhập / nhập lại / hoàn tác ----------------
const OLD = "https://res.cloudinary.com/wwtkzrvp/image/upload/v1793944643/pawbook/designs/ufof8vrk2vmovyyyj1bw.jpg";
const AIURL = "https://res.cloudinary.com/wwtkzrvp/image/upload/v1790000000/pawbook/designs/oldai.jpg";
const P1 = `Raspberry colour chrome almond nails\n\nProfessional nail salon portfolio photograph[ai:${AIURL}][redraws:1][pr:2026-11-01:h2]`;
const i1 = M.importPrompt(P1, OLD, "D001", "2026-11-06");
ok("P1", "nhập: gỡ [pr:][redraws:], giữ [ai:], thêm [was:ảnh cũ] + [flow:D001:2026-11-06]", !/\[(pr|redraws|q|try|img|hid):/.test(i1) && i1.includes(`[ai:${AIURL}]`) && i1.includes(`[was:${OLD}]`) && i1.endsWith("[flow:D001:2026-11-06]") && M.isFlowPrompt(i1), i1);
ok("P2", "dấu [wasmk:] không lọt vào bộ lọc vẽ lại (không chứa ':h2]' / '[pr:')", !i1.includes(":h2]") && !i1.includes("[pr:"));
const i2 = M.importPrompt(i1, "https://res.cloudinary.com/qa-cloud/image/upload/v1/pawbook/designs-flow/x.jpg", "D001", "2026-11-07");
ok("P3", "nhập lại (đã là ảnh Flow): [was:] vẫn là ảnh GỐC, 1 dấu [flow:] mới", (i2.match(/\[was:/g) ?? []).length === 1 && i2.includes(`[was:${OLD}]`) && (i2.match(/\[flow:/g) ?? []).length === 1 && i2.endsWith("[flow:D001:2026-11-07]"), i2);
const u1 = M.undoPrompt(i2);
ok("P4", "hoàn tác: trả đúng ảnh gốc + prompt gốc (đủ [ai:][redraws:][pr:])", u1?.imageUrl === OLD && u1?.prompt === P1, u1);
ok("P5", "hoàn tác prompt không phải ảnh Flow → null", M.undoPrompt(P1) === null);
const i3 = M.importPrompt("plain prompt", null, "D002", "2026-11-06");
ok("P6", "mẫu chưa có ảnh: [was:] rỗng → hoàn tác về null", i3.includes("[was:]") && M.undoPrompt(i3)?.imageUrl === null && M.undoPrompt(i3)?.prompt === "plain prompt");
const long = "x".repeat(1990) + "[q:8]";
const i4 = M.importPrompt(long, OLD, "D003", "2026-11-06");
ok("P7", "prompt dài: vẫn ≤ 2000 ký tự và giữ đủ dấu", i4.length <= 2000 && i4.endsWith("[flow:D003:2026-11-06]") && i4.includes(`[was:${OLD}]`), i4.length);
threw = false;
try { M.importPrompt("p", "data:image/png;base64,AAAA", "D001", "2026-11-06"); } catch { threw = true; }
ok("P8", "ảnh cũ là data URL (không cất được) → từ chối nhập, không làm mất ảnh", threw);
ok("P9", "vẽ lại ảnh Flow: link Flow cất vào [ai:]", M.redrawKeepMark(i1, "https://res.cloudinary.com/q/image/upload/v1/pawbook/designs-flow/a.jpg") === "[ai:https://res.cloudinary.com/q/image/upload/v1/pawbook/designs-flow/a.jpg]" && M.redrawKeepMark(P1, OLD) === "");

// ---------------- brief cho Flow (lib/designArt) ----------------
const fake = Array.from({ length: 30 }, (_, i) => ({ code: `c${String(i).padStart(2, "0")}qa0000000000000000000x`.slice(0, 25), titleEn: `Design ${i}`, shape: ["almond", "coffin", "square"][i % 3], pattern: i % 7 === 6 ? "nonexistent" : ["solid", "french", "marble", "aura", "lace", "velvet"][i % 6], finish: ["glossy", "matte", "chrome"][i % 3] }));
const batches = A.flowBatches(fake);
ok("A1", "30 mẫu → 3 lô (12, 12, 6), đủ mã, đúng thứ tự", batches.length === 3 && batches[0].codes.length === 12 && batches[2].codes.length === 6 && batches.flatMap((b) => b.codes).join() === fake.map((f) => f.code).join());
const deepShare = (n: number) => Array.from({ length: n }, (_, k) => A.ART_SKIN[k % A.ART_SKIN.length].deep).filter(Boolean).length / n;
ok("A2", "mỗi lô (và mọi đoạn đầu ≥ 5 ảnh): ≥ 60% da trung bình / sẫm", Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => n >= 5).every((n) => deepShare(n) >= 0.6) && deepShare(12) >= 0.6);
const allText = batches.map((b) => b.text).join("\n");
ok("A3", "không nền len kem (khung ảnh cũ), chỉ dùng 8 nền đã duyệt", !/knit|cream/i.test(allText) && batches.every((b) => b.codes.every((_, k) => b.text.includes(A.ART_BACKDROP[k % 8]))));
ok("A4", "tin nhắn lô: 1 ảnh / brief, vuông 1:1, đổi tên đúng mã, kiểu ảnh chung", batches.every((b) => b.text.includes(`then rename each created image to exactly its brief code (e.g. ${b.codes[0]})`) && b.text.includes("square 1:1") && b.text.includes(A.ART_STYLE) && b.codes.every((c) => b.text.includes(`[${c}] `))));
const bp = A.briefPrompt(fake[1], 1);
ok("A5", "brief đơn: ảnh portfolio cận 1 bàn tay, mô tả kỹ thuật + hiệu ứng", bp.startsWith("Professional nail salon portfolio photograph, square format. Close-up of one deep brown hand with medium-length coffin nails: Design 1 (technique: clean classic French tips), velvety matte top coat.") && bp.endsWith(A.ART_STYLE), bp);
ok("A6", "hoạ tiết lạ → không bịa kỹ thuật; tên có ngoặc [] bị gỡ", !A.briefSubject(fake[6], 0).includes("technique:") && !A.briefSubject({ ...fake[0], titleEn: "Bad [flow:x] title" }, 0).includes("["));

// ---------------- DB: nhập / nhập lại / hoàn tác + chặn máy tự vẽ đè ----------------
const base = { day: "2026-11-06", market: "US" as const, title: "Mẫu QA", description: "", descriptionEn: "", skills: "Gel-X", difficulty: 1, minutes: 45, priceHint: "$40", materials: "[]", steps: "[]", palette: '["#c2185b","#f5f0e8"]', shape: "almond", finish: "glossy", provider: "pawnail", status: "published", publishedAt: new Date() };
const idB = man[1].designId; // D002
const idC = "cqaflow0bridge0unit00000x"; // mẫu ngoài lô (mã = id mẫu)
const idF = "cqaflow0bridge0control00x"; // mẫu đối chứng: ảnh cũ, máy được vẽ lại
const idN = "cqaflow0bridge0nullimg00x"; // vẽ bù: chưa có ảnh
const idNF = "cqaflow0bridge0nullflow0x"; // vẽ bù: chưa có ảnh nhưng mang dấu Flow (giả lập)
const PB = "Chocolate brown double French\n\nstyle[q:8][img:2026-10-12]";
const PF = "Control solid nails\n\nstyle[q:7][img:2026-10-10]";
await db.nailDesign.deleteMany({ where: { id: { in: [d1.designId, idB, idC, idF, idN, idNF] } } });
await db.nailDesign.createMany({ data: [
  { ...base, id: d1.designId, titleEn: d1.title, pattern: "solid", imageUrl: OLD, prompt: P1 },
  { ...base, id: idB, titleEn: man[1].title, pattern: "doublefrench", imageUrl: "https://res.cloudinary.com/wwtkzrvp/image/upload/v1790000001/pawbook/designs/b.jpg", prompt: PB },
  { ...base, id: idC, titleEn: "Outside batch", pattern: "solid", imageUrl: null, prompt: "plain QA prompt" },
  { ...base, id: idF, titleEn: "Control", pattern: "solid", imageUrl: "https://res.cloudinary.com/wwtkzrvp/image/upload/v1790000002/pawbook/designs/f.jpg", prompt: PF },
  { ...base, id: idN, titleEn: "Backfill", pattern: "solid", status: "draft", publishedAt: null, imageUrl: null, prompt: "Backfill nails\n\nstyle" },
  { ...base, id: idNF, titleEn: "Backfill flow", pattern: "solid", status: "draft", publishedAt: null, imageUrl: null, prompt: "Backfill nails\n\nstyle[was:][flow:D999:2026-11-06]" },
] });
const ids = [d1.designId, idB, idC, idF, idN, idNF];
const oldIds = async () => (await db.nailDesign.findMany({ where: { AND: [AI.oldImageWhere(), { id: { in: ids } }] }, select: { id: true } })).map((r) => r.id).sort();
const backIds = async () => (await db.nailDesign.findMany({ where: { AND: [AI.backfillWhere(), { id: { in: ids } }] }, select: { id: true } })).map((r) => r.id).sort();
ok("G1", "trước khi nhập: ảnh cũ chờ vẽ lại = D002 + đối chứng (D001 đã vẽ h2)", JSON.stringify(await oldIds()) === JSON.stringify([idB, idF].sort()), await oldIds());
ok("G2", "vẽ bù (mẫu chưa có ảnh) bỏ qua mẫu mang dấu Flow", JSON.stringify(await backIds()) === JSON.stringify([idC, idN].sort()), await backIds());

const up = (code: string, designId: string, v = nowS, ext = "jpg") => {
  const p = M.flowPublicId(code, designId);
  return { code, secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v${v}/pawbook/designs-flow/${p}.${ext}`, public_id: `pawbook/designs-flow/${p}`, width: 2048, height: 2048, bytes: 800_000 };
};
const opts = { cloudName: CLOUD, date: "2026-11-06" };
const rB = await FB.importFlowImage(up("D002", idB), opts);
const rowB = await db.nailDesign.findUnique({ where: { id: idB } });
ok("I1", "nhập D002: 1 lệnh update đổi ảnh + dấu (was ảnh cũ, gỡ [q:][img:])", rB.ok && rowB?.imageUrl === up("D002", idB).secure_url && rowB.prompt.includes("[was:https://res.cloudinary.com/wwtkzrvp/image/upload/v1790000001/pawbook/designs/b.jpg]") && rowB.prompt.endsWith("[flow:D002:2026-11-06]") && !/\[(q|img):/.test(rowB.prompt), { rB, p: rowB?.prompt });
const rB2 = await FB.importFlowImage(up("D002", idB), opts);
const rowB2 = await db.nailDesign.findUnique({ where: { id: idB } });
ok("I2", "nhập lại đúng ảnh đó → unchanged, prompt y nguyên (idempotent)", rB2.ok && (rB2 as { unchanged?: boolean }).unchanged === true && rowB2?.prompt === rowB?.prompt);
const rB3 = await FB.importFlowImage(up("D002", idB, nowS + 5), { ...opts, date: "2026-11-07" });
const rowB3 = await db.nailDesign.findUnique({ where: { id: idB } });
ok("I3", "nhập ảnh Flow mới cho cùng mẫu → [was:] vẫn là ảnh GỐC (không phải ảnh Flow lần 1)", rB3.ok && rowB3?.imageUrl === up("D002", idB, nowS + 5).secure_url && (rowB3.prompt.match(/\[was:/g) ?? []).length === 1 && rowB3.prompt.includes("pawbook/designs/b.jpg]") && rowB3.prompt.endsWith("[flow:D002:2026-11-07]"), rowB3?.prompt);
const st = (r: { ok: boolean; status?: number }) => (r.ok ? 200 : r.status);
ok("I4", "mã lạ → 400, mã đúng nhưng mẫu không có trong DB → 404", st(await FB.importFlowImage({ ...up("D002", idB), code: "D9x9" }, opts)) === 400 && st(await FB.importFlowImage(up("D213", man[212].designId), opts)) === 404);
const wrong = await FB.importFlowImage({ ...up("D002", idB), secure_url: up("D001", d1.designId).secure_url, public_id: up("D001", d1.designId).public_id }, opts);
const nonsq = await FB.importFlowImage({ ...up("D002", idB), height: 1500 }, opts);
const rowB4 = await db.nailDesign.findUnique({ where: { id: idB } });
ok("I5", "ảnh của mã khác / không vuông → 422, mẫu không bị đổi", !wrong.ok && (wrong as { status: number }).status === 422 && !nonsq.ok && (nonsq as { status: number }).status === 422 && rowB4?.prompt === rowB3?.prompt && rowB4?.imageUrl === rowB3?.imageUrl);
const rC = await FB.importFlowImage(up(idC, idC), opts);
const rowC = await db.nailDesign.findUnique({ where: { id: idC } });
ok("I6", "mã = id mẫu (lô sau): nhập được, mẫu chưa có ảnh → [was:]", rC.ok && rowC?.imageUrl === up(idC, idC).secure_url && rowC.prompt.includes("[was:]") && rowC.prompt.endsWith(`[flow:${idC}:2026-11-06]`), rowC?.prompt);
const rA = await FB.importFlowImage(up("D001", d1.designId), opts);
ok("I7", "nhập D001 (mẫu đã vẽ h2, có [ai:]) → giữ [ai:], gỡ [pr:]", rA.ok && !!(await db.nailDesign.findUnique({ where: { id: d1.designId } }))?.prompt.match(/\[ai:[^\]]+oldai\.jpg\]/) && !(await db.nailDesign.findUnique({ where: { id: d1.designId } }))?.prompt.includes("[pr:"));

const pubA = AI.toPublic((await db.nailDesign.findUnique({ where: { id: d1.designId }, include: { _count: { select: { saves: true } } } }))!);
const pubF = AI.toPublic((await db.nailDesign.findUnique({ where: { id: idF }, include: { _count: { select: { saves: true } } } }))!);
ok("T1", "toPublic ảnh Flow: rendered=false (nhãn 'Ảnh minh hoạ AI'), imageSource 'flow'", pubA.rendered === false && pubA.imageSource === "flow", pubA);
ok("T2", "toPublic mẫu thường giữ nguyên (imageSource 'ai')", pubF.rendered === false && pubF.imageSource === "ai");
ok("G3", "sau khi nhập: chỉ còn mẫu đối chứng chờ vẽ lại (ảnh Flow bị loại)", JSON.stringify(await oldIds()) === JSON.stringify([idF]), await oldIds());

// máy PawNail vẽ lại ảnh cũ (cron / nút "Vẽ lại toàn bộ"): mẫu đối chứng được vẽ, ảnh Flow KHÔNG bị đụng
const before = await db.nailDesign.findMany({ where: { id: { in: [d1.designId, idB, idC] } }, orderBy: { id: "asc" }, select: { id: true, imageUrl: true, prompt: true } });
const rr = await AI.rerenderAiImages(Date.now() + 90_000, 6);
const after = await db.nailDesign.findMany({ where: { id: { in: [d1.designId, idB, idC] } }, orderBy: { id: "asc" }, select: { id: true, imageUrl: true, prompt: true } });
const rowF = await db.nailDesign.findUnique({ where: { id: idF } });
ok("G4", "rerenderAiImages: vẽ lại mẫu đối chứng, 3 ảnh Flow y nguyên", rr.done >= 1 && !!rowF?.imageUrl?.startsWith("data:image/jpeg") && JSON.stringify(after) === JSON.stringify(before), { rr, f: rowF?.prompt?.slice(-60) });

// admin bấm "Vẽ lại ảnh" trên 1 mẫu đang là ảnh Flow → được vẽ (explicit), dấu Flow gỡ, link Flow cất trong [ai:]
const flowUrlA = up("D001", d1.designId).secure_url;
const rd = await AI.redrawImage(d1.designId);
const rowA = await db.nailDesign.findUnique({ where: { id: d1.designId } });
ok("G5", "admin vẽ lại ảnh Flow: gỡ [flow:][was:], link ảnh Flow cất vào [ai:]", !!rd.imageUrl && !!rowA?.imageUrl?.startsWith("data:") && !/\[(flow|was|wasmk):/.test(rowA.prompt) && rowA.prompt.includes(`[ai:${flowUrlA}]`) && /\[pr:\d{4}-\d{2}-\d{2}:h2\]/.test(rowA.prompt), { rd: rd.error, p: rowA?.prompt?.slice(-200) });

// hoàn tác
const uB = await FB.undoFlowImage(idB);
const rowBU = await db.nailDesign.findUnique({ where: { id: idB } });
ok("H1", "hoàn tác D002: ảnh gốc + prompt gốc (đủ [q:][img:]) — khớp từng ký tự", uB.ok && rowBU?.imageUrl === "https://res.cloudinary.com/wwtkzrvp/image/upload/v1790000001/pawbook/designs/b.jpg" && rowBU.prompt === PB, rowBU?.prompt);
const uB2 = await FB.undoFlowImage(idB);
ok("H2", "hoàn tác lần 2 → 409 (không còn ảnh Flow)", !uB2.ok && (uB2 as { status: number }).status === 409);
const uC = await FB.undoFlowImage(idC);
const rowCU = await db.nailDesign.findUnique({ where: { id: idC } });
ok("H3", "hoàn tác mẫu trước đó chưa có ảnh → imageUrl null, prompt gốc", uC.ok && rowCU?.imageUrl === null && rowCU.prompt === "plain QA prompt");
ok("H4", "hoàn tác id rác → 400", ((await FB.undoFlowImage("../x")) as { status: number }).status === 400);
ok("G6", "sau hoàn tác: D002 lại là ảnh cũ chờ máy vẽ lại (đúng như trước khi nhập)", (await oldIds()).includes(idB));

const list = await FB.lookupCodes(["D002", idC, "zzz", "D999"]);
ok("L1", "lookupCodes: mã lô, id mẫu, mã rác", list.length === 4 && list[0].found && list[0].designId === idB && list[1].found && list[1].code === idC && !list[2].found && list[2].designId === "" && !list[3].found);
const mf = await FB.listManifest();
ok("L2", "listManifest: 213 dòng theo thứ tự mã, có ảnh hiện tại", mf.rows.length === 213 && mf.rows[1].code === "D002" && mf.rows[1].imageUrl === rowBU?.imageUrl && mf.rows[1].flow === null && mf.rows[0].found);
const ex = await FB.exportCandidates();
ok("L3", "xuất brief: mẫu đã đăng chưa có ảnh Flow (không lấy nháp)", ex.some((e) => e.id === idB) && !ex.some((e) => e.id === idN));

await db.$disconnect();
try { fs.unlinkSync(TMP); } catch { /* Windows có thể còn giữ file — bản tạm, bỏ qua */ }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
