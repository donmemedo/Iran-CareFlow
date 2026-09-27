import Link from "next/link";
import { Activity } from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", { year: "numeric" }).format(new Date());

  const columns = [
    {
      title: dict.footer.product,
      links: [
        { label: dict.nav.product, href: "#modules" },
        { label: dict.nav.analytics, href: "#analytics" },
        { label: dict.nav.pricing, href: "#pricing" },
        { label: dict.nav.roi, href: "#roi" },
      ],
    },
    {
      title: dict.footer.company,
      links: [
        { label: dict.footer.about, href: "#modules" },
        { label: dict.footer.careers, href: "#contact" },
        { label: dict.nav.contact, href: "#contact" },
      ],
    },
    {
      title: dict.footer.legal,
      links: [
        { label: dict.footer.privacy, href: "#security" },
        { label: dict.footer.terms, href: "#security" },
        { label: dict.footer.sla, href: "#pricing" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--page-veil)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href={`/${locale}`} className="inline-flex items-center gap-2.5 font-extrabold">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
                <Activity size={18} strokeWidth={2.6} />
              </span>
              {dict.brand.name}
            </Link>
            <p className="mt-4 max-w-xs text-xs leading-6 text-[var(--text-muted)]">{dict.footer.builtOn}</p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-3 text-xs font-bold">{column.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--border)] pt-6 text-[11px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {dict.brand.company} · {dict.footer.rights}
          </p>
          <p>{dict.brand.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
