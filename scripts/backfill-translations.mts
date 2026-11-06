// Bù bản dịch cho dữ liệu CŨ (trước khi có dịch lúc lưu): tên / mô tả mẫu trong menu, giới thiệu thợ, mô tả tin
// tuyển. Chỉ GHI vào bảng AppSetting (khoá "tx:…" — lib/contentTranslations.ts), không sửa bảng nào khác.
// Không bắt buộc: các trang tự dịch dần khi được xem. Dùng khi muốn có sẵn bản dịch cho toàn bộ dữ liệu.
// Cần khoá dịch máy (CF_ACCOUNT_ID + CF_AI_TOKEN hoặc GEMINI_API_KEY).
//   npx tsx scripts/backfill-translations.mts            → chỉ in số lượng sẽ dịch (chạy thử)
//   npx tsx scripts/backfill-translations.mts --yes      → dịch và lưu
// DB đích theo biến môi trường như app (TURSO_DATABASE_URL) — script in tên máy chủ DB trước khi chạy.
const yes = process.argv.includes("--yes");
const target = process.env.TURSO_DATABASE_URL ? new URL(process.env.TURSO_DATABASE_URL.replace(/^libsql:/, "https:")).host || process.env.TURSO_DATABASE_URL : "file:./dev.db";
console.log(`DB: ${target}${yes ? "" : "  (chạy thử — thêm --yes để ghi)"}`);

const { default: prisma } = await import("../lib/prisma");
const { machineTranslateEnabled } = await import("../lib/machineTranslate");
const { detectTextLang } = await import("../lib/i18n/detectLang");
const { translateEntries } = await import("../lib/contentTranslations");
const { menuI18nFor, translateMissingMenu } = await import("../lib/menuI18n");
const { translateJobOnSave } = await import("../lib/jobI18n");
if (yes && !machineTranslateEnabled()) {
  console.error("❌ Chưa cấu hình dịch máy (CF_ACCOUNT_ID + CF_AI_TOKEN hoặc GEMINI_API_KEY).");
  process.exit(2);
}

const items = await prisma.menuItem.findMany({ where: { active: true }, select: { id: true, name: true, description: true, sourceDesignId: true } });
const i18n = await menuI18nFor(items);
const menuTodo = items.filter((r) => { const l = detectTextLang(`${r.name} ${r.description ?? ""}`); const v = i18n.get(r.id); return l === "vi" ? !v?.nameEn : l === "en" ? !v?.nameVi : false; });
const bios = (await prisma.technicianProfile.findMany({ select: { userId: true, bio: true } })).filter((b) => b.bio && detectTextLang(b.bio));
const jobs = await prisma.job.findMany({ where: { createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, select: { id: true, description: true } });
console.log(`menu: ${menuTodo.length} mẫu · giới thiệu: ${bios.length} · tin tuyển (90 ngày): ${jobs.length}`);
if (!yes) process.exit(0);

await translateMissingMenu(menuTodo, i18n, menuTodo.length);
for (const b of bios) await translateEntries("bio", [{ id: b.userId, src: b.bio }], detectTextLang(b.bio) === "vi" ? "en" : "vi", { maxNew: 1 });
for (const j of jobs) await translateJobOnSave(j);
console.log("xong");
await prisma.$disconnect();
