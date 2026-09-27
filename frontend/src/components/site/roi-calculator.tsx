"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, Info, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatMoney, formatNumber, formatPercent, localizeDigits } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import type { RoiResult } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

type Inputs = {
  beds: number;
  occupancy_rate: number;
  avg_length_of_stay: number;
  bed_day_cost: number;
  discharge_delay_minutes: number;
  clinical_staff: number;
  staff_hourly_cost: number;
  paperwork_minutes_per_shift: number;
  annual_subscription: number;
  implementation_cost: number;
};

const DEFAULTS: Inputs = {
  beds: 300,
  occupancy_rate: 78,
  avg_length_of_stay: 4.2,
  bed_day_cost: 12,
  discharge_delay_minutes: 210,
  clinical_staff: 420,
  staff_hourly_cost: 0.9,
  paperwork_minutes_per_shift: 65,
  annual_subscription: 7200,
  implementation_cost: 3000,
};

export function RoiCalculator({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [result, setResult] = useState<RoiResult | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  const update = useCallback(<K extends keyof Inputs>(key: K, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    const timer = setTimeout(() => {
      apiFetch<RoiResult>("/roi/calculate", { method: "POST", body: JSON.stringify(inputs) })
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setPending(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inputs]);

  const benefitLines = useMemo(() => (result ? result.lines.filter((line) => line.value > 0) : []), [result]);
  const maxLine = Math.max(...benefitLines.map((line) => line.value), 1);
  const assumptions = result ? (locale === "fa" ? result.assumptions_fa : result.assumptions_en) : [];

  const sliders: { key: keyof Inputs; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
    { key: "beds", label: dict.roi.inputs.beds, min: 60, max: 1200, step: 10, format: (v) => formatNumber(v, locale) },
    { key: "occupancy_rate", label: dict.roi.inputs.occupancy, min: 40, max: 100, step: 1, format: (v) => formatPercent(v, locale) },
    { key: "avg_length_of_stay", label: dict.roi.inputs.los, min: 1, max: 12, step: 0.1, format: (v) => formatNumber(v, locale, { maximumFractionDigits: 1 }) },
    { key: "discharge_delay_minutes", label: dict.roi.inputs.discharge, min: 30, max: 600, step: 10, format: (v) => formatNumber(v, locale) },
    { key: "clinical_staff", label: dict.roi.inputs.staff, min: 40, max: 2500, step: 10, format: (v) => formatNumber(v, locale) },
    { key: "paperwork_minutes_per_shift", label: dict.roi.inputs.paperwork, min: 10, max: 180, step: 5, format: (v) => formatNumber(v, locale) },
    { key: "bed_day_cost", label: dict.roi.inputs.bedCost, min: 2, max: 60, step: 1, format: (v) => formatMoney(v, locale) },
    { key: "annual_subscription", label: dict.roi.inputs.subscription, min: 1200, max: 30000, step: 600, format: (v) => formatMoney(v, locale) },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/12 text-brand-600 dark:text-brand-300">
            <Calculator size={17} />
          </span>
          <h3 className="text-base font-bold">{dict.roi.title}</h3>
        </div>

        <div className="flex flex-col gap-5">
          {sliders.map((slider) => (
            <div key={String(slider.key)}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor={`roi-${String(slider.key)}`} className="text-xs font-semibold text-[var(--text-secondary)]">
                  {slider.label}
                </label>
                <span className="tabular text-xs font-extrabold">{slider.format(inputs[slider.key])}</span>
              </div>
              <input
                id={`roi-${String(slider.key)}`}
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={inputs[slider.key]}
                onChange={(event) => update(slider.key, Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--surface-2)] accent-[var(--color-brand-500)] outline-none"
                style={{
                  background: `linear-gradient(to right, var(--color-brand-500) ${((inputs[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%, var(--surface-2) ${((inputs[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%)`,
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="relative overflow-hidden p-5 sm:p-7">
          <div className="absolute -end-16 -top-16 h-48 w-48 rounded-full bg-brand-500/12 blur-3xl" aria-hidden="true" />
          {failed ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">{dict.common.error}</p>
          ) : (
            <div className="relative">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">{dict.roi.results.firstYearNet}</p>
                  <motion.p
                    key={result?.net_benefit ?? 0}
                    initial={{ opacity: 0.4, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="tabular mt-1 text-3xl font-extrabold sm:text-4xl"
                    style={{ color: (result?.net_benefit ?? 0) >= 0 ? "var(--color-status-good)" : "var(--color-status-critical)" }}
                  >
                    {result ? formatMoney(result.net_benefit, locale) : "—"}
                  </motion.p>
                </div>
                <Badge tone="brand">
                  <TrendingUp size={13} />
                  {result ? formatPercent(result.roi_pct, locale) : "—"} {dict.roi.results.roi}
                </Badge>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">{dict.roi.results.payback}</p>
                  <p className="tabular mt-1 text-lg font-extrabold">
                    {result ? `${formatNumber(result.payback_months, locale, { maximumFractionDigits: 1 })} ${dict.roi.results.months}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">{dict.roi.results.steady}</p>
                  <p className="tabular mt-1 text-lg font-extrabold">{result ? formatMoney(result.annual_benefit, locale) : "—"}</p>
                </div>
              </div>

              <p className={`mt-4 text-[11px] ${pending ? "text-brand-500" : "text-[var(--text-muted)]"}`}>
                {pending ? dict.roi.results.calculating : dict.roi.results.disclaimer}
              </p>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-7">
          <h4 className="mb-4 text-sm font-bold">{dict.roi.results.breakdown}</h4>
          <ul className="flex flex-col gap-4">
            {benefitLines.map((line) => (
              <li key={line.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold">{locale === "fa" ? line.label_fa : line.label_en}</span>
                  <span className="tabular shrink-0 text-xs font-extrabold">{formatMoney(line.value, locale)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]" dir="ltr">
                  <motion.div
                    animate={{ width: `${(line.value / maxLine) * 100}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background:
                        line.key === "capacity"
                          ? "var(--color-series-1)"
                          : line.key === "staff"
                            ? "var(--color-series-3)"
                            : "var(--color-series-4)",
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  {localizeDigits(locale === "fa" ? line.detail_fa : line.detail_en, locale)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
              <Info size={13} />
              {dict.roi.results.assumptions}
            </p>
            <ul className="flex flex-col gap-1.5">
              {assumptions.map((assumption) => (
                <li key={assumption} className="flex gap-2 text-[11px] leading-5 text-[var(--text-muted)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                  {localizeDigits(assumption, locale)}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
