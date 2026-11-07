import { BRAND_LOGO } from "@/lib/brand";

/**
 * The PawNail "B" logo at a fixed CSS size. Plain <img> with a width-based srcset (no optimizer round trip, no CLS:
 * width/height are always set). Decorative by default (alt="") because every placement sits next to the
 * "PawNail" wordmark or inside a link that carries the name. Never fetchpriority=high: the hero photo owns LCP.
 * fetchPriority="low" also keeps React's server renderer from emitting an automatic <link rel="preload" as="image">
 * for every eager logo: /auth/* rendered two (32 px header + 36 px panel, same 64w file) that Chrome reported as
 * "preloaded but not used", and on app pages the preload competed with the real LCP image. The logo is a few KB and
 * still loads eagerly (not lazy) — it is simply never promoted above the page's content.
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
      fetchPriority="low"
      className={`block h-full w-full object-cover ${className}`}
    />
  );
}
