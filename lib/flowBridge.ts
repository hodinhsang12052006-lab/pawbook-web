import prisma from "@/lib/prisma";
import { FLOW_BATCH, FLOW_MANIFEST, resolveCode } from "@/lib/flowBriefs";
import {
  backupableUrl, checkFlowUpload, DESIGN_ID_RE, FLOW_WHERE, flowMark, flowPublicId, importPrompt, undoPrompt, wasImage,
  type FlowMark, type FlowUpload,
} from "@/lib/flowMarks";

// Nhập ảnh Google Flow vào mẫu nail (admin duyệt từng ảnh trong components/designs/FlowImport):
// trình duyệt tải ảnh THẲNG lên Cloudinary bằng chữ ký /api/admin/designs/flow/sign (không đi qua thân request
// Vercel), rồi gọi /import với kết quả Cloudinary → kiểm tra → 1 lệnh update: imageUrl + dấu trong prompt
// (lib/flowMarks). Hoàn tác (/undo) trả lại ảnh cũ trong [was:…]. Mọi máy tự vẽ ảnh bỏ qua mẫu có [flow:].

export const flowStorage = () => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  return cloudName && apiKey && secret ? { cloudName, apiKey, secret } : null;
};
const today = () => new Date().toISOString().slice(0, 10);

export type FlowResult =
  | { ok: true; designId: string; code: string; imageUrl: string | null; flow: FlowMark | null; unchanged?: boolean }
  | { ok: false; status: number; error: string };
const fail = (status: number, error: string): FlowResult => ({ ok: false, status, error });

/** Gắn ảnh Flow đã tải lên Cloudinary vào mẫu theo mã. Nhập lại đúng ảnh đó → không đổi gì (unchanged). */
export async function importFlowImage(
  input: { code?: unknown } & Partial<FlowUpload>,
  opts: { cloudName: string; date?: string; nowS?: number },
): Promise<FlowResult> {
  const r = resolveCode(input.code);
  if (!r) return fail(400, "Mã ảnh không hợp lệ / unknown image code");
  const row = await prisma.nailDesign.findUnique({ where: { id: r.designId }, select: { id: true, imageUrl: true, prompt: true } });
  if (!row) return fail(404, "Không tìm thấy mẫu / design not found");
  const bad = checkFlowUpload(input, { cloudName: opts.cloudName, publicId: flowPublicId(r.code, r.designId), nowS: opts.nowS });
  if (bad) return fail(422, bad);
  const url = input.secure_url!;
  const cur = flowMark(row.prompt);
  if (row.imageUrl === url && cur?.code === r.code) return { ok: true, designId: row.id, code: r.code, imageUrl: url, flow: cur, unchanged: true };
  if (!cur && !backupableUrl(row.imageUrl)) return fail(422, "Không cất được ảnh cũ để hoàn tác / previous image cannot be backed up");
  const prompt = importPrompt(row.prompt, row.imageUrl, r.code, opts.date ?? today());
  // 1 lệnh update, chỉ khi mẫu chưa bị đổi từ lúc đọc (2 tab cùng nhập) — không thì báo thử lại
  const u = await prisma.nailDesign.updateMany({ where: { id: row.id, imageUrl: row.imageUrl, prompt: row.prompt }, data: { imageUrl: url, prompt } });
  if (!u.count) return fail(409, "Mẫu vừa được đổi ở nơi khác — thử lại / design changed meanwhile, retry");
  return { ok: true, designId: row.id, code: r.code, imageUrl: url, flow: flowMark(prompt) };
}

/** Hoàn tác ảnh Flow: trả ảnh + các dấu ảnh cũ, gỡ dấu Flow. */
export async function undoFlowImage(designId: unknown): Promise<FlowResult> {
  const id = String(designId ?? "");
  if (!DESIGN_ID_RE.test(id)) return fail(400, "Mã mẫu không hợp lệ / invalid design id");
  const row = await prisma.nailDesign.findUnique({ where: { id }, select: { id: true, imageUrl: true, prompt: true } });
  if (!row) return fail(404, "Không tìm thấy mẫu / design not found");
  const back = undoPrompt(row.prompt);
  if (!back) return fail(409, "Mẫu này không có ảnh Flow để hoàn tác / no Flow image to undo");
  const u = await prisma.nailDesign.updateMany({ where: { id, prompt: row.prompt }, data: { imageUrl: back.imageUrl, prompt: back.prompt } });
  if (!u.count) return fail(409, "Mẫu vừa được đổi ở nơi khác — thử lại / design changed meanwhile, retry");
  return { ok: true, designId: id, code: "", imageUrl: back.imageUrl, flow: null };
}

export interface FlowRow {
  code: string; designId: string; title: string; occasion: string | null; status: string | null;
  imageUrl: string | null; flow: FlowMark | null; was: string | null; found: boolean;
}
const SELECT = { id: true, titleEn: true, occasion: true, status: true, imageUrl: true, prompt: true } as const;
type DbRow = { id: string; titleEn: string; occasion: string | null; status: string; imageUrl: string | null; prompt: string };
const toRow = (code: string, designId: string, fallbackTitle: string, d: DbRow | undefined): FlowRow => ({
  code, designId, title: d?.titleEn || fallbackTitle, occasion: d?.occasion ?? null, status: d?.status ?? null,
  imageUrl: d?.imageUrl ?? null, flow: flowMark(d?.prompt), was: wasImage(d?.prompt) ?? null, found: !!d,
});

/** Bảng lô 2026-11 (mã → mẫu, ảnh hiện tại, đã có ảnh Flow chưa). */
export async function listManifest(): Promise<{ batch: string; rows: FlowRow[] }> {
  const rows = (await prisma.nailDesign.findMany({ where: { id: { in: FLOW_MANIFEST.map((b) => b.designId) } }, select: SELECT })) as DbRow[];
  const by = new Map(rows.map((r) => [r.id, r]));
  return { batch: FLOW_BATCH, rows: FLOW_MANIFEST.map((b) => toRow(b.code, b.designId, b.title, by.get(b.designId))) };
}

/** Tra các mã đọc được từ tên file (tối đa 300). Mã không hợp lệ → found=false, designId rỗng. */
export async function lookupCodes(codes: readonly string[]): Promise<FlowRow[]> {
  const list = [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))].slice(0, 300);
  const resolved = list.map((c) => ({ c, r: resolveCode(c) }));
  const ids = [...new Set(resolved.flatMap((x) => (x.r ? [x.r.designId] : [])))];
  const rows = ids.length ? ((await prisma.nailDesign.findMany({ where: { id: { in: ids } }, select: SELECT })) as DbRow[]) : [];
  const by = new Map(rows.map((r) => [r.id, r]));
  return resolved.map(({ c, r }) => (r ? toRow(r.code, r.designId, r.brief?.title ?? "", by.get(r.designId)) : toRow(c, "", "", undefined)));
}

/** Mẫu đã đăng còn CHƯA có ảnh Flow — để "Xuất brief" (mã brief = id mẫu). */
export async function exportCandidates(limit = 600) {
  return prisma.nailDesign.findMany({
    where: { status: "published", NOT: [FLOW_WHERE] },
    orderBy: { publishedAt: "desc" },
    select: { id: true, titleEn: true, shape: true, pattern: true, finish: true, occasion: true },
    take: Math.max(1, Math.min(600, limit)),
  });
}
