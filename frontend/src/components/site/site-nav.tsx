"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion, useScroll, useSpring } from "motion/react";
import { Activity, ArrowLeft, ArrowRight, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitch } from "@/components/locale-switch";
import { LinkButton } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export function SiteNav({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "#modules", label: dict.nav.product },
    { href: "#analytics", label: dict.nav.analytics },
    { href: "#security", label: dict.nav.security },
    { href: "#pricing", label: dict.nav.pricing },
    { href: "#roi", label: dict.nav.roi },
  ];

  return (
    <>
      <header
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "glass shadow-[var(--shadow-soft)]" : "bg-transparent",
        )}
      >
        <motion.div
          className="absolute inset-x-0 bottom-0 h-px origin-[0%] bg-linear-to-r from-brand-500 via-[var(--color-series-1)] to-[#7a5ce7]"
          style={{ scaleX: progress }}
        />
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-18 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 font-extrabold">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-8px_var(--color-brand-600)]">
              <Activity size={18} strokeWidth={2.6} />
            </span>
            <span className="text-sm sm:text-base">{dict.brand.name}</span>
          </Link>

          <ul className="mx-auto hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <div className="hidden sm:block">
              <LocaleSwitch locale={locale} />
            </div>
            <ThemeToggle dict={dict} compact />
            <LinkButton href={`/${locale}/login`} variant="secondary" size="sm" className="hidden sm:inline-flex">
              {dict.nav.signIn}
            </LinkButton>
            <LinkButton href="#contact" size="sm" className="hidden md:inline-flex">
              {dict.nav.contact}
              <Arrow size={15} />
            </LinkButton>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={dict.nav.menu}
              aria-expanded={open}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:hidden"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
      </header>

      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 top-16 z-40 bg-[var(--page)]/97 backdrop-blur-xl lg:hidden"
        >
          <div className="flex flex-col gap-1 p-5">
            {links.map((link, index) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl px-4 py-3.5 text-base font-bold hover:bg-[var(--surface-2)]"
              >
                {link.label}
              </motion.a>
            ))}
            <div className="mt-4 flex items-center gap-2">
              <LocaleSwitch locale={locale} />
              <LinkButton href={`/${locale}/login`} variant="secondary" size="md" className="flex-1">
                {dict.nav.signIn}
              </LinkButton>
            </div>
            <LinkButton href="#contact" size="lg" className="mt-2" onClick={() => setOpen(false)}>
              {dict.nav.contact}
            </LinkButton>
          </div>
        </motion.div>
      ) : null}
    </>
  );
}
