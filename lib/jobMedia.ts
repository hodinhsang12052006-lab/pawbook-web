import prisma from "@/lib/prisma";

// Ảnh / video tiệm của tin tuyển (bảng JobMedia). Bảng chưa có → đọc trả
// rỗng, ghi bỏ qua: đăng tin vẫn thành công, chỉ là chưa kèm ảnh.
export const MAX_JOB_MEDIA = 8;

function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

/** Chỉ nhận URL do chính kho ảnh/video của app cấp (chống nhúng link lạ). */
export function cleanJobMedia(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return input
    // URL Cloudinary ngắn; ảnh data URL chỉ có ở máy local (không Cloudinary) nên cho dài hơn.
    .filter((u): u is string => typeof u === "string" && u.length <= (cloud ? 600 : 400_000))
    .filter((u) =>
      cloud
        ? u.startsWith(`https://res.cloudinary.com/${cloud}/`)
        : // Chưa cấu hình Cloudinary (máy local): /api/upload trả ảnh data URL.
          /^data:image\/(png|jpe?g|webp|gif);base64,/.test(u) || /^https:\/\/res\.cloudinary\.com\//.test(u)
    )
    .slice(0, MAX_JOB_MEDIA);
}

export async function getJobMedia(jobIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!jobIds.length) return out;
  try {
    const rows = await prisma.jobMedia.findMany({ where: { jobId: { in: jobIds } } });
    for (const r of rows) {
      try {
        const urls = JSON.parse(r.mediaUrls);
        if (Array.isArray(urls)) out.set(r.jobId, urls);
      } catch {}
    }
  } catch (err) {
    if (!isMissingTable(err)) console.error("getJobMedia error:", err);
  }
  return out;
}

export async function setJobMedia(jobId: string, urls: string[]): Promise<boolean> {
  if (!urls.length) return true;
  try {
    await prisma.jobMedia.upsert({ where: { jobId }, update: { mediaUrls: JSON.stringify(urls) }, create: { jobId, mediaUrls: JSON.stringify(urls) } });
    return true;
  } catch (err) {
    if (!isMissingTable(err)) console.error("setJobMedia error:", err);
    return false;
  }
}
