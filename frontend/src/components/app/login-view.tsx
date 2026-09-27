"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Activity, ArrowLeft, ArrowRight, KeyRound, Loader2, Mail } from "lucide-react";
import { Avatar, Button, Card } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitch } from "@/components/locale-switch";
import { login, type ApiUser } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useSession } from "@/lib/session";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export function LoginView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("manager@careflow.ir");
  const [password, setPassword] = useState("careflow");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { data: demoUsers } = useApi<ApiUser[]>("/auth/demo-users");
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await login(email.trim(), password);
      refresh();
      router.push(`/${locale}/app`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="relative z-10 flex h-16 items-center gap-2 px-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 text-sm font-extrabold">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
            <Activity size={18} strokeWidth={2.6} />
          </span>
          {dict.brand.name}
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitch locale={locale} compact />
          <ThemeToggle dict={dict} compact />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 sm:px-6">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{dict.auth.title}</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{dict.auth.subtitle}</p>

            <p className="mt-8 mb-3 text-xs font-bold text-[var(--text-muted)]">{dict.auth.demoUsers}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(demoUsers ?? []).map((demo) => {
                const selected = email === demo.email;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword("careflow");
                      setError(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 text-start transition ${
                      selected
                        ? "border-brand-500/50 bg-brand-500/8"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <Avatar name={locale === "fa" ? demo.name_fa : demo.name_en} hue={demo.avatar_hue} size={34} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">
                        {locale === "fa" ? demo.name_fa : demo.name_en}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--text-muted)]">
                        {locale === "fa" ? demo.title_fa : demo.title_en}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-muted)]">{dict.auth.demoHint}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="p-6 sm:p-8">
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    {dict.auth.email}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[var(--text-muted)]" />
                    <input
                      id="login-email"
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] ps-9 pe-3 text-sm outline-none transition focus:border-brand-500 focus:bg-[var(--surface)]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    {dict.auth.password}
                  </label>
                  <div className="relative">
                    <KeyRound size={15} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[var(--text-muted)]" />
                    <input
                      id="login-password"
                      type="password"
                      dir="ltr"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] ps-9 pe-3 text-sm outline-none transition focus:border-brand-500 focus:bg-[var(--surface)]"
                    />
                  </div>
                </div>

                {error ? (
                  <p className="rounded-xl bg-[var(--color-status-critical)]/10 px-3 py-2.5 text-xs font-semibold text-[var(--color-status-critical)]">
                    {dict.auth.error}
                  </p>
                ) : null}

                <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
                  {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                  {busy ? dict.auth.submitting : dict.auth.submit}
                  {busy ? null : <Arrow size={16} />}
                </Button>

                <p className="text-center text-[11px] text-[var(--text-muted)]">{dict.auth.passwordHint}</p>
              </form>
            </Card>

            <Link
              href={`/${locale}`}
              className="mt-5 block text-center text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            >
              {dict.auth.backHome}
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
