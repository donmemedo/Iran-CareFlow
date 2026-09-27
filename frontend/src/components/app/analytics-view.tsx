"use client";

import { useState } from "react";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui";
import { PageHeader } from "./page-header";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { WeekdayBars } from "@/components/charts/weekday-bars";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { DepartmentLoad, EmergencyLoad, Occupancy, ResourceRow, Seasonality } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const HORIZONS = [7, 14, 30];

export function AnalyticsView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [horizon, setHorizon] = useState(14);
  const [department, setDepartment] = useState<number | null>(null);

  const { data: departments } = useApi<DepartmentLoad[]>("/departments");
  const { data: occupancy } = useApi<Occupancy>(
    `/analytics/occupancy?days=120&horizon=${horizon}${department ? `&department_id=${department}` : ""}`,
    [horizon, department],
  );
  const { data: emergency } = useApi<EmergencyLoad>(`/analytics/emergency-load?days=120&horizon=${horizon}`, [horizon]);
  const { data: resources } = useApi<{ rows: ResourceRow[] }>(`/analytics/resource-demand?horizon=${horizon}`, [horizon]);
  const { data: seasonality } = useApi<Seasonality>("/analytics/seasonality");

  const chartLabels = {
    history: dict.app.dashboard.history,
    forecast: dict.app.dashboard.forecast,
    capacity: dict.app.dashboard.capacity,
    showTable: dict.app.dashboard.showTable,
    hideTable: dict.app.dashboard.hideTable,
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={dict.app.analytics.title}
        subtitle={dict.app.analytics.subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={department ?? ""}
              onChange={(event) => setDepartment(event.target.value ? Number(event.target.value) : null)}
              aria-label={dict.common.department}
              className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold outline-none focus:border-brand-500"
            >
              <option value="">{dict.common.all}</option>
              {(departments ?? [])
                .filter((item) => item.bed_capacity > 0)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {locale === "fa" ? item.name_fa : item.name_en}
                  </option>
                ))}
            </select>

            <div
              role="radiogroup"
              aria-label={dict.app.analytics.horizon}
              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
            >
              {HORIZONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={horizon === value}
                  onClick={() => setHorizon(value)}
                  className={clsx(
                    "tabular rounded-lg px-3 py-1.5 text-xs font-bold transition",
                    horizon === value ? "bg-brand-500 text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {formatNumber(value, locale)}
                  <span className="ms-1 font-semibold">{dict.common.day}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={dict.app.dashboard.occupancyTitle}
            subtitle={occupancy ? (locale === "fa" ? occupancy.department_fa : occupancy.department_en) : undefined}
            action={
              occupancy?.peak_day ? (
                <Badge tone={occupancy.peak_value / Math.max(occupancy.capacity, 1) > 0.92 ? "serious" : "brand"}>
                  {dict.app.analytics.peakOn} {formatDate(occupancy.peak_day, locale)}
                </Badge>
              ) : null
            }
          />
          <div className="px-3 pb-5 sm:px-5">
            {occupancy ? (
              <ForecastChart
                history={occupancy.history.map((point) => ({ day: point.day, value: point.occupied }))}
                forecast={occupancy.forecast}
                capacity={occupancy.capacity}
                locale={locale}
                labels={chartLabels}
                height={300}
              />
            ) : (
              <Skeleton className="h-[300px]" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={dict.app.analytics.edTitle}
            subtitle={dict.app.analytics.edSubtitle}
            action={
              emergency ? (
                <Badge tone={emergency.trend_pct > 0 ? "serious" : "good"}>
                  {emergency.trend_pct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {formatPercent(Math.abs(emergency.trend_pct), locale, 1)}
                </Badge>
              ) : null
            }
          />
          <div className="px-3 pb-5 sm:px-5">
            {emergency ? (
              <ForecastChart
                history={emergency.history}
                forecast={emergency.forecast}
                locale={locale}
                labels={chartLabels}
                height={300}
                colorVar="var(--color-series-2)"
              />
            ) : (
              <Skeleton className="h-[300px]" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title={dict.app.analytics.resourceTitle} subtitle={dict.app.analytics.resourceSubtitle} />
          <div className="overflow-x-auto pb-2">
            {!resources ? (
              <div className="px-5 pb-5">
                <Skeleton className="h-56" />
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[var(--surface-2)] text-[11px] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{dict.app.analytics.table.department}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{dict.app.analytics.table.current}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{dict.app.analytics.table.peak}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{dict.app.analytics.table.rate}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{dict.app.analytics.table.required}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{dict.app.analytics.table.gap}</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.rows.map((row) => {
                    const short = row.gap > 0;
                    return (
                      <tr key={row.department_id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2.5 text-xs font-bold">{locale === "fa" ? row.name_fa : row.name_en}</td>
                        <td className="tabular px-4 py-2.5 text-xs">{formatNumber(row.current, locale)}</td>
                        <td className="tabular px-4 py-2.5 text-xs">{formatNumber(row.peak_forecast, locale)}</td>
                        <td className="tabular px-4 py-2.5 text-xs">
                          <span
                            style={{
                              color: row.peak_rate >= 95 ? "var(--color-status-critical)" : row.peak_rate >= 88 ? "var(--color-status-serious)" : undefined,
                              fontWeight: row.peak_rate >= 88 ? 700 : undefined,
                            }}
                          >
                            {formatPercent(row.peak_rate, locale)}
                          </span>
                        </td>
                        <td className="tabular px-4 py-2.5 text-xs">{formatNumber(row.nurses_required, locale)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={short ? "serious" : "good"}>
                            {formatNumber(Math.abs(row.gap), locale)} {short ? dict.app.analytics.shortage : dict.app.analytics.surplus}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={dict.app.analytics.seasonTitle} subtitle={dict.app.analytics.seasonSubtitle} />
          <div className="px-5 pb-6">
            {seasonality ? (
              <WeekdayBars
                locale={locale}
                data={seasonality.weekdays.map((weekday) => ({
                  index: weekday.index,
                  label: locale === "fa" ? weekday.label_fa : weekday.label_en,
                  delta: weekday.delta_pct,
                }))}
              />
            ) : (
              <Skeleton className="h-56" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
