// Nâng 1 tài khoản thành ADMIN = tài khoản CHÍNH THỨC (tick xanh, ghim đầu
// tin nhắn của mọi người, vào Phòng nội dung / Lead Radar / Báo cáo).
//   npx tsx scripts/make-admin.ts email@cua-ban.com
// Chạy với .env trỏ vào Turso production. Chỉ đổi đúng 1 dòng, in trước/sau.
import { createClient } from "@libsql/client";

// Không ghi đè biến đã có sẵn trong môi trường.
process.loadEnvFile?.(".env");

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Cách dùng: npx tsx scripts/make-admin.ts email@cua-ban.com");
  process.exit(1);
}
const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Thiếu TURSO_DATABASE_URL / DATABASE_URL");
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const before = await db.execute({ sql: `SELECT id, name, email, role FROM "User" WHERE lower(email) = ?`, args: [email] });
if (!before.rows.length) {
  console.error(`Không tìm thấy tài khoản ${email}`);
  process.exit(1);
}
console.log("Trước:", before.rows[0]);
await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE lower(email) = ?`, args: [email] });
const after = await db.execute({ sql: `SELECT id, name, email, role FROM "User" WHERE lower(email) = ?`, args: [email] });
console.log("Sau:  ", after.rows[0]);
console.log("Xong — trong ≤ 10 phút tài khoản này sẽ thành tài khoản chính thức (ghim + tick xanh).");
