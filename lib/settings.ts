// Cài đặt toàn hệ thống (bảng AppSetting) — admin bật/tắt không cần sửa code / deploy lại.
// Đọc có đệm 30s mỗi máy chủ để không truy vấn DB mỗi yêu cầu.
import prisma from "@/lib/prisma";

const cache = new Map<string, { v: string | null; at: number }>();
const TTL = 30_000;

export async function getSetting(key: string): Promise<string | null> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.v;
  let v: string | null = null;
  try {
    v = (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
  } catch {
    v = null; // bảng chưa có (DB cũ) → coi như chưa cài
  }
  cache.set(key, { v, at: Date.now() });
  return v;
}

export async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  cache.set(key, { v: value, at: Date.now() });
}
