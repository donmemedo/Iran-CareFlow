"use client";

import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { PageHeader } from "./page-header";
import { useApi } from "@/lib/use-api";
import { formatNumber } from "@/lib/format";
import type { Patient } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export function CollaborationView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { data: patients, loading } = useApi<Patient[]>("/patients?status=active&limit=40");

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title={dict.app.collaboration.title} subtitle={dict.app.collaboration.subtitle} />

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : !patients || patients.length === 0 ? (
        <Card>
          <EmptyState title={dict.common.empty} hint={dict.common.emptyHint} icon={<MessagesSquare size={22} />} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link href={`/${locale}/app/patients/${patient.id}`}>
                <Card className="flex items-center gap-3.5 p-4 transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-lift)]">
                  <Avatar name={locale === "fa" ? patient.name_fa : patient.name_en} hue={(patient.id * 47) % 360} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{locale === "fa" ? patient.name_fa : patient.name_en}</p>
                      <Badge tone="neutral">{locale === "fa" ? patient.department_fa : patient.department_en}</Badge>
                      {patient.blocked ? <Badge tone="critical">{dict.app.patients.detail.stepBlocked}</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {(locale === "fa" ? patient.current_step_fa : patient.current_step_en) ?? "—"} ·{" "}
                      {locale === "fa" ? patient.diagnosis_fa : patient.diagnosis_en}
                    </p>
                  </div>
                  <span className="tabular hidden shrink-0 text-[11px] font-semibold text-[var(--text-muted)] sm:block">
                    {formatNumber(patient.progress, locale, { maximumFractionDigits: 0 })}٪
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
