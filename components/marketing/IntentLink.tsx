"use client";

// Link that prefetches on INTENT (pointer over / touch start / keyboard focus) instead of on viewport entry.
// The landing's first screen links to heavy routes (/tryon carries the try-on engine, /auth/register the three
// forms): viewport prefetch made every phone visitor download ~450 KB of JS they may never use. Hover on desktop
// and touchstart on phones still start the fetch ~100-300 ms before the click lands.
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = Omit<React.ComponentProps<typeof Link>, "prefetch" | "href"> & { href: string };

export default function IntentLink({ href, onPointerEnter, onTouchStart, onFocus, ...rest }: Props) {
  const router = useRouter();
  const warm = () => { try { router.prefetch(href); } catch {} };
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={(e) => { warm(); onPointerEnter?.(e); }}
      onTouchStart={(e) => { warm(); onTouchStart?.(e); }}
      onFocus={(e) => { warm(); onFocus?.(e); }}
      {...rest}
    />
  );
}
