// Hàm dịch toàn cục: tr("Việc làm", "Jobs"). Ngôn ngữ hiện tại do
// LanguageProvider đặt mỗi lần render (trước khi các component con render),
// nên gọi được ở bất cứ đâu trong lúc render. Component dùng tr() phải gọi
// useTr() để render lại khi người dùng bấm VI/EN (công cụ
// scripts/i18n/apply.mjs tự chèn).
let current: "vi" | "en" = "vi";

export function setTrLocale(locale: "vi" | "en") {
  current = locale;
}

export function tr(vi: string, en: string): string {
  return current === "en" ? en : vi;
}

export const currentLocale = () => current;
