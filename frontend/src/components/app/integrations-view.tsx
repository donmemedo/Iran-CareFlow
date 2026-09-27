"use client";

import { Activity, Database, FileStack, Image as ImageIcon, Radio, Share2 } from "lucide-react";
import { Badge, Card, Skeleton } from "@/components/ui";
import { PageHeader } from "./page-header";
import { useApi } from "@/lib/use-api";
import { formatCompact, formatNumber, relativeTime } from "@/lib/format";
import type { Integration } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const KIND_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  HIS: Database,
  LIS: FileStack,
  PACS: ImageIcon,
  SEPAS: Share2,
  FHIR: Activity,
  HL7: Radio,
};

const STATUS_TONE = { connected: "good", degraded: "warning", offline: "critical" } as const;

export function IntegrationsView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { data: integrations, loading } = useApi<Integration[]>("/integrations");

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title={dict.app.integrations.title} subtitle={dict.app.integrations.subtitle} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(integrations ?? []).map((integration) => {
            const Icon = KIND_ICON[integration.kind] ?? Database;
            const tone = STATUS_TONE[integration.status];
            return (
              <Card key={integration.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    <Icon size={19} />
                  </span>
                  <Badge tone={tone}>
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: `var(--color-status-${integration.status === "connected" ? "good" : integration.status === "degraded" ? "warning" : "critical"})` }}
                    />
                    {dict.app.integrations.status[integration.status]}
                  </Badge>
                </div>

                <h3 className="mt-4 text-sm font-bold">{locale === "fa" ? integration.name_fa : integration.name_en}</h3>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  {dict.app.integrations.vendor}: {integration.vendor}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 text-[11px]">
                  <div>
                    <dt className="text-[var(--text-muted)]">{dict.app.integrations.protocol}</dt>
                    <dd className="mt-0.5 font-bold" dir="ltr">
                      {integration.protocol}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">{dict.app.integrations.latency}</dt>
                    <dd
                      className="tabular mt-0.5 font-bold"
                      style={{ color: integration.latency_ms > 400 ? "var(--color-status-serious)" : undefined }}
                    >
                      {formatNumber(integration.latency_ms, locale)} ms
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">{dict.app.integrations.volume}</dt>
                    <dd className="tabular mt-0.5 font-bold">{formatCompact(integration.records_per_day, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">{dict.app.integrations.lastSync}</dt>
                    <dd className="mt-0.5 font-bold">{relativeTime(integration.last_sync_at, locale)}</dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
