import { BRAND_LOGO } from "@/lib/brand";

/**
 * The PawNail "B" logo at a fixed CSS size. Plain <img> with a width-based srcset (no optimizer round trip, no CLS:
 * width/height are always set). Decorative by default (alt="") because every placement sits next to the
 * "PawNail" wordmark or inside a link that carries the name. Never fetchpriority=high: the hero photo owns LCP.
 */
export default function BrandLogo({ size, className = "", alt = "", loading = "eager" }: { size: number; className?: string; alt?: string; loading?: "eager" | "lazy" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_LOGO.src}
      srcSet={BRAND_LOGO.srcSet}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={alt}
      decoding="async"
      loading={loading}
      className={`block h-full w-full object-cover ${className}`}
    />
  );
}
