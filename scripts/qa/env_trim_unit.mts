// lib/envTrim: cắt khoảng trắng 2 đầu của biến môi trường (khoá dán vào Vercel dính "\n").   npx tsx scripts/qa/env_trim_unit.mts
import { trimEnv, trimmedEnvNames } from "../../lib/envTrim";
const env: Record<string, string | undefined> = { A: "key123\n", B: " tok ", C: "ok", D: '{"a":1}\r\n', E: undefined };
const fixed = trimEnv(env);
const pass = env.A === "key123" && env.B === "tok" && env.C === "ok" && env.D === '{"a":1}' && fixed.join(",") === "A,B,D" && trimmedEnvNames().join(",") === "A,B,D";
console.log(`${pass ? "✅" : "❌"} [E1] cắt xuống dòng / dấu cách / CRLF ở 2 đầu, giữ nguyên biến sạch, trả TÊN biến đã sửa`);
console.log(`\nenvTrim: ${pass ? 1 : 0}/1 PASS`);
process.exit(pass ? 0 : 1);
