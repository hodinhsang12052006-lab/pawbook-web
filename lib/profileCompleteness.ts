import { isPlaceholderAvatar } from "@/lib/avatar";
import { tr } from "@/lib/i18n/tr";
// Tính % hoàn thiện hồ sơ + danh sách việc còn thiếu — dùng chung cho
// Sidebar, banner mobile trang chủ và trang /profile. Hồ sơ càng đủ thì chủ
// tiệm/thợ càng dễ chọn nhau, nên đây là "việc tiếp theo" rõ ràng nhất để
// kéo người dùng quay lại hoàn thiện.
export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
}

export interface Completeness {
  percent: number;
  items: CompletenessItem[];
  nextItem: CompletenessItem | null;
}

function parseList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (typeof value === "string") return value.split(",").filter(Boolean);
  return [];
}

// Avatar mặc định sinh tự động lúc đăng ký (DiceBear) không tính là "đã có ảnh".
const hasCustomAvatar = (url?: string | null) => !isPlaceholderAvatar(url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProfileCompleteness(user: any): Completeness | null {
  // ADMIN không có hồ sơ tuyển dụng — không hiện checklist thợ/chủ tiệm.
  if (!user?.id || !user?.role || user.role === "ADMIN") return null;

  let items: CompletenessItem[];
  if (user.role === "OWNER") {
    items = [
      { key: "avatar", label: tr("Ảnh đại diện / logo tiệm", "Profile photo / salon logo"), done: hasCustomAvatar(user.avatarUrl) },
      { key: "phone", label: tr("Số điện thoại liên hệ", "Contact phone"), done: !!user.phone },
      { key: "location", label: tr("Thành phố & bang của tiệm", "Salon city & state"), done: !!user.city && !!user.state },
      { key: "policy", label: tr("Chính sách chia turn", "Commission policy"), done: !!user.turnSplitPolicy },
      { key: "clients", label: tr("Loại khách của tiệm", "Salon clientele"), done: !!user.clientTypePolicy },
      { key: "job", label: tr("Đăng tin tuyển thợ đầu tiên", "Post your first job"), done: (user.jobs?.length ?? 0) > 0 },
    ];
  } else {
    const tp = user.technicianProfile || {};
    items = [
      { key: "avatar", label: tr("Ảnh đại diện thật", "Real profile photo"), done: hasCustomAvatar(user.avatarUrl) },
      { key: "phone", label: tr("Số điện thoại", "Phone number"), done: !!user.phone },
      { key: "location", label: tr("Thành phố & bang", "City & state"), done: !!user.city && !!user.state },
      { key: "skills", label: tr("Kỹ năng sở trường", "Top skills"), done: parseList(tp.specialties).length > 0 },
      { key: "bio", label: tr("Giới thiệu ngắn về bản thân", "Short bio"), done: !!tp.bio && String(tp.bio).trim().length >= 20 },
      { key: "experience", label: tr("Số năm kinh nghiệm", "Years of experience"), done: (tp.yearsOfExperience ?? 0) > 0 },
      { key: "portfolio", label: tr("Ít nhất 3 ảnh mẫu móng", "At least 3 work photos"), done: parseList(tp.portfolioImages).length >= 3 },
    ];
  }

  const doneCount = items.filter((i) => i.done).length;
  return {
    percent: Math.round((doneCount / items.length) * 100),
    items,
    nextItem: items.find((i) => !i.done) ?? null,
  };
}
