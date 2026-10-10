// Dữ liệu có cấu trúc schema.org/JobPosting cho trang tin tuyển — để tin hiện trong
// "Google tìm việc" (Google for Jobs), nguồn khách miễn phí lớn nhất cho tin tuyển.
// Chỉ ghi những gì CÓ THẬT trong tin (không bịa giờ làm, loại hợp đồng…).
import { SITE_URL } from "@/lib/siteUrl";
import { stateName } from "@/lib/stateNames";

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
}

const VALID_DAYS = 60; // tin quá 60 ngày coi như hết hạn

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

export function jobPostingLd(j: JobForLd) {
  const country = j.market === "AU" ? "AU" : "US";
  const skills = (j.skills ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const benefits = (j.benefits ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const salary = parseSalary(j.salaryAmount, j.salaryType);
  const description = [
    j.description,
    skills.length ? `Kỹ năng cần: ${skills.join(", ")}.` : "",
    benefits.length ? `Quyền lợi: ${benefits.join(", ")}.` : "",
    j.salaryAmount ? `Lương: ${j.salaryAmount}${j.salaryType ? ` (${j.salaryType})` : ""}.` : "",
  ].filter(Boolean).join("\n");
  const valid = new Date(j.createdAt.getTime() + VALID_DAYS * 86_400_000);
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: j.title,
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
    url: `${SITE_URL}/jobs/${j.id}`,
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
