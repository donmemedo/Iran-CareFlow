"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, BedDouble, ShieldCheck, Sparkles, TrendingDown, Users } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { Sparkline } from "@/components/charts/sparkline";
import { Counter } from "./counter";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const PREVIEW_OCCUPANCY = [303, 311, 298, 316, 322, 309, 318, 327, 331, 324, 336, 341, 329, 338];
const PREVIEW_DISCHARGE = [246, 238, 231, 227, 219, 214, 208, 203, 198, 194, 189, 186, 181, 178];

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const reduce = useReducedMotion();
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24 lg:pt-40">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="grid-veil absolute inset-0 opacity-45" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3.5 py-1.5 text-xs font-bold text-brand-700 dark:text-brand-300"
            >
              <Sparkles size={14} />
              {dict.hero.badge}
            </motion.div>

            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="mt-5 text-4xl leading-[1.15] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.1]"
            >
              {dict.hero.titleTop}{" "}
              <span className="text-gradient">{dict.hero.titleGradient}</span>{" "}
              {dict.hero.titleBottom}
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16 }}
              className="mt-6 max-w-xl text-sm leading-8 text-[var(--text-secondary)] text-pretty sm:text-base"
            >
              {dict.hero.subtitle}
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <LinkButton href="#contact" size="lg" className="w-full sm:w-auto">
                {dict.hero.primaryCta}
                <Arrow size={17} />
              </LinkButton>
              <LinkButton href={`/${locale}/login`} variant="secondary" size="lg" className="w-full sm:w-auto">
                {dict.hero.secondaryCta}
              </LinkButton>
            </motion.div>

            <motion.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.34 }}
              className="mt-6 flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]"
            >
              <ShieldCheck size={15} className="shrink-0 text-brand-500" />
              <span className="text-pretty">{dict.hero.trustLine}</span>
            </motion.p>

            <motion.dl
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.42 }}
              className="mt-10 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-7"
            >
              {dict.hero.stats.map((stat) => {
                // A percent sign hugs the number; a word unit sits beside it.
                const suffix: string = stat.suffix;
                const isPercent = suffix === "%" || suffix === "\u066a";
                return (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-2xl font-extrabold sm:text-3xl">
                      <Counter value={stat.value} locale={locale} suffix={isPercent ? suffix : ""} />
                      {isPercent ? null : (
                        <span className="ms-1 text-sm font-bold text-[var(--text-muted)]">{suffix}</span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-[var(--text-muted)] sm:text-xs">{stat.label}</span>
                  </dd>
                </div>
                );
              })}
            </motion.dl>
          </div>

          <HeroPreview locale={locale} dict={dict} />
        </div>
      </div>
    </section>
  );
}

function HeroPreview({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="relative [perspective:1400px]"
      dir="ltr"
    >
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-brand-500/20 via-[var(--color-series-1)]/12 to-transparent blur-2xl" aria-hidden="true" />

      <div className="glass overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/70 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-status-critical)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-status-warning)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-status-good)]/70" />
          <span className="ms-2 text-[10px] font-semibold text-[var(--text-muted)]" dir="auto">
            {dict.app.dashboard.title}
          </span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-status-good)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-[pulse-ring_2.6s_ease-out_infinite] rounded-full bg-[var(--color-status-good)]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-status-good)]" />
            </span>
            live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5" dir="auto">
          <PreviewTile
            icon={<BedDouble size={15} />}
            label={dict.app.dashboard.bedsInUse}
            value={formatNumber(338, locale)}
            sub={`/ ${formatNumber(394, locale)}`}
            series={PREVIEW_OCCUPANCY}
            color="var(--color-series-1)"
            delta={`+${formatPercent(3.2, locale, 1)}`}
            deltaTone="neutral"
          />
          <PreviewTile
            icon={<TrendingDown size={15} />}
            label={dict.hero.previewDischarge}
            value={formatNumber(178, locale)}
            sub={dict.common.minutes}
            series={PREVIEW_DISCHARGE}
            color="var(--color-series-3)"
            delta={`−${formatPercent(27.6, locale, 1)}`}
            deltaTone="good"
          />

          <div className="col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold">{dict.app.dashboard.departmentTitle}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{dict.common.now}</span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: locale === "fa" ? "اورژانس" : "Emergency", value: 92 },
                { label: locale === "fa" ? "مراقبت‌های ویژه" : "Intensive care", value: 88 },
                { label: locale === "fa" ? "داخلی" : "Internal medicine", value: 74 },
                { label: locale === "fa" ? "جراحی" : "Surgery", value: 63 },
              ].map((row, index) => (
                <li key={row.label} className="grid grid-cols-[1fr_2.2fr_auto] items-center gap-2.5">
                  <span className="truncate text-[10px] font-semibold text-[var(--text-secondary)]">{row.label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" dir="ltr">
                    <motion.div
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${row.value}%` }}
                      transition={{ duration: 1.1, delay: 0.5 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          row.value >= 90
                            ? "var(--color-status-critical)"
                            : row.value >= 85
                              ? "var(--color-status-serious)"
                              : "var(--color-series-1)",
                      }}
                    />
                  </div>
                  <span className="tabular text-[10px] font-bold">{formatPercent(row.value, locale)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-[var(--color-status-serious)]/30 bg-[var(--color-status-serious)]/8 p-3.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-status-serious)]/16 text-[var(--color-status-serious)]">
              <Users size={15} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold">
                {locale === "fa" ? "معطلی اورژانس بیش از ۶ ساعت" : "Emergency boarding above 6 hours"}
              </p>
              <p className="truncate text-[10px] text-[var(--text-muted)]">
                {locale === "fa" ? "۱۱ بیمار در انتظار تخت بستری" : "11 patients waiting for an inpatient bed"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PreviewTile({
  icon,
  label,
  value,
  sub,
  series,
  color,
  delta,
  deltaTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  series: number[];
  color: string;
  delta: string;
  deltaTone: "good" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
        <span style={{ color }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="tabular text-xl font-extrabold sm:text-2xl">{value}</span>
        <span className="text-[10px] font-semibold text-[var(--text-muted)]">{sub}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span
          className="tabular text-[10px] font-bold"
          style={{ color: deltaTone === "good" ? "var(--color-status-good)" : "var(--text-muted)" }}
        >
          {delta}
        </span>
        <div dir="ltr">
          <Sparkline values={series} color={color} width={86} height={26} />
        </div>
      </div>
    </div>
  );
}
