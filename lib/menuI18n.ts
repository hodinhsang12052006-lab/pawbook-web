// Tên / mô tả mẫu trong menu theo ngôn ngữ người xem. CHỈ chạy trên máy chủ.
//
// Nguồn bản tiếng Anh (và tiếng Việt khi thợ viết tiếng Anh), theo thứ tự ưu tiên:
//   1. thợ tự nhập / xác nhận ở trình sửa menu (origin "owner");
//   2. mẫu chép từ kho PawNail (sourceDesignId) mà vẫn giữ nguyên tên mẫu → titleEn / descriptionEn của mẫu.
//      Tra lúc đọc nên mọi dòng "from-design" cũ đều đúng ngay, không cần chạy bù dữ liệu;
//   3. dịch máy lúc lưu (origin "mt"), người xem thấy kèm "Show original".
// Lưu ở lib/contentTranslations (AppSetting) — không thêm cột vào MenuItem (deploy không cần migration).
import prisma from "@/lib/prisma";
import type { Locale } from "@/lib/i18n/config";
import { detectTextLang } from "@/lib/i18n/detectLang";
import { getTranslations, saveTranslation, translateEntries, type TxOrigin } from "@/lib/contentTranslations";

export interface MenuI18n {
  nameEn: string | null;
  descriptionEn: string | null;
  nameVi: string | null;
  descriptionVi: string | null;
  /** bản tiếng Anh đến từ đâu — "mt" thì giao diện hiện "Show original" */
  enOrigin: TxOrigin | null;
  viOrigin: TxOrigin | null;
}

type Row = { id: string; name: string; description: string | null; sourceDesignId?: string | null };

const EMPTY: MenuI18n = { nameEn: null, descriptionEn: null, nameVi: null, descriptionVi: null, enOrigin: null, viOrigin: null };

/** Bản dịch cho nhiều mẫu một lần (≤ 3 truy vấn). Không gọi dịch máy. */
export async function menuI18nFor(rows: Row[]): Promise<Map<string, MenuI18n>> {
  const out = new Map<string, MenuI18n>();
  if (!rows.length) return out;
  const nameSrc = rows.map((r) => ({ id: r.id, src: r.name }));
  const descSrc = rows.map((r) => ({ id: r.id, src: r.description }));
  const designIds = [...new Set(rows.map((r) => r.sourceDesignId).filter((x): x is string => !!x))];
  const [nEn, dEn, nVi, dVi, designs] = await Promise.all([
    getTranslations("menu.name", nameSrc, "en"),
    getTranslations("menu.desc", descSrc, "en"),
    getTranslations("menu.name", nameSrc, "vi"),
    getTranslations("menu.desc", descSrc, "vi"),
    designIds.length
      ? prisma.nailDesign.findMany({ where: { id: { in: designIds } }, select: { id: true, title: true, titleEn: true, description: true, descriptionEn: true } }).catch(() => [])
      : Promise.resolve([] as { id: string; title: string; titleEn: string; description: string; descriptionEn: string }[]),
  ]);
  const byDesign = new Map(designs.map((d) => [d.id, d]));
  for (const r of rows) {
    const d = r.sourceDesignId ? byDesign.get(r.sourceDesignId) : undefined;
    const v: MenuI18n = { ...EMPTY };
    // Thợ tự nhập > mẫu PawNail > dịch máy.
    const pick = (stored: { text: string; origin: TxOrigin } | undefined, fromDesign: string | null | undefined) =>
      stored?.origin === "owner" ? stored : fromDesign ? { text: fromDesign, origin: "design" as TxOrigin } : stored;
    // Mẫu PawNail chỉ áp dụng khi thợ còn giữ nguyên tên / mô tả của mẫu (đã đổi tên → bản dịch mẫu không còn đúng).
    const en = pick(nEn.get(r.id), d && r.name.trim() === d.title.trim() ? d.titleEn : null);
    const enD = pick(dEn.get(r.id), d && r.description && r.description.trim() === d.description.trim() ? d.descriptionEn : null);
    const vi = pick(nVi.get(r.id), d && r.name.trim() === d.titleEn.trim() ? d.title : null);
    const viD = pick(dVi.get(r.id), d && r.description && r.description.trim() === d.descriptionEn.trim() ? d.description : null);
    if (en) { v.nameEn = en.text; v.enOrigin = en.origin; }
    if (enD) { v.descriptionEn = enD.text; v.enOrigin = v.enOrigin ?? enD.origin; }
    if (vi) { v.nameVi = vi.text; v.viOrigin = vi.origin; }
    if (viD) { v.descriptionVi = viD.text; v.viOrigin = v.viOrigin ?? viD.origin; }
    out.set(r.id, v);
  }
  return out;
}

export async function menuI18nOne(row: Row): Promise<MenuI18n> {
  return (await menuI18nFor([row])).get(row.id) ?? { ...EMPTY };
}

/**
 * Sau khi thợ lưu 1 mẫu: lưu tên tiếng Anh thợ tự nhập (nếu có), rồi dịch máy phần còn thiếu sang ngôn ngữ
 * còn lại. Gọi trong after() — không làm chậm nút Lưu.
 */
export async function translateMenuItemOnSave(row: Row, ownerProvided?: { nameEn?: string | null; descriptionEn?: string | null }) {
  const lang = detectTextLang(`${row.name} ${row.description ?? ""}`);
  if (ownerProvided?.nameEn?.trim() && lang !== "en") await saveTranslation("menu.name", row.id, "en", row.name, ownerProvided.nameEn.trim().slice(0, 80), "owner");
  if (ownerProvided?.descriptionEn?.trim() && row.description && lang !== "en")
    await saveTranslation("menu.desc", row.id, "en", row.description, ownerProvided.descriptionEn.trim().slice(0, 500), "owner");
  const have = await menuI18nOne(row);
  const targets: Locale[] = ["en", "vi"];
  for (const to of targets) {
    const hasName = to === "en" ? have.nameEn : have.nameVi;
    const hasDesc = to === "en" ? have.descriptionEn : have.descriptionVi;
    if (!hasName) await translateEntries("menu.name", [{ id: row.id, src: row.name }], to, { maxNew: 1 });
    if (row.description && !hasDesc) await translateEntries("menu.desc", [{ id: row.id, src: row.description }], to, { maxNew: 1 });
  }
}
