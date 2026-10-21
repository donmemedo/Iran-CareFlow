"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Bell,
  BrainCircuit,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Network,
  Search,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitch } from "@/components/locale-switch";
import { Avatar, Badge } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import { relativeTime } from "@/lib/format";
import type { Alert } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

const SEVERITY_TONE = {
  critical: "critical",
  serious: "serious",
  warning: "warning",
  good: "good",
} as const;

export function AppShell({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user, ready, signOut } = useSession();
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: alerts } = useApi<Alert[]>(user ? "/alerts" : null);

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, router, locale]);

  useEffect(() => {
    setNavOpen(false);
    setBellOpen(false);
  }, [pathname]);

  // IT sees aggregates only (the API enforces it with 403); do not offer screens that cannot load.
  const clinical = user?.role !== "it";
  const items = [
    { href: `/${locale}/app`, label: dict.app.nav.dashboard, icon: LayoutDashboard, exact: true },
    ...(clinical ? [{ href: `/${locale}/app/patients`, label: dict.app.nav.patients, icon: Users }] : []),
    { href: `/${locale}/app/pathways`, label: dict.app.nav.pathways, icon: Workflow },
    { href: `/${locale}/app/analytics`, label: dict.app.nav.analytics, icon: BrainCircuit },
    ...(clinical ? [{ href: `/${locale}/app/collaboration`, label: dict.app.nav.collaboration, icon: MessagesSquare }] : []),
    { href: `/${locale}/app/integrations`, label: dict.app.nav.integrations, icon: Network },
    { href: `/${locale}/app/settings`, label: dict.app.nav.settings, icon: Settings },
  ];

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex h-11 w-11 animate-pulse items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
            <Activity size={20} />
          </span>
          <p className="text-xs text-[var(--text-muted)]">{dict.common.loading}</p>
        </div>
      </div>
    );
  }

  const unacknowledged = (alerts ?? []).filter((alert) => !alert.acknowledged);

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(`/${locale}/app/patients${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`);
  }

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-[var(--border)] bg-[var(--page-veil)] lg:flex">
        <Link href={`/${locale}`} className="flex h-16 items-center gap-2.5 px-5 font-extrabold">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
            <Activity size={18} strokeWidth={2.6} />
          </span>
          <span className="text-sm">{dict.brand.name}</span>
        </Link>
        <NavList items={items} pathname={pathname} />
        <div className="mt-auto border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5 rounded-2xl p-2">
            <Avatar name={locale === "fa" ? user.name_fa : user.name_en} hue={user.avatar_hue} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{locale === "fa" ? user.name_fa : user.name_en}</p>
              <p className="truncate text-[10px] text-[var(--text-muted)]">
                {locale === "fa" ? user.title_fa : user.title_en}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label={dict.app.header.signOut}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--color-status-critical)]"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {navOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: locale === "fa" ? 280 : -280 }}
              animate={{ x: 0 }}
              exit={{ x: locale === "fa" ? 280 : -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-[var(--border)] bg-[var(--page-veil)] lg:hidden"
            >
              <div className="flex h-16 items-center gap-2.5 px-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
                  <Activity size={18} strokeWidth={2.6} />
                </span>
                <span className="text-sm font-extrabold">{dict.brand.name}</span>
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label={dict.common.close}
                  className="ms-auto inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--surface-2)]"
                >
                  <X size={17} />
                </button>
              </div>
              <NavList items={items} pathname={pathname} />
              <button
                type="button"
                onClick={signOut}
                className="m-3 mt-auto inline-flex items-center gap-2 rounded-2xl px-3 py-3 text-xs font-bold text-[var(--color-status-critical)] hover:bg-[var(--surface-2)]"
              >
                <LogOut size={15} />
                {dict.app.header.signOut}
              </button>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:ms-64">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label={dict.nav.menu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <form onSubmit={onSearch} className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[var(--text-muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dict.app.header.searchPlaceholder}
              aria-label={dict.common.search}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs outline-none transition focus:border-brand-500 sm:text-sm"
            />
          </form>

          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((v) => !v)}
                aria-label={dict.app.header.notifications}
                aria-expanded={bellOpen}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                <Bell size={17} />
                {unacknowledged.length ? (
                  <span className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-status-critical)] px-1 text-[9px] font-extrabold text-white">
                    {unacknowledged.length}
                  </span>
                ) : null}
              </button>

              <AnimatePresence>
                {bellOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    style={{ transformOrigin: locale === "fa" ? "top left" : "top right" }}
                    className="surface-card absolute end-0 top-12 z-50 max-h-96 w-80 overflow-auto rounded-2xl p-2"
                  >
                    {unacknowledged.length === 0 ? (
                      <p className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                        {dict.app.header.noAlerts}
                      </p>
                    ) : (
                      unacknowledged.map((alert) => (
                        <div key={alert.id} className="rounded-xl p-3 transition hover:bg-[var(--surface-2)]">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold">{locale === "fa" ? alert.title_fa : alert.title_en}</p>
                            <Badge tone={SEVERITY_TONE[alert.severity]}>
                              {locale === "fa" ? alert.department_fa : alert.department_en}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
                            {locale === "fa" ? alert.detail_fa : alert.detail_en}
                          </p>
                          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                            {relativeTime(alert.created_at, locale)}
                          </p>
                        </div>
                      ))
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="hidden sm:block">
              <LocaleSwitch locale={locale} compact />
            </div>
            <ThemeToggle dict={dict} compact />
            <Link href={`/${locale}/app/settings`} className="ms-0.5 hidden sm:inline-flex" aria-label={dict.app.header.account}>
              <Avatar name={locale === "fa" ? user.name_fa : user.name_en} hue={user.avatar_hue} size={38} />
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 pb-10 pt-4 sm:px-5 sm:pt-6">{children}</main>
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
}: {
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; exact?: boolean }[];
  pathname: string;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-xs font-bold transition",
              active
                ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
            )}
          >
            {active ? (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-y-2 start-0 w-1 rounded-full bg-linear-to-b from-brand-400 to-brand-600"
              />
            ) : null}
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
