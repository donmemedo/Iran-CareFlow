"use client";

import { formatPercent } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export type WeekdayDatum = { index: number; label: string; delta: number };

/**
 * Polarity around an average: a warm/cool diverging pair with a neutral
 * zero line, never a rainbow.
 */
export function WeekdayBars({ data, locale }: { data: WeekdayDatum[]; locale: Locale }) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.delta)), 1);

  return (
    <ul className="flex flex-col gap-2.5" dir="auto">
      {data.map((item) => {
        const ratio = Math.abs(item.delta) / maxAbs;
        const above = item.delta >= 0;
        return (
          <li key={item.index} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
            <span className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">{item.label}</span>
            <div className="relative h-6" dir="ltr">
              <div className="absolute inset-y-0 start-1/2 w-px bg-[var(--axis)]" />
              <div
                className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[4px] transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(ratio * 46, 1.5)}%`,
                  [above ? "left" : "right"]: "50%",
                  background: above ? "var(--color-series-2)" : "var(--color-series-1)",
                }}
              />
            </div>
            <span
              className="tabular text-end text-[11px] font-bold"
              style={{ color: above ? "var(--color-series-2)" : "var(--color-series-1)" }}
            >
              {above ? "+" : "−"}
              {formatPercent(Math.abs(item.delta), locale, 1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
