"use client";

import { useState } from "react";
import { AlertTriangle, BedDouble, CheckCircle2, Info, ShieldAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { PageHeader } from "./page-header";
import { KpiTile } from "./kpi-tile";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { LoadBars } from "@/components/charts/load-bars";
import { useApi } from "@/lib/use-api";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatNumber, formatPercent, relativeTime } from "@/lib/format";
import type { Alert, DepartmentLoad, Occupancy, Overview } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const SEVERITY_TONE = { critical: "critical", serious: "serious", warning: "warning", good: "good" } as const;
const SEVERITY_ICON = { critical: ShieldAlert, serious: AlertTriangle, warning: Info, good: CheckCircle2 };

export function DashboardView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { user } = useSession();
  const { data: overview, loading: overviewLoading } = useApi<Overview>("/overview");
  const { data: occupancy } = useApi<Occupancy>("/analytics/occupancy?days=90&horizon=14");
  const { data: departments } = useApi<DepartmentLoad[]>("/departments");
  const { data: alerts, reload: reloadAlerts } = useApi<Alert[]>("/alerts");
  const [acknowledging, setAcknowledging] = useState<number | null>(null);

  async function acknowledge(id: number) {
    setAcknowledging(id);
    try {
      await apiFetch(`/alerts/${id}/acknowledge`, { method: "POST" });
      reloadAlerts();
    } finally {
      setAcknowledging(null);
    }
  }

  const greeting = user
    ? `${dict.app.dashboard.welcome}${locale === "fa" ? "\u060c" : ","} ${locale === "fa" ? user.name_fa : user.name_en}`
    : dict.app.dashboard.title;
  const hospital = overview ? (locale === "fa" ? overview.hospital_name_fa : overview.hospital_name_en) : dict.app.dashboard.subtitle;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={greeting} subtitle={hospital} />

      {/* Headline counters */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          icon={<BedDouble size={16} />}
          value={overview ? `${formatNumber(overview.beds_occupied, locale)} / ${formatNumber(overview.beds_total, locale)}` : "—"}
          label={dict.app.dashboard.bedsInUse}
          loading={overviewLoading}
        />
        <SummaryTile
          icon={<Users size={16} />}
          value={overview ? formatNumber(overview.active_patients, locale) : "—"}
          label={dict.app.dashboard.activePatients}
          loading={overviewLoading}
        />
        <SummaryTile
          icon={<AlertTriangle size={16} />}
          value={overview ? formatNumber(overview.open_alerts, locale) : "—"}
          label={dict.app.dashboard.openAlerts}
          loading={overviewLoading}
          tone="var(--color-status-serious)"
        />
        <SummaryTile
          icon={<CheckCircle2 size={16} />}
          value={overview ? formatPercent(overview.pathway_adherence, locale, 1) : "—"}
          label={dict.app.dashboard.adherence}
          loading={overviewLoading}
          tone="var(--color-status-good)"
        />
      </div>

      {/* KPI grid */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {overview
          ? overview.kpis.map((kpi, index) => (
              <KpiTile key={kpi.key} kpi={kpi} locale={locale} dict={dict} index={index} />
            ))
          : Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36" />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Card>
          <CardHeader title={dict.app.dashboard.occupancyTitle} subtitle={dict.app.dashboard.occupancySubtitle} />
          <div className="px-3 pb-5 sm:px-5">
            {occupancy ? (
              <ForecastChart
                history={occupancy.history.map((point) => ({ day: point.day, value: point.occupied }))}
                forecast={occupancy.forecast}
                capacity={occupancy.capacity}
                locale={locale}
                height={320}
                labels={{
                  history: dict.app.dashboard.history,
                  forecast: dict.app.dashboard.forecast,
                  capacity: dict.app.dashboard.capacity,
                  showTable: dict.app.dashboard.showTable,
                  hideTable: dict.app.dashboard.hideTable,
                }}
              />
            ) : (
              <Skeleton className="h-[320px]" />
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title={dict.app.dashboard.departmentTitle} subtitle={dict.app.dashboard.departmentSubtitle} />
            <div className="px-5 pb-6">
              {departments ? (
                <LoadBars
                  locale={locale}
                  rows={departments
                    .filter((department) => department.bed_capacity > 0)
                    .map((department) => ({
                      id: department.id,
                      label: locale === "fa" ? department.name_fa : department.name_en,
                      value: department.occupancy_rate,
                      used: department.occupied_beds,
                      capacity: department.bed_capacity,
                      detail: `${formatNumber(department.admissions_today, locale)} ${locale === "fa" ? "پذیرش" : "admissions"}`,
                    }))}
                />
              ) : (
                <Skeleton className="h-64" />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Alerts */}
      <Card className="mt-5">
        <CardHeader title={dict.app.dashboard.alertsTitle} subtitle={dict.app.dashboard.alertsSubtitle} />
        <div className="px-3 pb-4 sm:px-5">
          {!alerts ? (
            <Skeleton className="h-40" />
          ) : alerts.length === 0 ? (
            <EmptyState title={dict.app.header.noAlerts} icon={<CheckCircle2 size={22} />} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {alerts.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity];
                return (
                  <li
                    key={alert.id}
                    className="flex flex-wrap items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 sm:flex-nowrap"
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: `color-mix(in oklab, var(--color-status-${alert.severity}) 14%, transparent)`,
                        color: `var(--color-status-${alert.severity})`,
                      }}
                    >
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{locale === "fa" ? alert.title_fa : alert.title_en}</p>
                        {alert.department_fa ? (
                          <Badge tone={SEVERITY_TONE[alert.severity]}>
                            {locale === "fa" ? alert.department_fa : alert.department_en}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                        {locale === "fa" ? alert.detail_fa : alert.detail_en}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">{relativeTime(alert.created_at, locale)}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => acknowledge(alert.id)}
                      disabled={acknowledging === alert.id}
                      className="ms-auto shrink-0"
                    >
                      {dict.app.dashboard.acknowledge}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function SummaryTile({
  icon,
  value,
  label,
  loading,
  tone = "var(--color-series-1)",
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  loading?: boolean;
  tone?: string;
}) {
  if (loading) return <Skeleton className="h-[88px]" />;
  return (
    <Card className="flex items-center gap-3.5 p-4 sm:p-5">
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: `color-mix(in oklab, ${tone} 12%, transparent)`, color: tone }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="tabular truncate text-lg font-extrabold sm:text-xl">{value}</p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">{label}</p>
      </div>
    </Card>
  );
}
