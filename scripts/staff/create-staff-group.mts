// TẠO 10 TÀI KHOẢN NHÂN VIÊN "Bitpaw 1" … "Bitpaw 10" + 1 NHÓM CHAT CHỈ GỒM NHÂN VIÊN (ảnh nhóm = logo B của chủ).
//   npx tsx scripts/staff/create-staff-group.mts --yes                (DB trong .env — production — CHỦ tự chạy)
//   npx tsx scripts/staff/create-staff-group.mts --yes --count 10 --out "<file>.txt" --group "Nhóm nhân viên BitPaw"
//
// - Email nội bộ bitpaw<N>@staff.pawnailjobs.demo: đuôi pawnailjobs.demo = tài khoản nội bộ (lib/demo.ts) → đăng nhập,
//   nhắn tin bình thường nhưng KHÔNG hiện ở danh sách công khai (thợ / tiệm / bảng tin / số liệu) và không nhận email.
// - Mật khẩu ngẫu nhiên tạo NGAY TRÊN MÁY CHỦ CHẠY SCRIPT, chỉ ghi vào file --out (mặc định Desktop) — không in ra màn hình.
//   Chạy lại: tài khoản đã có thì GIỮ mật khẩu cũ (không đổi), trừ khi thêm --reset-passwords.
// - Nhóm chat: chỉ gồm các tài khoản nhân viên; nhóm PawNail không có nút "thêm người" → người ngoài không vào được.
//   Ảnh nhóm: AppSetting group_avatars (lib/conversationReads) = /logo_b.jpg (logo B neon — logo chính thức của chủ).
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

// .env ở thư mục đang đứng, hoặc thư mục cha (chạy từ worktree .claude/worktrees/… → .env của bản chính).
// Không ghi đè biến đã có sẵn trong môi trường.
for (let dir = process.cwd(), i = 0; i < 5; i++, dir = path.dirname(dir)) {
  const f = path.join(dir, ".env");
  if (fs.existsSync(f)) { process.loadEnvFile?.(f); break; }
}
const args = process.argv.slice(2);
const flag = (k: string) => args.includes(k);
const opt = (k: string, d: string) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
if (!flag("--yes")) {
  console.log("Thêm --yes để chạy thật (tạo 10 tài khoản nhân viên + nhóm chat trên DB trong .env / TURSO_DATABASE_URL).");
  process.exit(1);
}
const COUNT = Math.min(50, Math.max(1, Number(opt("--count", "10")) || 10));
const GROUP = opt("--group", "Họp Nội Bộ BitPaw").slice(0, 60);
// --add <email> (lặp lại được): nâng tài khoản thành NHÂN VIÊN + vào nhóm (chưa có tài khoản → tạo, mật khẩu ghi vào file).
// --remove <email>: bỏ quyền nhân viên + rời nhóm. Nhóm luôn = đúng danh sách nhân viên (không ai khác).
const listOpt = (k: string) => args.flatMap((a, i) => (a === k && args[i + 1] ? [args[i + 1].trim().toLowerCase()] : [])).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
const ADD = listOpt("--add");
const REMOVE = new Set(listOpt("--remove"));
const OUT = opt("--out", path.join(os.homedir(), "Desktop", "BitPaw-tai-khoan-nhan-vien.txt"));
const LOGO = "/logo_b.jpg";
const DOMAIN = "staff.pawnailjobs.demo";

const { default: prisma } = await import("../../lib/prisma");
const { GROUP_AVATARS_KEY } = await import("../../lib/conversationReads");
const { setSetting, getSetting } = await import("../../lib/settings");

