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
const hasCustomAvatar = (url?: string | null) => !!url && !url.includes("dicebear.com");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProfileCompleteness(user: any): Completeness | null {
  if (!user?.id || !user?.role) return null;

  let items: CompletenessItem[];
  if (user.role === "OWNER") {
    items = [
      { key: "avatar", label: "Ảnh đại diện / logo tiệm", done: hasCustomAvatar(user.avatarUrl) },
      { key: "phone", label: "Số điện thoại liên hệ", done: !!user.phone },
      { key: "location", label: "Thành phố & bang của tiệm", done: !!user.city && !!user.state },
      { key: "policy", label: "Chính sách chia turn", done: !!user.turnSplitPolicy },
      { key: "clients", label: "Loại khách của tiệm", done: !!user.clientTypePolicy },
      { key: "job", label: "Đăng tin tuyển thợ đầu tiên", done: (user.jobs?.length ?? 0) > 0 },
    ];
  } else {
    const tp = user.technicianProfile || {};
    items = [
      { key: "avatar", label: "Ảnh đại diện thật", done: hasCustomAvatar(user.avatarUrl) },
      { key: "phone", label: "Số điện thoại", done: !!user.phone },
      { key: "location", label: "Thành phố & bang", done: !!user.city && !!user.state },
      { key: "skills", label: "Kỹ năng sở trường", done: parseList(tp.specialties).length > 0 },
      { key: "bio", label: "Giới thiệu ngắn về bản thân", done: !!tp.bio && String(tp.bio).trim().length >= 20 },
      { key: "experience", label: "Số năm kinh nghiệm", done: (tp.yearsOfExperience ?? 0) > 0 },
      { key: "portfolio", label: "Ít nhất 3 ảnh mẫu móng", done: parseList(tp.portfolioImages).length >= 3 },
    ];
  }

  const doneCount = items.filter((i) => i.done).length;
  return {
    percent: Math.round((doneCount / items.length) * 100),
    items,
    nextItem: items.find((i) => !i.done) ?? null,
  };
}
