import prisma from "@/lib/prisma";

// Tài khoản CHÍNH THỨC của PawNail (tick xanh, ghim đầu tin nhắn của mọi
// người làm kênh hỗ trợ). Mặc định là tài khoản ADMIN tạo sớm nhất; có thể
// chỉ định cố định bằng biến môi trường OFFICIAL_ACCOUNT_ID.

export interface OfficialAccount {
  id: string;
  name: string;
  avatarUrl: string | null;
}

let cache: { at: number; value: OfficialAccount | null } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function getOfficialAccount(): Promise<OfficialAccount | null> {
  // Chưa có admin → chỉ nhớ 30 giây, để tài khoản admin vừa tạo hiện ra ngay.
  if (cache && Date.now() - cache.at < (cache.value ? CACHE_MS : 30_000)) return cache.value;
  let value: OfficialAccount | null = null;
  try {
    const pinned = process.env.OFFICIAL_ACCOUNT_ID;
    const u = pinned
      ? await prisma.user.findFirst({ where: { id: pinned, role: "ADMIN" }, select: { id: true, name: true, avatarUrl: true } })
      : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, avatarUrl: true } });
    value = u ?? null;
  } catch (err) {
    console.error("getOfficialAccount error:", err);
  }
  cache = { at: Date.now(), value };
  return value;
}