const dbHost = String(process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "").replace(/^(libsql|https?):\/\//, "").split(/[/?]/)[0] || "(local)";
console.log(`DB: ${dbHost}`);

// Mật khẩu dễ gõ trên điện thoại: chữ + số, bỏ ký tự dễ nhầm (0/O, 1/l/I).
const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = () => {
  const b = crypto.randomBytes(12);
  let s = "";
  for (const x of b) s += ALPHA[x % ALPHA.length];
  return `Bp${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
};

const rows: { name: string; email: string; password: string | null; status: string }[] = [];
const ids: string[] = [];
for (let n = 1; n <= COUNT; n++) {
  const email = `bitpaw${n}@${DOMAIN}`;
  const name = `Bitpaw ${n}`;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && !flag("--reset-passwords")) {
    ids.push(existing.id);
    rows.push({ name, email, password: null, status: "đã có — giữ mật khẩu cũ" });
    continue;
  }
  const pw = password();
  const hash = await bcrypt.hash(pw, 10);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { password: hash } });
    ids.push(existing.id);
    rows.push({ name, email, password: pw, status: "đặt lại mật khẩu" });
  } else {
    const u = await prisma.user.create({
      data: { name, email, password: hash, role: "OWNER", market: "US", state: "CA", city: "BitPaw", avatarUrl: LOGO },
      select: { id: true },
    });
    ids.push(u.id);
    rows.push({ name, email, password: pw, status: "tạo mới" });
  }
}

// Tài khoản được nâng thành nhân viên (email thật: admin, nhân viên mới…)
for (const email of ADD) {
  if (REMOVE.has(email)) continue;
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (u) {
    ids.push(u.id);
    rows.push({ name: u.name || email, email, password: null, status: "nâng thành nhân viên (giữ mật khẩu của họ)" });
  } else {
    const pw = password();
    const name = email.split("@")[0].slice(0, 40);
    const c = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(pw, 10), role: "OWNER", market: "US", state: "CA", city: "BitPaw" }, select: { id: true } });
    ids.push(c.id);
    rows.push({ name, email, password: pw, status: "tạo mới (đổi mật khẩu bằng Quên mật khẩu)" });
  }
}
// Danh sách nhân viên (AppSetting staff_user_ids) = cũ + mới − bỏ. Nhóm luôn đúng bằng danh sách này.
let staff: string[] = [];
try { staff = JSON.parse((await getSetting("staff_user_ids").catch(() => null)) || "[]"); } catch {}
const removedIds = REMOVE.size ? (await prisma.user.findMany({ where: { email: { in: [...REMOVE] } }, select: { id: true } })).map((u) => u.id) : [];
const staffIds = [...new Set([...staff, ...ids])].filter((id) => !removedIds.includes(id));
const exist = new Set((await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true } })).map((u) => u.id));
const members = staffIds.filter((id) => exist.has(id));
await setSetting("staff_user_ids", JSON.stringify(members));

// Nhóm: tạo 1 lần (id ở AppSetting staff_group_id); chạy lại → đổi tên theo --group, thêm / bớt cho khớp danh sách nhân viên.
let groupId = (await getSetting("staff_group_id").catch(() => null)) || "";
const group = groupId ? await prisma.conversation.findUnique({ where: { id: groupId }, select: { id: true, participants: { select: { id: true } } } }) : null;
if (group) {
  const have = new Set(group.participants.map((p) => p.id));
  const add = members.filter((id) => !have.has(id));
  const drop = [...have].filter((id) => !members.includes(id));
  await prisma.conversation.update({
    where: { id: group.id },
    data: { name: GROUP, isGroup: true, participants: { connect: add.map((id) => ({ id })), disconnect: drop.map((id) => ({ id })) } },
  });
  if (drop.length) console.log(`Đã cho ${drop.length} tài khoản không còn là nhân viên rời nhóm.`);
} else {
  const c = await prisma.conversation.create({ data: { isGroup: true, name: GROUP, participants: { connect: members.map((id) => ({ id })) } }, select: { id: true } });
  groupId = c.id;
  await setSetting("staff_group_id", groupId);
  // Tin đầu tiên để nhóm hiện ngay trong danh sách tin nhắn của mọi người
  await prisma.message.create({ data: { conversationId: groupId, senderId: ids[0], body: `Chào mừng mọi người vào ${GROUP} 👋` } });
}
let avatars: Record<string, string> = {};
try { avatars = JSON.parse((await getSetting(GROUP_AVATARS_KEY)) || "{}"); } catch {}
avatars[groupId] = LOGO;
await setSetting(GROUP_AVATARS_KEY, JSON.stringify(avatars));

const site = process.env.STAFF_SITE_URL || "https://www.bitpawos.com";
const lines = [
  `TÀI KHOẢN NHÂN VIÊN BITPAW — tạo ${new Date().toLocaleString("vi-VN")}`,
  `Đăng nhập: ${site.replace(/\/$/, "")}/vi/auth/login  (ô Email + Mật khẩu)`,
  `Nhóm chat: "${GROUP}" — vào mục Tin nhắn là thấy`,
  "",
  ...rows.map((r) => `${r.name.padEnd(10)} | ${r.email.padEnd(34)} | ${r.password ?? "(giữ mật khẩu cũ)"}  [${r.status}]`),
  "",
  "Giữ file này kín. Đổi mật khẩu: chạy lại script với --reset-passwords.",
];
fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(`Xong: ${rows.filter((r) => r.status.startsWith("tạo mới")).length} tài khoản mới, nhóm "${GROUP}" (${members.length} người, ảnh nhóm logo B).`);
console.log(`Danh sách tài khoản + mật khẩu: ${OUT}`);
await prisma.$disconnect();
