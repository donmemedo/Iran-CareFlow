"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import type { Dictionary } from "@/i18n";

export function ThemeToggle({ dict, compact = false }: { dict: Dictionary; compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", icon: Sun, label: dict.nav.themeLight },
    { value: "dark", icon: Moon, label: dict.nav.themeDark },
    { value: "system", icon: Monitor, label: dict.nav.themeSystem },
  ] as const;

  if (compact) {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={dict.nav.theme}
        title={dict.nav.theme}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      >
        {mounted && resolvedTheme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={dict.nav.theme}
      className="inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition",
              active
                ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
