"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export function Counter({
  value,
  locale,
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number;
  locale: Locale;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out-expo keeps the last digits from crawling
      const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {formatNumber(Math.round(display), locale)}
      {suffix}
    </span>
  );
}
