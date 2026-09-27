"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  className,
  children,
  as: Tag = "div",
  ...rest
}: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & ComponentProps<"div">) {
  return (
    <Tag
      className={clsx(
        "surface-card rounded-3xl transition-shadow duration-300",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-bold sm:text-lg">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-linear-to-br from-brand-500 to-brand-700 shadow-[0_10px_30px_-12px_var(--color-brand-600)] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
  ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
  danger: "text-white bg-[var(--color-status-critical)] hover:brightness-110",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-7 text-base rounded-2xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { variant?: ButtonVariant; size?: ButtonSize } & ComponentProps<"button">) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "active:scale-[0.98]",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; size?: ButtonSize } & ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.98]",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "good" | "warning" | "serious" | "critical";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]",
    brand: "bg-brand-500/12 text-brand-700 dark:text-brand-300 border-brand-500/25",
    good: "bg-[var(--color-status-good)]/12 text-[var(--color-status-good)] border-[var(--color-status-good)]/30",
    warning: "bg-[var(--color-status-warning)]/16 text-[#8a6100] dark:text-[var(--color-status-warning)] border-[var(--color-status-warning)]/35",
    serious: "bg-[var(--color-status-serious)]/16 text-[#a4451c] dark:text-[var(--color-status-serious)] border-[var(--color-status-serious)]/35",
    critical: "bg-[var(--color-status-critical)]/12 text-[var(--color-status-critical)] border-[var(--color-status-critical)]/30",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={clsx("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-start")}>
      {eyebrow ? (
        <span className="mb-3 inline-flex rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-700 dark:text-brand-300">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-2xl font-extrabold tracking-tight text-balance sm:text-3xl lg:text-4xl">{title}</h2>
      {subtitle ? (
        <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)] text-pretty sm:text-base sm:leading-8">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("relative overflow-hidden rounded-2xl bg-[var(--surface-2)]", className)}
      aria-hidden="true"
    >
      <div className="shine absolute inset-0 opacity-60" />
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-[var(--text-muted)]">{icon}</div> : null}
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="max-w-sm text-xs leading-6 text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function Avatar({ name, hue, size = 36 }: { name: string; hue: number; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.replace(/^(دکتر|Dr\.?)$/i, "").charAt(0))
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(140deg, hsl(${hue} 62% 52%), hsl(${(hue + 38) % 360} 58% 38%))`,
      }}
      aria-hidden="true"
    >
      {initials || "•"}
    </span>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "warning" | "critical" }) {
  const colors: Record<string, string> = {
    brand: "var(--color-brand-500)",
    warning: "var(--color-status-warning)",
    critical: "var(--color-status-critical)",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: colors[tone] }}
      />
    </div>
  );
}
