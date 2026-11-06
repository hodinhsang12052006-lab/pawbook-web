// Bản dịch nội dung NGƯỜI DÙNG viết, theo từng đoạn + ngôn ngữ đích. CHỈ chạy trên máy chủ.
//
// Lưu ở bảng AppSetting có sẵn (khoá "tx:<loại>:<id>:<en|vi>") thay vì thêm cột (MenuItem.nameEn,
// Job.descriptionEn…): thêm cột cần chạy SQL lên Turso TRƯỚC khi deploy, quên là mọi truy vấn của bảng đó
// đều lỗi. AppSetting đã có trên production → deploy an toàn, không cần migration (cùng cách với
// lib/postEn.ts, lib/userLocale.ts).
//
// Mỗi bản dịch ghi kèm mã băm của bản gốc: người viết sửa bản gốc → bản dịch cũ tự hết hiệu lực.
// origin: "mt" = dịch máy · "owner" = chính người viết nhập / xác nhận · "design" = lấy từ mẫu PawNail.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import type { Locale } from "@/lib/i18n/config";
import { detectTextLang } from "@/lib/i18n/detectLang";
import { machineTranslate } from "@/lib/machineTranslate";

export type TxKind = "msg" | "menu.name" | "menu.desc" | "bio" | "job.title" | "job.desc" | "supply.title";
export type TxOrigin = "mt" | "owner" | "design";
export interface Tx {
  text: string;
  origin: TxOrigin;
}

const key = (kind: TxKind, id: string, lang: Locale) => `tx:${kind}:${id}:${lang}`;
export const srcHash = (s: string) => crypto.createHash("sha1").update(String(s ?? "").trim()).digest("base64url").slice(0, 12);

/** Bản dịch đã lưu (chỉ những bản còn khớp bản gốc). Không gọi dịch máy. */
export async function getTranslations(kind: TxKind, entries: { id: string; src: string | null | undefined }[], lang: Locale): Promise<Map<string, Tx>> {
  const out = new Map<string, Tx>();
  const list = entries.filter((e) => e.id && e.src && e.src.trim());
  if (!list.length) return out;
  try {
    for (let i = 0; i < list.length; i += 400) {
      const chunk = list.slice(i, i + 400);
      const rows = await prisma.appSetting.findMany({ where: { key: { in: chunk.map((e) => key(kind, e.id, lang)) } }, select: { key: true, value: true } });
      const byKey = new Map(rows.map((r) => [r.key, r.value]));
      for (const e of chunk) {
        const raw = byKey.get(key(kind, e.id, lang));
        if (!raw) continue;
        try {
          const v = JSON.parse(raw) as { h?: string; t?: string; o?: TxOrigin };
          if (v?.t && v.h === srcHash(e.src!)) out.set(e.id, { text: v.t, origin: v.o ?? "mt" });
        } catch {}
      }
    }
  } catch {
    // bảng chưa có (DB cũ) → không có bản dịch
  }
  return out;
}

export async function saveTranslation(kind: TxKind, id: string, lang: Locale, src: string, text: string, origin: TxOrigin): Promise<void> {
  const t = String(text ?? "").trim();
  if (!id || !src?.trim() || !t) return;
  const k = key(kind, id, lang);
  const value = JSON.stringify({ h: srcHash(src), t: t.slice(0, 4000), o: origin });
  try {
    await prisma.appSetting.upsert({ where: { key: k }, update: { value }, create: { key: k, value } });
  } catch (err) {
    console.error("saveTranslation error:", err);
  }
}

export async function deleteTranslations(kind: TxKind, id: string): Promise<void> {
  try {
    await prisma.appSetting.deleteMany({ where: { key: { in: [key(kind, id, "en"), key(kind, id, "vi")] } } });
  } catch {}
}

/**
 * Bản dịch sang `lang` cho các đoạn cần dịch (ngôn ngữ đoán được ≠ `lang`): lấy bản đã lưu, thiếu thì dịch
 * máy (tối đa `maxNew` đoạn mỗi lần gọi) rồi lưu lại. Bản dịch do chủ nội dung nhập (origin "owner") không
 * bao giờ bị dịch máy đè lên.
 */
export async function translateEntries(
  kind: TxKind,
  entries: { id: string; src: string | null | undefined }[],
  lang: Locale,
  opts: { maxNew?: number } = {},
): Promise<Map<string, Tx>> {
  const need = entries.filter((e) => e.id && e.src && detectTextLang(e.src) && detectTextLang(e.src) !== lang);
  const have = await getTranslations(kind, need, lang);
  const missing = need.filter((e) => !have.has(e.id)).slice(0, opts.maxNew ?? 20);
  if (missing.length) {
    const out = await machineTranslate(missing.map((e) => e.src!.trim()), lang);
    await Promise.all(
      missing.map(async (e, i) => {
        const t = out[i];
        if (!t || t.trim() === e.src!.trim()) return;
        have.set(e.id, { text: t, origin: "mt" });
        await saveTranslation(kind, e.id, lang, e.src!, t, "mt");
      }),
    );
  }
  return have;
}
