// Cờ Mỹ / Úc vẽ bằng SVG — emoji cờ 🇺🇸🇦🇺 KHÔNG hiển thị trên Windows (chỉ ra
// chữ "US"/"AU"), nên dùng hình vẽ để mọi máy nhìn giống nhau.
// (Ô chọn <select>/<option> vẫn phải dùng emoji vì không chứa được SVG.)
export default function Flag({ code, className = "h-3.5 w-5" }: { code: "US" | "AU" | string; className?: string }) {
  const cls = `inline-block flex-shrink-0 rounded-[2px] ring-1 ring-black/20 align-[-0.15em] ${className}`;
  if (code === "AU") {
    return (
      <svg viewBox="0 0 30 20" className={cls} role="img" aria-label="Úc">
        <rect width="30" height="20" fill="#012169" />
        {/* Union Jack thu gọn ở góc trái trên */}
        <path d="M0 0L15 10M15 0L0 10" stroke="#fff" strokeWidth="2" />
        <path d="M0 0L15 10M15 0L0 10" stroke="#C8102E" strokeWidth="0.8" />
        <path d="M7.5 0V10M0 5H15" stroke="#fff" strokeWidth="3" />
        <path d="M7.5 0V10M0 5H15" stroke="#C8102E" strokeWidth="1.6" />
        {/* Sao Liên bang + chòm Nam Thập Tự */}
        <circle cx="7.5" cy="15" r="2.1" fill="#fff" />
        <circle cx="22.5" cy="4" r="1" fill="#fff" />
        <circle cx="19" cy="9" r="1" fill="#fff" />
        <circle cx="25.5" cy="8.5" r="1" fill="#fff" />
        <circle cx="22.5" cy="16" r="1.1" fill="#fff" />
        <circle cx="24" cy="11.5" r="0.6" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 30 20" className={cls} role="img" aria-label="Mỹ">
      <rect width="30" height="20" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#fff" />
      ))}
      <rect width="13" height={(20 * 7) / 13} fill="#3C3B6E" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => <circle key={`${r}-${c}`} cx={2 + c * 3} cy={2 + r * 3.4} r="0.65" fill="#fff" />)
      )}
    </svg>
  );
}
