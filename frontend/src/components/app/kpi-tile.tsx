"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion } from "motion/react";
import { Card, ProgressBar } from "@/components/ui";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Kpi } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

export function KpiTile({ kpi, locale, dict, index }: { kpi: Kpi; locale: Locale; dict: Dictionary; index: number }) {
  const improving =
    kpi.delta_pct === 0 ? null : kpi.good_when === "up" ? kpi.delta_pct > 0 : kpi.delta_pct < 0;
  const DeltaIcon = kpi.delta_pct === 0 ? Minus : kpi.delta_pct > 0 ? ArrowUpRight : ArrowDownRight;
  const deltaColor =
    improving === null
      ? "var(--text-muted)"
      : improving
        ? "var(--color-status-good)"
        : "var(--color-status-serious)";

  const unitLabel =
    kpi.unit === "min" ? dict.common.minutes : kpi.unit === "days" ? dict.common.days : kpi.unit === "/day" ? dict.common.perDay : kpi.unit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
    >
      <Card className="h-full p-4 sm:p-5">
        <p className="truncate text-[11px] font-semibold text-[var(--text-muted)]">
          {locale === "fa" ? kpi.label_fa : kpi.label_en}
        </p>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="tabular text-2xl font-extrabold sm:text-[28px]">
            {kpi.unit === "%" ? formatPercent(kpi.value, locale, 1) : formatNumber(kpi.value, locale, { maximumFractionDigits: 1 })}
          </span>
          {kpi.unit && kpi.unit !== "%" ? (
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">{unitLabel}</span>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-1" style={{ color: deltaColor }}>
          <DeltaIcon size={13} />
          <span className="tabular text-[11px] font-bold">{formatPercent(Math.abs(kpi.delta_pct), locale, 1)}</span>
        </div>

        {kpi.target !== null ? (
          <div className="mt-3">
            <ProgressBar
              value={kpi.good_when === "up" ? (kpi.value / kpi.target) * 100 : (kpi.target / Math.max(kpi.value, 1)) * 100}
              tone={improving === false ? "warning" : "brand"}
            />
            <p className="tabular mt-1.5 text-[10px] text-[var(--text-muted)]">
              {dict.common.target}: {kpi.unit === "%" ? formatPercent(kpi.target, locale) : formatNumber(kpi.target, locale)}{" "}
              {kpi.unit !== "%" ? unitLabel : ""}
            </p>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}
