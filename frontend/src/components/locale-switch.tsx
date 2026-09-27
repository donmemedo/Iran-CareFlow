"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { localeMeta, otherLocale, type Locale } from "@/i18n/config";

export function LocaleSwitch({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const pathname = usePathname() || `/${locale}`;
  const target = otherLocale(locale);
  const nextPath = pathname.replace(new RegExp(`^/${locale}`), `/${target}`) || `/${target}`;

  return (
    <Link
      href={nextPath}
      prefetch={false}
      aria-label={localeMeta[target].label}
      title={localeMeta[target].label}
      className={
        compact
          ? "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          : "inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      }
    >
      <Languages size={16} />
      {compact ? null : <span>{localeMeta[target].short}</span>}
    </Link>
  );
}
