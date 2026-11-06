// Mô tả tin tuyển theo ngôn ngữ người xem. CHỈ chạy trên máy chủ.
//   - mẫu câu do app tạo ("{tiệm} tại {thành phố}, {bang} đang tuyển thợ nail.") → bảng dtEn, không dịch máy;
//   - chữ chủ tiệm / tin tổng hợp tự viết → dịch máy lúc đăng (after()), lưu ở lib/contentTranslations.
// Trang chi tiết tin nhận cả 2 bản; thiếu bản của người xem thì dịch ngay (tối đa vài giây) rồi lưu cho lần sau.
import { after } from "next/server";
import type { Locale } from "@/lib/i18n/config";
import { dtEn } from "@/lib/i18n/dtEn";
import { detectTextLang } from "@/lib/i18n/detectLang";
import { getTranslations, translateEntries, type TxOrigin } from "@/lib/contentTranslations";

type JobLite = { id: string; description: string | null };

const needsMt = (j: JobLite) => !!j.description?.trim() && dtEn(j.description) === j.description && !!detectTextLang(j.description);

/** Dịch máy mô tả sang ngôn ngữ còn lại — gọi trong after() khi đăng / nhận tin. */
export async function translateJobOnSave(j: JobLite): Promise<void> {
  if (!needsMt(j)) return;
  const to: Locale = detectTextLang(j.description) === "vi" ? "en" : "vi";
  await translateEntries("job.desc", [{ id: j.id, src: j.description }], to, { maxNew: 1 }).catch(() => {});
}

/**
 * Bản dịch mô tả cho trang chi tiết: { en?, vi? } + nguồn. Người xem `viewer` chưa có bản → dịch ngay, chờ tối
 * đa `waitMs` (dịch xong muộn hơn vẫn được lưu nhờ after()).
 */
export async function jobDescriptionTx(j: JobLite, viewer: Locale, waitMs = 4000): Promise<{ tx: Partial<Record<Locale, string>>; origin: TxOrigin | null }> {
  const tx: Partial<Record<Locale, string>> = {};
  if (!needsMt(j)) return { tx, origin: null };
  const entries = [{ id: j.id, src: j.description }];
  const [en, vi] = await Promise.all([getTranslations("job.desc", entries, "en"), getTranslations("job.desc", entries, "vi")]);
  let origin: TxOrigin | null = en.get(j.id)?.origin ?? vi.get(j.id)?.origin ?? null;
  if (en.get(j.id)) tx.en = en.get(j.id)!.text;
  if (vi.get(j.id)) tx.vi = vi.get(j.id)!.text;
  if (!tx[viewer] && detectTextLang(j.description) !== viewer) {
    const p = translateEntries("job.desc", entries, viewer, { maxNew: 1 }).catch(() => new Map());
    after(() => p.then(() => undefined));
    const got = await Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
    const t = got?.get(j.id);
    if (t) {
      tx[viewer] = t.text;
      origin = origin ?? t.origin;
    }
  }
  return { tx, origin };
}
