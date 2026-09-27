"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  Send,
  Timer,
} from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, ProgressBar, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatDuration, formatMinutes, formatPercent, relativeTime } from "@/lib/format";
import type { CaseStep, Message, PatientDetail } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const KIND_TONE = { note: "neutral", request: "warning", decision: "brand", alert: "critical" } as const;

export function PatientDetailView({
  locale,
  dict,
  patientId,
}: {
  locale: Locale;
  dict: Dictionary;
  patientId: number;
}) {
  const { data: patient, loading, reload } = useApi<PatientDetail>(`/patients/${patientId}`);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const Back = locale === "fa" ? ArrowRight : ArrowLeft;

  async function completeStep(step: CaseStep) {
    setAdvancing(step.id);
    try {
      await apiFetch(`/patients/${patientId}/steps/${step.id}/advance`, { method: "POST" });
      reload();
    } finally {
      setAdvancing(null);
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await apiFetch<Message>(`/patients/${patientId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, kind: "note" }),
      });
      setDraft("");
      reload();
    } finally {
      setSending(false);
    }
  }

  if (loading || !patient) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <Skeleton className="mb-4 h-28" />
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  }

  const name = locale === "fa" ? patient.name_fa : patient.name_en;
  const detail = dict.app.patients.detail;

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        href={`/${locale}/app/patients`}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
      >
        <Back size={15} />
        {dict.app.patients.title}
      </Link>

      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold sm:text-2xl">{name}</h1>
              <Badge tone={patient.blocked ? "critical" : "brand"}>
                {locale === "fa" ? patient.pathway_fa : patient.pathway_en}
              </Badge>
              {patient.blocked ? (
                <Badge tone="critical">
                  <AlertOctagon size={12} />
                  {detail.stepBlocked}
                </Badge>
              ) : null}
            </div>
            <p className="tabular mt-1.5 text-xs text-[var(--text-muted)]" dir="ltr">
              {patient.mrn} · {patient.bed} · {locale === "fa" ? patient.department_fa : patient.department_en}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
              {locale === "fa" ? patient.diagnosis_fa : patient.diagnosis_en}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
            <Meta label={detail.admitted} value={formatDateTime(patient.admitted_at, locale)} />
            <Meta label={dict.app.patients.table.stay} value={formatDuration(patient.los_hours, locale)} />
            <Meta
              label={detail.expectedDischarge}
              value={patient.expected_discharge_at ? formatDateTime(patient.expected_discharge_at, locale) : "—"}
            />
            <Meta label={detail.risk} value={formatPercent(patient.risk_score * 100, locale)} />
          </dl>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar value={patient.progress} tone={patient.blocked ? "critical" : "brand"} />
          </div>
          <span className="tabular text-xs font-extrabold">{formatPercent(patient.progress, locale)}</span>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        {/* Pathway timeline */}
        <Card>
          <CardHeader title={detail.pathway} subtitle={locale === "fa" ? patient.pathway_fa : patient.pathway_en} />
          <ol className="flex flex-col px-5 pb-6">
            {patient.steps.map((step, index) => {
              const isLast = index === patient.steps.length - 1;
              const done = step.status === "done";
              const active = step.status === "active" || step.status === "blocked";
              const tone = done
                ? "var(--color-status-good)"
                : step.status === "blocked"
                  ? "var(--color-status-critical)"
                  : active
                    ? "var(--color-brand-500)"
                    : "var(--axis)";
              return (
                <li key={step.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {!isLast ? (
                    <span
                      className="absolute top-7 h-[calc(100%-1.25rem)] w-px"
                      style={{ insetInlineStart: "0.68rem", background: done ? "var(--color-status-good)" : "var(--border)" }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className="relative mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center"
                    style={{ color: tone }}
                  >
                    {done ? <CheckCircle2 size={22} /> : active ? <Timer size={22} /> : <Circle size={22} />}
                    {active ? (
                      <span
                        className="absolute inset-0 -z-10 animate-[pulse-ring_2.6s_ease-out_infinite] rounded-full"
                        style={{ background: tone, opacity: 0.28 }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={clsx("text-sm font-bold", !done && !active && "text-[var(--text-muted)]")}>
                        {locale === "fa" ? step.name_fa : step.name_en}
                      </p>
                      <Badge tone={done ? "good" : step.status === "blocked" ? "critical" : active ? "brand" : "neutral"}>
                        {done ? detail.stepDone : step.status === "blocked" ? detail.stepBlocked : active ? detail.stepActive : detail.stepPending}
                      </Badge>
                      {step.overdue ? <Badge tone="serious">{detail.overdue}</Badge> : null}
                    </div>

                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={11} />
                        {detail.target}: {formatMinutes(step.target_minutes, locale)}
                      </span>
                      {step.elapsed_minutes !== null ? (
                        <span style={{ color: step.overdue ? "var(--color-status-serious)" : undefined }}>
                          {detail.elapsed}: {formatMinutes(step.elapsed_minutes, locale)}
                        </span>
                      ) : null}
                      {step.assignee_name_fa ? (
                        <span>{locale === "fa" ? step.assignee_name_fa : step.assignee_name_en}</span>
                      ) : null}
                    </p>

                    {active ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2.5"
                        onClick={() => completeStep(step)}
                        disabled={advancing === step.id}
                      >
                        {advancing === step.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        {advancing === step.id ? detail.completing : detail.complete}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-5">
          {/* Care team */}
          <Card>
            <CardHeader title={detail.careTeam} />
            <ul className="flex flex-col gap-3 px-5 pb-6">
              {patient.care_team.map((member) => (
                <li key={member.user_id} className="flex items-center gap-3">
                  <Avatar name={locale === "fa" ? member.name_fa : member.name_en} hue={member.avatar_hue} size={38} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{locale === "fa" ? member.name_fa : member.name_en}</p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {locale === "fa" ? member.role_fa : member.role_en}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Collaboration thread */}
          <Card className="flex flex-col">
            <CardHeader title={detail.thread} />
            <ul className="flex max-h-96 flex-col gap-3.5 overflow-auto px-5 pb-4">
              <AnimatePresence initial={false}>
                {patient.messages.map((message) => (
                  <motion.li
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5"
                  >
                    <Avatar name={locale === "fa" ? message.author_name_fa : message.author_name_en} hue={message.avatar_hue} size={32} />
                    <div className="min-w-0 flex-1 rounded-2xl rounded-ss-sm bg-[var(--surface-2)] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-bold">
                          {locale === "fa" ? message.author_name_fa : message.author_name_en}
                        </p>
                        <Badge tone={KIND_TONE[message.kind]}>{detail.kinds[message.kind]}</Badge>
                        <span className="ms-auto text-[10px] text-[var(--text-muted)]">
                          {relativeTime(message.created_at, locale)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-6 whitespace-pre-line text-[var(--text-secondary)]">
                        {locale === "fa" ? message.body.split("\n---\n")[0] : message.body.split("\n---\n").slice(-1)[0]}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[var(--border)] p-4">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                placeholder={detail.placeholder}
                className="min-h-11 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-6 outline-none transition focus:border-brand-500"
              />
              <Button type="submit" size="md" disabled={sending || !draft.trim()}>
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-[var(--text-muted)]">{label}</dt>
      <dd className="tabular mt-0.5 font-bold">{value}</dd>
    </div>
  );
}
