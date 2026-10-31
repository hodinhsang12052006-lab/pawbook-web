// Bản tiếng Anh của bài đăng CHÍNH THỨC (bài ghim, việc làm tuần này, bộ mẫu hôm nay, chủ đề nóng, tin ngành).
//
// Lưu ở bảng AppSetting có sẵn (khoá "post.en:<postId>") thay vì thêm cột Post.contentEn: thêm cột cần chạy
// SQL lên Turso TRƯỚC khi deploy, quên là mọi truy vấn bảng Post đều lỗi. AppSetting đã có trên production
// nên đổi này deploy an toàn, không cần migration (cùng cách với lib/userLocale.ts).
//
// Bảng tin (GET /api/posts) đọc bản EN cho cả trang trong 1 truy vấn. Người xem tiếng Anh thấy bản EN; bài
// chính thức chỉ có tiếng Việt (bài cũ, bài kiến thức chưa dịch) KHÔNG hiện với họ. Bài của người dùng luôn
// hiện nguyên văn kèm nhãn "Written in Vietnamese" (components/common/LangChip.tsx).
import prisma from "@/lib/prisma";

export interface PostEn {
  content: string;
  /** Thăm dò 1 chạm: câu hỏi + lựa chọn tiếng Anh, cùng thứ tự với bản tiếng Việt (phiếu lưu theo chỉ số). */
  question?: string;
  options?: string[];
}

const PREFIX = "post.en:";
const key = (postId: string) => `${PREFIX}${postId}`;

export async function savePostEn(postId: string, en: PostEn | string | null | undefined): Promise<void> {
  const v: PostEn | null = typeof en === "string" ? { content: en } : en ?? null;
  if (!postId || !v?.content?.trim()) return;
  const value = JSON.stringify({ content: v.content.trim().slice(0, 4000), ...(v.question ? { question: v.question } : {}), ...(v.options?.length ? { options: v.options } : {}) });
  try {
    await prisma.appSetting.upsert({ where: { key: key(postId) }, update: { value }, create: { key: key(postId), value } });
  } catch (err) {
    console.error("savePostEn error:", err);
  }
}

/** Bản EN của nhiều bài một lần (1 truy vấn). Bài không có bản EN → không có trong Map. */
export async function getPostEn(postIds: string[]): Promise<Map<string, PostEn>> {
  const out = new Map<string, PostEn>();
  const ids = [...new Set(postIds.filter(Boolean))];
  if (!ids.length) return out;
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: ids.map(key) } }, select: { key: true, value: true } });
    for (const r of rows) {
      try {
        const v = JSON.parse(r.value) as PostEn;
        if (v && typeof v.content === "string" && v.content.trim()) out.set(r.key.slice(PREFIX.length), v);
      } catch {}
    }
  } catch {
    // bảng chưa có (DB cũ) → không có bản EN
  }
  return out;
}

export async function deletePostEn(postId: string): Promise<void> {
  try {
    await prisma.appSetting.deleteMany({ where: { key: key(postId) } });
  } catch {}
}
