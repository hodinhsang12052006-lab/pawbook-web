// Kiểu dữ liệu chung cho TIN VIỆC TỪ ĐỐI TÁC (Adzuna lưu bảng ExternalJob, Careerjet chỉ tìm trực tiếp).
// Không có trường SĐT / email / địa chỉ / dữ liệu ứng viên — cố ý.
export type FeedMarket = "US" | "AU";
export type FeedProvider = "adzuna" | "careerjet";
export type HiddenReason = "not_nail" | "dup_salon_post" | "dup_job" | "dup_provider" | "admin";

export interface ExternalJobInput {
  provider: FeedProvider;
  providerJobId: string;
  market: FeedMarket;
  title: string;
  company: string | null;
  locationLabel: string;
  state: string | null;
  city: string | null;
  // (Không lưu toạ độ: chưa có tính năng nào cần — tối thiểu hoá dữ liệu đối tác.)
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  contractTime: string | null;
  contractType: string | null;
  snippet: string | null;
  redirectUrl: string;
  /** Ngày đăng gốc của đối tác. null = đối tác không ghi / ghi sai → hiện "không ghi ngày", KHÔNG tự đặt là "vừa đăng". */
  providerCreatedAt: Date | null;
  dedupeKey: string;
  notNail: boolean; // không phải việc nail (thợ đóng đinh / lợp mái…) → lưu ẩn để khỏi coi là tin mới lần sau
}

export interface Attribution {
  provider: FeedProvider;
  label: string; // "Jobs by Adzuna" — đúng câu chữ theo giấy phép
  href: string; // trang Adzuna của đúng thị trường
}

/** Một tin hiển thị công khai (API /api/jobs/external, /api/jobs/web-search). */
export interface PublicExternalJob {
  id: string;
  provider: FeedProvider;
  title: string;
  company: string | null;
  locationLabel: string;
  state: string | null;
  city: string | null;
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null } | null;
  contractTime: string | null;
  snippet: string | null;
  url: string;
  postedAt: string | null; // null = đối tác không ghi ngày đăng
  attribution: Attribution;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
