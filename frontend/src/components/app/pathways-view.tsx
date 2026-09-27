"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "motion/react";
import { Clock3, Layers, Stethoscope, UserCog, UserRound } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { PageHeader } from "./page-header";
import { useApi } from "@/lib/use-api";
import { formatMinutes, formatNumber, formatPercent } from "@/lib/format";
import type { Board, Pathway } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const ROLE_ICON = { nurse: UserRound, physician: Stethoscope, manager: UserCog };

export function PathwaysView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { data: pathways, loading } = useApi<Pathway[]>("/pathways");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (selected === null && pathways?.length) setSelected(pathways[0].id);
  }, [pathways, selected]);

  const { data: board } = useApi<Board>(selected ? `/pathways/${selected}/board` : null, [selected]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={dict.app.pathways.title} subtitle={dict.app.pathways.subtitle} />

      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(pathways ?? []).map((pathway) => {
            const active = pathway.id === selected;
            return (
              <button key={pathway.id} type="button" onClick={() => setSelected(pathway.id)} className="text-start">
                <Card
                  className={clsx(
                    "h-full p-5 transition",
                    active ? "border-brand-500/50 shadow-[var(--shadow-lift)]" : "hover:border-[var(--border-strong)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{locale === "fa" ? pathway.name_fa : pathway.name_en}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {locale === "fa" ? pathway.department_fa : pathway.department_en}
                      </p>
                    </div>
                    <Badge tone={pathway.adherence >= 80 ? "good" : pathway.adherence >= 65 ? "warning" : "serious"}>
                      {formatPercent(pathway.adherence, locale)}
                    </Badge>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-xs leading-6 text-[var(--text-secondary)]">
                    {locale === "fa" ? pathway.description_fa : pathway.description_en}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Layers size={12} />
                      {formatNumber(pathway.steps.length, locale)} {dict.app.pathways.steps}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={12} />
                      {formatNumber(pathway.target_hours, locale)} {dict.common.hour}
                    </span>
                    <span className="tabular font-bold text-[var(--text-secondary)]">
                      {formatNumber(pathway.active_cases, locale)} {dict.app.pathways.activeCases}
                    </span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title={dict.app.pathways.board}
          subtitle={board ? (locale === "fa" ? board.pathway.name_fa : board.pathway.name_en) : undefined}
        />
        <div className="overflow-x-auto px-4 pb-5">
          {!board ? (
            <Skeleton className="h-72" />
          ) : (
            <div className="flex min-w-max gap-3">
              {board.columns.map((column, columnIndex) => {
                const RoleIcon = ROLE_ICON[column.owner_role];
                return (
                  <motion.div
                    key={column.step_id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: columnIndex * 0.05 }}
                    className="w-60 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3"
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold">{locale === "fa" ? column.name_fa : column.name_en}</p>
                        <span className="tabular rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-extrabold">
                          {formatNumber(column.cases.length, locale)}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                        <RoleIcon size={11} />
                        {dict.app.pathways.roles[column.owner_role]} · {formatMinutes(column.target_minutes, locale)}
                      </p>
                    </div>

                    <ul className="flex flex-col gap-2">
                      {column.cases.length === 0 ? (
                        <li className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-[10px] text-[var(--text-muted)]">
                          {dict.app.pathways.noCases}
                        </li>
                      ) : (
                        column.cases.map((item) => {
                          const overdue = item.elapsed_minutes > column.target_minutes * 1.25;
                          return (
                            <li key={item.case_step_id}>
                              <Link href={`/${locale}/app/patients/${item.patient_id}`}>
                                <div
                                  className={clsx(
                                    "rounded-xl border bg-[var(--surface)] p-2.5 transition hover:shadow-[var(--shadow-soft)]",
                                    item.status === "blocked"
                                      ? "border-[var(--color-status-critical)]/40"
                                      : overdue
                                        ? "border-[var(--color-status-serious)]/40"
                                        : "border-[var(--border)]",
                                  )}
                                >
                                  <p className="truncate text-[11px] font-bold">
                                    {locale === "fa" ? item.name_fa : item.name_en}
                                  </p>
                                  <p className="tabular mt-0.5 flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                                    <span dir="ltr">{item.bed}</span>
                                    <span
                                      style={{
                                        color: overdue ? "var(--color-status-serious)" : undefined,
                                        fontWeight: overdue ? 700 : undefined,
                                      }}
                                    >
                                      {formatMinutes(item.elapsed_minutes, locale)}
                                    </span>
                                  </p>
                                </div>
                              </Link>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
