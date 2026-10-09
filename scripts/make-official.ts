// Biến 1 tài khoản ĐÃ ĐĂNG KÝ thành TÀI KHOẢN CHÍNH THỨC của nền tảng:
//   quyền ADMIN · tên "PawNail Jobs" · avatar = logo nền tảng · tick xanh
//   (tick + trang hồ sơ thương hiệu tự hiện cho ADMIN — components/profile/OfficialProfile).
//   npx tsx scripts/make-official.ts email@cua-ban.com ["Tên hiển thị"]
// Chạy với .env trỏ vào Turso production. Chỉ đổi đúng 1 tài khoản, in trước/sau.
import { createClient } from "@libsql/client";

// Không ghi đè biến đã có sẵn trong môi trường (để chạy thử được trên DB local).
process.loadEnvFile?.(".env");

const email = process.argv[2]?.trim().toLowerCase();
const name = (process.argv[3] || "PawNail Jobs").trim().slice(0, 80);
const AVATAR = "/brand/pawnail-official.jpg";
if (!email || !email.includes("@")) {
  console.error('Cách dùng: npx tsx scripts/make-official.ts email@cua-ban.com ["Tên hiển thị"]');
  process.exit(1);
}
const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Thiếu TURSO_DATABASE_URL / DATABASE_URL");
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
// tsx chạy dạng CommonJS → không có await cấp ngoài cùng; bọc trong main().
async function main() {
  const show = async () => (await db.execute({ sql: `SELECT id, name, email, role, avatarUrl FROM "User" WHERE lower(email) = ?`, args: [email] })).rows[0];

  const before = await show();
  if (!before) {
    console.error(`Chưa có tài khoản ${email} — hãy đăng ký trên bitpawos.com trước rồi chạy lại.`);
    process.exit(1);
  }
  console.log("Trước:", before);
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN', name = ?, avatarUrl = ? WHERE lower(email) = ?`, args: [name, AVATAR, email] });
  console.log("Sau:  ", await show());
  console.log("Xong — trong ≤ 10 phút tài khoản này là tài khoản chính thức (tick xanh, ghim đầu hộp thư mọi người).");
  console.log("Muốn chắc chắn tài khoản NÀY là tài khoản chính thức (khi có nhiều admin): đặt OFFICIAL_ACCOUNT_ID =", before.id, "trên Vercel.");
}

main().catch((e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  process.exit(1);
});
