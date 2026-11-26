// Server cho bộ @playwright/test (playwright.config.ts → webServer). KHÔNG BAO GIỜ chạm Turso production:
//   1. chép prisma/dev.db (bản trong git HEAD) ra file tạm + `prisma db push` (schema hiện tại) — như make-qa-db.sh
//   2. chạy `next build` (nếu chưa có .next/BUILD_ID hoặc PW_REBUILD=1) rồi `next start` với
//      TURSO_DATABASE_URL=file:<DB tạm> (lib/prisma dùng libsql trên file đó, .env không ghi đè được biến đã đặt)
//      và SHOW_DEMO_DATA=1 (tài khoản @pawnailjobs.demo hiện ở /api/salons, /api/technicians).
// `next dev` biên dịch từng route lần đầu (60 s+ / route, ghi manifest song song → 500 giả) nên không dùng ở đây.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = process.env.PORT || "3000";
const db = path.join(os.tmpdir(), `pawnail-pw-${port}.db`).replace(/\\/g, "/");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args, env) => execFileSync(npx, args, { cwd: root, stdio: "inherit", env, shell: process.platform === "win32" });

fs.writeFileSync(db, execFileSync("git", ["show", "HEAD:prisma/dev.db"], { cwd: root, maxBuffer: 1 << 30 }));
const base = { ...process.env };
delete base.TURSO_AUTH_TOKEN;
delete base.TURSO_DATABASE_URL;
run(["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { ...base, DATABASE_URL: `file:${db}` });
console.log(`[pw-server] QA DB ${db}`);

const env = { ...base, TURSO_DATABASE_URL: `file:${db}`, SHOW_DEMO_DATA: "1", SESSION_RECHECK_MS: "0", PORT: port };
if (process.env.PW_REBUILD === "1" || !fs.existsSync(path.join(root, ".next", "BUILD_ID"))) run(["next", "build", "--webpack"], env);

const server = spawn(npx, ["next", "start", "-p", port], { cwd: root, stdio: "inherit", env, shell: process.platform === "win32" });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
