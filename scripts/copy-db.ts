// Sao chép TOÀN BỘ database (bảng, index, dữ liệu) từ DB nguồn sang DB đích —
// dùng khi chuyển Turso sang vùng khác (VD Tokyo → Mỹ). Chỉ ĐỌC nguồn; đích
// phải là DB MỚI, TRỐNG (script dừng nếu đích đã có bảng).
//
//   SOURCE_URL=libsql://cu.turso.io SOURCE_TOKEN=... \
//   TARGET_URL=libsql://moi.turso.io TARGET_TOKEN=... \
//   npx tsx scripts/copy-db.ts
//
// Thử trên máy: SOURCE_URL=file:prisma/dev.db TARGET_URL=file:/tmp/copy.db npx tsx scripts/copy-db.ts
import { createClient, type InValue } from "@libsql/client";

const src = createClient({ url: need("SOURCE_URL"), authToken: process.env.SOURCE_TOKEN });
const dst = createClient({ url: need("TARGET_URL"), authToken: process.env.TARGET_TOKEN });
const BATCH = 200;

function need(k: string): string {
  const v = process.env[k];
  if (!v) {
    console.error(`Thiếu biến ${k}. Xem hướng dẫn ở đầu file.`);
    process.exit(1);
  }
  return v;
}
const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function main() {
  if (process.env.SOURCE_URL === process.env.TARGET_URL) throw new Error("Nguồn và đích trùng nhau.");

  const existing = await dst.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
  if (existing.rows.length) throw new Error(`DB đích đã có ${existing.rows.length} bảng — cần DB MỚI, TRỐNG.`);

  const schema = await src.execute(
    `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
  );
  const tables = schema.rows.filter((r) => r.type === "table").map((r) => String(r.name));

  // 1) Bảng trước (tắt kiểm tra khoá ngoại để thứ tự chép không quan trọng)
  await dst.execute("PRAGMA foreign_keys = OFF");
  for (const r of schema.rows.filter((r) => r.type === "table")) await dst.execute(String(r.sql));

  // 2) Dữ liệu theo lô, giữ nguyên rowid thứ tự
  let total = 0;
  for (const t of tables) {
    const cols = (await src.execute(`PRAGMA table_info(${q(t)})`)).rows.map((c) => String(c.name));
    const n = Number((await src.execute(`SELECT COUNT(*) AS n FROM ${q(t)}`)).rows[0].n);
    const insert = `INSERT INTO ${q(t)} (${cols.map(q).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
    for (let off = 0; off < n; off += BATCH) {
      const rows = await src.execute({ sql: `SELECT ${cols.map(q).join(",")} FROM ${q(t)} ORDER BY rowid LIMIT ? OFFSET ?`, args: [BATCH, off] });
      await dst.batch(rows.rows.map((row) => ({ sql: insert, args: cols.map((c) => row[c] as InValue) })), "write");
    }
    total += n;
    console.log(`  ${t.padEnd(28)} ${n}`);
  }

  // 3) Index / trigger / view sau khi có dữ liệu (nhanh hơn)
  for (const r of schema.rows.filter((r) => r.type !== "table")) await dst.execute(String(r.sql));
  await dst.execute("PRAGMA foreign_keys = ON");

  // 4) Đối chiếu số dòng từng bảng
  let bad = 0;
  for (const t of tables) {
    const a = Number((await src.execute(`SELECT COUNT(*) AS n FROM ${q(t)}`)).rows[0].n);
    const b = Number((await dst.execute(`SELECT COUNT(*) AS n FROM ${q(t)}`)).rows[0].n);
    if (a !== b) {
      bad++;
      console.error(`✗ ${t}: nguồn ${a} ≠ đích ${b}`);
    }
  }
  if (bad) throw new Error(`${bad} bảng lệch số dòng — KHÔNG đổi URL trên Vercel.`);
  console.log(`\n✓ Đã chép ${tables.length} bảng, ${total} dòng, khớp 100%. Giờ có thể đổi TURSO_DATABASE_URL/TURSO_AUTH_TOKEN trên Vercel.`);
}

main().catch((e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  process.exit(1);
});
