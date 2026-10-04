import { tr } from "@/lib/i18n/tr";

// Tick xanh "Tài khoản chính thức" — chỉ dành cho tài khoản quản trị PawNail
// (role ADMIN, xác minh ở máy chủ), giống dấu xác minh của Facebook/Instagram.
export default function VerifiedBadge({ className = "h-4 w-4", title = tr("Tài khoản chính thức của PawNail", "Official PawNail account") }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block flex-shrink-0 align-[-0.15em] ${className}`} role="img" aria-label={title}>
      <title>{title}</title>
      {/* Răng cưa 8 cánh như dấu xác minh quen thuộc */}
      <path
        fill="#1d9bf0"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M7.75 12.25l2.75 2.75 5.75-6" />
    </svg>
  );
}

/** Có hiện tick xanh cho người này không (role lấy từ dữ liệu máy chủ). */
export const isVerifiedRole = (role?: string | null) => role === "ADMIN";
