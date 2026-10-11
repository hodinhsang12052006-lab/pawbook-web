// Ẩn (KHÔNG xoá) tin tuyển có SĐT không gọi được: (555)… · 04x0000xxx tuần tự · số có dấu ***.
// Ẩn = đặt expiresAt = bây giờ → biến khỏi danh sách / email / thông báo; dữ liệu còn nguyên.
// Danh sách id lưu ở AppSetting "hidden_uncallable_jobs" để khôi phục:
//   npx tsx scripts/jobs-hide-uncallable.mts            → xem trước (không đổi gì)
//   npx tsx scripts/jobs-hide-uncallable.mts --apply    → ẩn
//   npx tsx scripts/jobs-hide-uncallable.mts --restore  → bật lại toàn bộ tin đã ẩn
import { createClient } from "@libsql/client";
process.loadEnvFile?.(".env");
const c = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const KEY = "hidden_uncallable_jobs";
const mode = process.argv.includes("--restore") ? "restore" : process.argv.includes("--apply") ? "apply" : "preview";

const uncallable = (p: string) => {
  const d = p.replace(/\D/g, "");
  if (p.includes("*")) return "số bị che ***";
  if (/\(555\)/.test(p) || d.slice(-7, -4) === "555") return "(555) số giả";
  if (/^04[12]0{4}/.test(d)) return "Úc tuần tự 04x0000xxx";
  return null;
};

if (mode === "restore") {
  const row = (await c.execute({ sql: `SELECT value FROM "AppSetting" WHERE key = ?`, args: [KEY] })).rows[0];
  const ids: string[] = row ? JSON.parse(String(row.value)) : [];
  for (const id of ids) await c.execute({ sql: `UPDATE "Job" SET expiresAt = NULL WHERE id = ? AND source IS NULL`, args: [id] });
  await c.execute({ sql: `DELETE FROM "AppSetting" WHERE key = ?`, args: [KEY] });
  console.log(`Đã bật lại ${ids.length} tin.`);
  process.exit(0);
}

const rows = (await c.execute(`SELECT j.id, j.phone, j.salonName, j.city, u.email, u.role FROM "Job" j JOIN "User" u ON u.id = j.ownerId WHERE j.source IS NULL AND j.expiresAt IS NULL`)).rows;
const pick: { id: string; why: string }[] = [];
for (const r of rows) {
  const why = uncallable(String(r.phone));
  // Tin tự sinh lúc admin đăng ký tài khoản chủ tiệm ("Bitpawos · cali")
  const adminSeed = r.role === "ADMIN" && /bitpawos/i.test(String(r.salonName)) && /^cali$/i.test(String(r.city));
  if (why) pick.push({ id: String(r.id), why });
  else if (adminSeed) pick.push({ id: String(r.id), why: "tin tự sinh khi admin đăng ký" });
}
const by: Record<string, number> = {};
for (const p of pick) by[p.why] = (by[p.why] || 0) + 1;
console.log(`${mode === "apply" ? "Ẩn" : "Sẽ ẩn"} ${pick.length}/${rows.length} tin:`, by);
if (mode !== "apply") process.exit(0);

const prev = (await c.execute({ sql: `SELECT value FROM "AppSetting" WHERE key = ?`, args: [KEY] })).rows[0];
const saved = new Set<string>(prev ? JSON.parse(String(prev.value)) : []);
const now = new Date().toISOString();
for (const p of pick) {
  await c.execute({ sql: `UPDATE "Job" SET expiresAt = ? WHERE id = ?`, args: [now, p.id] });
  saved.add(p.id);
}
await c.execute({ sql: `INSERT INTO "AppSetting" (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`, args: [KEY, JSON.stringify([...saved]), now] });
console.log(`Xong. Khôi phục: npx tsx scripts/jobs-hide-uncallable.mts --restore`);
