"use client";

import { useState } from "react";
import clsx from "clsx";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export type LoadRow = {
  id: number | string;
  label: string;
  value: number;
  detail?: string;
  capacity?: number;
  used?: number;
};

/**
 * Magnitude against a shared ceiling: one hue, direct-labelled, with the
 * status ramp reserved for genuinely unsafe occupancy.
 */
export function LoadBars({ rows, locale, max = 100 }: { rows: LoadRow[]; locale: Locale; max?: number }) {
  const [hover, setHover] = useState<string | number | null>(null);

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => {
        const ratio = Math.min(row.value / max, 1);
        const tone =
          row.value >= 95 ? "var(--color-status-critical)" : row.value >= 88 ? "var(--color-status-serious)" : "var(--color-series-1)";
        const isHot = row.value >= 88;
        return (
          <li
            key={row.id}
            onPointerEnter={() => setHover(row.id)}
            onPointerLeave={() => setHover(null)}
            className="group"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-semibold sm:text-sm">{row.label}</span>
              <span className="tabular shrink-0 text-xs font-bold sm:text-sm" style={{ color: isHot ? tone : undefined }}>
                {formatPercent(row.value, locale)}
              </span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="absolute inset-y-0 start-0 rounded-full transition-[width,filter] duration-700 ease-out"
                style={{
                  width: `${ratio * 100}%`,
                  background: tone,
                  filter: hover === row.id ? "brightness(1.12)" : undefined,
                }}
              />
            </div>
            {row.detail ? (
              <p
                className={clsx(
                  "mt-1 text-[11px] transition-colors",
                  hover === row.id ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]",
                )}
              >
                {row.detail}
                {row.capacity !== undefined && row.used !== undefined
                  ? ` · ${formatNumber(row.used, locale)}/${formatNumber(row.capacity, locale)}`
                  : ""}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
