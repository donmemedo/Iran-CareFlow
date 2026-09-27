"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { AlertOctagon, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar, Skeleton } from "@/components/ui";
import { PageHeader } from "./page-header";
import { useApi } from "@/lib/use-api";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import type { DepartmentLoad, Patient } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const ACUITY_TONE: Record<number, "critical" | "serious" | "warning" | "neutral" | "good"> = {
  1: "critical",
  2: "serious",
  3: "warning",
  4: "neutral",
  5: "good",
};

export function PatientsView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [department, setDepartment] = useState<number | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);

  const { data: departments } = useApi<DepartmentLoad[]>("/departments");
  const { data: patients, loading } = useApi<Patient[]>("/patients?status=active&limit=300");

  const filtered = useMemo(() => {
    if (!patients) return [];
    const needle = query.trim().toLowerCase();
    return patients.filter((patient) => {
      if (department && patient.department_id !== department) return false;
      if (blockedOnly && !patient.blocked) return false;
      if (!needle) return true;
      return (
        patient.name_fa.toLowerCase().includes(needle) ||
        patient.name_en.toLowerCase().includes(needle) ||
        patient.mrn.toLowerCase().includes(needle)
      );
    });
  }, [patients, query, department, blockedOnly]);

  const Chevron = locale === "fa" ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={dict.app.patients.title}
        subtitle={dict.app.patients.subtitle}
        action={
          <Badge tone="brand">
            {formatNumber(filtered.length, locale)} {dict.app.patients.count}
          </Badge>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dict.app.patients.searchPlaceholder}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] ps-9 pe-3 text-xs outline-none transition focus:border-brand-500"
            />
          </div>

          <select
            value={department ?? ""}
            onChange={(event) => setDepartment(event.target.value ? Number(event.target.value) : null)}
            aria-label={dict.common.department}
            className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-semibold outline-none transition focus:border-brand-500"
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

          <button
            type="button"
            onClick={() => setBlockedOnly((value) => !value)}
            className={clsx(
              "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
              blockedOnly
                ? "border-[var(--color-status-critical)]/40 bg-[var(--color-status-critical)]/10 text-[var(--color-status-critical)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]",
            )}
          >
            <AlertOctagon size={14} />
            {dict.app.patients.onlyBlocked}
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title={dict.common.empty} hint={dict.common.emptyHint} />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-[11px] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{dict.app.patients.table.patient}</th>
                  <th className="px-4 py-3 text-start font-semibold">{dict.app.patients.table.department}</th>
                  <th className="px-4 py-3 text-start font-semibold">{dict.app.patients.table.step}</th>
                  <th className="px-4 py-3 text-start font-semibold">{dict.app.patients.table.progress}</th>
                  <th className="px-4 py-3 text-start font-semibold">{dict.app.patients.table.stay}</th>
                  <th className="px-4 py-3 text-start font-semibold">{dict.app.patients.table.acuity}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => (
                  <tr
                    key={patient.id}
                    className="group border-t border-[var(--border)] transition hover:bg-[var(--surface-2)]/70"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/app/patients/${patient.id}`} className="block">
                        <span className="block font-bold">{locale === "fa" ? patient.name_fa : patient.name_en}</span>
                        <span className="tabular block text-[11px] text-[var(--text-muted)]" dir="ltr">
                          {patient.mrn} · {patient.bed}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">{locale === "fa" ? patient.department_fa : patient.department_en}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        {patient.blocked ? <AlertOctagon size={13} className="shrink-0 text-[var(--color-status-critical)]" /> : null}
                        {(locale === "fa" ? patient.current_step_fa : patient.current_step_en) ?? "—"}
                      </span>
                    </td>
                    <td className="w-40 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar value={patient.progress} tone={patient.blocked ? "critical" : "brand"} />
                        </div>
                        <span className="tabular text-[11px] font-bold">{formatPercent(patient.progress, locale)}</span>
                      </div>
                    </td>
                    <td className="tabular px-4 py-3 text-xs">{formatDuration(patient.los_hours, locale)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ACUITY_TONE[patient.acuity]}>{dict.app.patients.acuity[patient.acuity]}</Badge>
                    </td>
                    <td className="px-2 text-[var(--text-muted)]">
                      <Link href={`/${locale}/app/patients/${patient.id}`} aria-label={dict.common.more}>
                        <Chevron size={16} className="transition group-hover:text-brand-500" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2.5 lg:hidden">
            {filtered.map((patient) => (
              <li key={patient.id}>
                <Link href={`/${locale}/app/patients/${patient.id}`}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{locale === "fa" ? patient.name_fa : patient.name_en}</p>
                        <p className="tabular mt-0.5 text-[11px] text-[var(--text-muted)]" dir="ltr">
                          {patient.mrn} · {patient.bed}
                        </p>
                      </div>
                      <Badge tone={ACUITY_TONE[patient.acuity]}>{dict.app.patients.acuity[patient.acuity]}</Badge>
                    </div>
                    <p className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      {patient.blocked ? <AlertOctagon size={13} className="shrink-0 text-[var(--color-status-critical)]" /> : null}
                      {(locale === "fa" ? patient.current_step_fa : patient.current_step_en) ?? "—"}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={patient.progress} tone={patient.blocked ? "critical" : "brand"} />
                      </div>
                      <span className="tabular text-[11px] font-bold">{formatPercent(patient.progress, locale)}</span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
