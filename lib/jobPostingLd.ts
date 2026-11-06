// Dữ liệu có cấu trúc schema.org/JobPosting cho trang tin tuyển — để tin hiện trong
// "Google tìm việc" (Google for Jobs), nguồn khách miễn phí lớn nhất cho tin tuyển.
// Chỉ ghi những gì CÓ THẬT trong tin (không bịa giờ làm, loại hợp đồng…).
import { SITE_URL } from "@/lib/siteUrl";
import { stateName } from "@/lib/stateNames";
import { localePath, type Locale } from "@/lib/i18n/config";
import { dtEn } from "@/lib/i18n/dtEn";
import { vocabLabel } from "@/lib/nailVocab";

export interface JobForLd {
  id: string;
  title: string;
  salonName: string;
  description: string;
  market: "US" | "AU" | string;
  state: string;
  city: string;
  salaryType?: string | null;
  salaryAmount?: string | null;
  skills?: string | null;
  benefits?: string | null;
  createdAt: Date;
  mediaUrls?: string | null;
  /** Hạn hiển thị THẬT của tin (ingest.effectiveExpiry) — validThrough phải khớp lúc tin tự ẩn trên bảng việc. */
  validThrough?: Date | null;
}

const VALID_DAYS = 30; // dự phòng khi không có hạn thật (khớp JOB_TTL_DAYS mặc định)

/** "$1,200-1,500/tuần" → { min: 1200, max: 1500, unit: "WEEK" }; không đọc được → null. */
export function parseSalary(amount?: string | null, type?: string | null): { min: number; max: number; unit: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" } | null {
  if (!amount) return null;
  const text = `${amount} ${type ?? ""}`.toLowerCase();
  if (/%|ăn chia|commission/.test(text) && !/\$\s*\d/.test(amount)) return null; // chỉ ghi % ăn chia → không có số tiền
  const nums = (amount.match(/\d[\d,.]*/g) ?? []).map((n) => Number(n.replace(/,/g, ""))).filter((n) => n > 0 && Number.isFinite(n));
  if (!nums.length) return null;
  let [min, max] = nums.length >= 2 ? [nums[0], nums[1]] : [nums[0], nums[0]];
  if (max < min) [min, max] = [max, min];
  const unit = /giờ|hour|\/h\b|hr/.test(text) ? "HOUR" : /ngày|day/.test(text) ? "DAY" : /tháng|month/.test(text) ? "MONTH" : /năm|year/.test(text) ? "YEAR" : /tuần|week|wk/.test(text) ? "WEEK" : null;
  if (!unit) return null;
  return { min, max, unit };
}

/** `lang` = ngôn ngữ của trang (url khớp canonical); `descriptionEn` = bản dịch mô tả cho trang tiếng Anh. */
export function jobPostingLd(j: JobForLd, lang: Locale = "en", descriptionEn?: string | null) {
  const country = j.market === "AU" ? "AU" : "US";
  const skills = (j.skills ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const benefits = (j.benefits ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const salary = parseSalary(j.salaryAmount, j.salaryType);
  const en = lang === "en";
  const L = (v: string) => vocabLabel(v, lang, j.market);
  const description = [
    en ? descriptionEn || dtEn(j.description) : j.description,
    skills.length ? (en ? `Skills: ${skills.map(L).join(", ")}.` : `Kỹ năng cần: ${skills.map(L).join(", ")}.`) : "",
    benefits.length ? (en ? `Benefits: ${benefits.map(L).join(", ")}.` : `Quyền lợi: ${benefits.map(L).join(", ")}.`) : "",
    j.salaryAmount ? (en ? `Pay: ${dtEn(j.salaryAmount)}${j.salaryType ? ` (${L(j.salaryType)})` : ""}.` : `Lương: ${j.salaryAmount}${j.salaryType ? ` (${L(j.salaryType)})` : ""}.`) : "",
  ].filter(Boolean).join("\n");
  const valid = j.validThrough ?? new Date(j.createdAt.getTime() + VALID_DAYS * 86_400_000);
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: en ? dtEn(j.title) : j.title,
    description,
    identifier: { "@type": "PropertyValue", name: "PawNail Jobs", value: j.id },
    datePosted: j.createdAt.toISOString(),
    validThrough: valid.toISOString(),
    hiringOrganization: { "@type": "Organization", name: j.salonName },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: j.city, addressRegion: stateName(j.market as "US" | "AU", j.state), addressCountry: country },
    },
    ...(salary
      ? { baseSalary: { "@type": "MonetaryAmount", currency: country === "AU" ? "AUD" : "USD", value: { "@type": "QuantitativeValue", minValue: salary.min, maxValue: salary.max, unitText: salary.unit } } }
      : {}),
    ...(skills.length ? { skills: skills.join(", ") } : {}),
    industry: "Nail salon",
    occupationalCategory: "39-5092.00 Manicurists and Pedicurists",
    // trùng với canonical của trang (EN: /jobs/…, VI: /vi/jobs/…)
    url: `${SITE_URL}${localePath(`/jobs/${j.id}`, lang)}`,
    directApply: false,
  };
}

/** Ảnh đầu tiên của tin (https) để làm ảnh xem trước khi chia sẻ link. */
export function firstImage(mediaUrls?: string | null): string | null {
  try {
    const list = JSON.parse(mediaUrls || "[]") as unknown[];
    const img = list.find((u): u is string => typeof u === "string" && /^https:\/\//.test(u) && !/\.(mp4|mov|webm)(\?|$)/i.test(u));
    return img ?? null;
  } catch {
    return null;
  }
}
