import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Fingerprint,
  GitBranch,
  Hospital,
  KeyRound,
  Layers,
  Lock,
  MessagesSquare,
  Network,
  Radio,
  ScrollText,
  Workflow,
} from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Hero } from "@/components/site/hero";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { RoiCalculator } from "@/components/site/roi-calculator";
import { ContactForm } from "@/components/site/contact-form";
import { PwaRegister } from "@/components/pwa-register";
import { Badge, Card, LinkButton, SectionHeading } from "@/components/ui";
import { getDictionary, isLocale, type Locale } from "@/i18n";
import { notFound } from "next/navigation";

const MODULE_ICONS = [Workflow, MessagesSquare, BrainCircuit];
const PROBLEM_ICONS = [Clock3, MessagesSquare, AlertTriangle];
const TREND_ICONS = [Radio, BrainCircuit, Database, Network, FileCheck2];
const SECURITY_ICONS = [Hospital, KeyRound, Fingerprint, Lock];

const CONNECTORS = [
  { code: "HIS", name_fa: "سامانه اطلاعات بیمارستانی", name_en: "Hospital Information System", protocol: "HL7 v2.5" },
  { code: "LIS", name_fa: "سامانه آزمایشگاه", name_en: "Laboratory system", protocol: "HL7 / ASTM" },
  { code: "PACS", name_fa: "بایگانی تصویربرداری", name_en: "Imaging archive", protocol: "DICOM" },
  { code: "SEPAS", name_fa: "پرونده الکترونیک سلامت", name_en: "National health record", protocol: "SEPAS" },
  { code: "FHIR", name_fa: "لایه هم‌کنش‌پذیری", name_en: "Interoperability layer", protocol: "FHIR R4" },
  { code: "SMS", name_fa: "درگاه اعلان", name_en: "Notification gateway", protocol: "REST" },
];

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  return (
    <>
      <PwaRegister />
      <SiteNav locale={locale} dict={dict} />

      <main id="main">
        <Hero locale={locale} dict={dict} />

        {/* The problem ------------------------------------------------ */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Reveal>
            <SectionHeading title={dict.problem.title} subtitle={dict.problem.subtitle} />
          </Reveal>
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {dict.problem.items.map((item, index) => {
              const Icon = PROBLEM_ICONS[index];
              return (
                <StaggerItem key={item.title}>
                  <Card className="h-full p-6">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-status-serious)]/12 text-[var(--color-status-serious)]">
                      <Icon size={20} />
                    </span>
                    <h3 className="mt-4 text-base font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* Three pillars ---------------------------------------------- */}
        <section id="modules" className="relative scroll-mt-20 overflow-hidden py-16 sm:py-24">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--border-strong)] to-transparent" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading eyebrow={dict.nav.platform} title={dict.modules.title} subtitle={dict.modules.subtitle} />
            </Reveal>

            <Stagger className="mt-12 grid gap-6 lg:grid-cols-3">
              {dict.modules.items.map((item, index) => {
                const Icon = MODULE_ICONS[index];
                return (
                  <StaggerItem key={item.key} className="h-full">
                    <Card className="group relative h-full overflow-hidden p-6 sm:p-7 hover:shadow-[var(--shadow-lift)]">
                      <div
                        className="absolute -end-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                        style={{ background: `var(--color-series-${index + 1})`, opacity: 0.1 }}
                        aria-hidden="true"
                      />
                      <div className="relative">
                        <span
                          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_10px_26px_-12px_currentColor]"
                          style={{ background: `var(--color-series-${index === 0 ? 1 : index === 1 ? 3 : 7})` }}
                        >
                          <Icon size={22} />
                        </span>
                        <h3 className="mt-5 text-lg font-extrabold">{item.title}</h3>
                        <p className="mt-2.5 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
                        <ul className="mt-5 flex flex-col gap-2.5 border-t border-[var(--border)] pt-5">
                          {item.points.map((point) => (
                            <li key={point} className="flex items-start gap-2.5 text-xs leading-6 text-[var(--text-secondary)]">
                              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-500" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>

        {/* Trends ------------------------------------------------------ */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Reveal>
            <Card className="overflow-hidden p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
                <div>
                  <h3 className="text-lg font-extrabold sm:text-xl">{dict.trends.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{dict.trends.subtitle}</p>
                </div>
                <ul className="flex flex-wrap gap-2.5">
                  {dict.trends.items.map((trend, index) => {
                    const Icon = TREND_ICONS[index];
                    return (
                      <li key={trend}>
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-xs font-bold">
                          <Icon size={15} className="text-brand-500" />
                          {trend}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>
          </Reveal>
        </section>

        {/* Impact ------------------------------------------------------ */}
        <section id="analytics" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading title={dict.impact.title} subtitle={dict.impact.subtitle} />
            </Reveal>
            <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {dict.impact.items.map((item) => (
                <StaggerItem key={item.label}>
                  <Card className="h-full p-6">
                    <p className="text-3xl font-extrabold text-gradient sm:text-4xl">{item.value}</p>
                    <p className="mt-3 text-sm font-bold">{item.label}</p>
                    <p className="mt-1.5 text-xs leading-6 text-[var(--text-muted)]">{item.detail}</p>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Integrations ------------------------------------------------ */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Reveal>
            <SectionHeading eyebrow={dict.app.nav.integrations} title={dict.integrations.title} subtitle={dict.integrations.subtitle} />
          </Reveal>
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTORS.map((connector) => (
              <StaggerItem key={connector.code}>
                <Card className="flex h-full items-center gap-4 p-5">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-xs font-extrabold text-brand-600 dark:text-brand-300">
                    {connector.code}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{locale === "fa" ? connector.name_fa : connector.name_en}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{connector.protocol}</p>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.1}>
            <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[var(--text-muted)]">
              <GitBranch size={14} className="shrink-0 text-brand-500" />
              {dict.integrations.note}
            </p>
          </Reveal>
        </section>

        {/* Security ---------------------------------------------------- */}
        <section id="security" className="scroll-mt-20 bg-[var(--page-veil)] py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading eyebrow={dict.nav.security} title={dict.security.title} subtitle={dict.security.subtitle} />
            </Reveal>
            <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {dict.security.items.map((item, index) => {
                const Icon = SECURITY_ICONS[index];
                return (
                  <StaggerItem key={item.title}>
                    <Card className="h-full p-6">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                        <Icon size={19} />
                      </span>
                      <h3 className="mt-4 text-sm font-bold">{item.title}</h3>
                      <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{item.body}</p>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>

        {/* Rollout ----------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Reveal>
            <SectionHeading title={dict.rollout.title} subtitle={dict.rollout.subtitle} />
          </Reveal>
          <Stagger className="relative mt-12 grid gap-5 lg:grid-cols-4">
            <div className="absolute inset-x-0 top-[3.25rem] hidden h-px bg-linear-to-r from-transparent via-[var(--border-strong)] to-transparent lg:block" aria-hidden="true" />
            {dict.rollout.steps.map((step, index) => (
              <StaggerItem key={step.title}>
                <Card className="relative h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">
                      {new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(index + 1)}
                    </span>
                    <Badge tone="brand">{step.week}</Badge>
                  </div>
                  <h3 className="mt-4 text-sm font-bold">{step.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{step.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Pricing ----------------------------------------------------- */}
        <section id="pricing" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading eyebrow={dict.nav.pricing} title={dict.pricing.title} subtitle={dict.pricing.subtitle} />
            </Reveal>

            <Stagger className="mt-12 grid gap-6 lg:grid-cols-3">
              {dict.pricing.tiers.map((tier) => {
                const highlighted = "highlighted" in tier && tier.highlighted;
                return (
                  <StaggerItem key={tier.name} className="h-full">
                    <Card
                      className={`relative flex h-full flex-col p-6 sm:p-7 ${
                        highlighted ? "border-brand-500/45 shadow-[var(--shadow-lift)] lg:-translate-y-3" : ""
                      }`}
                    >
                      {highlighted ? (
                        <span className="absolute -top-3 start-6 rounded-full bg-linear-to-br from-brand-500 to-brand-700 px-3 py-1 text-[10px] font-extrabold text-white">
                          {dict.pricing.popular}
                        </span>
                      ) : null}
                      <h3 className="text-base font-extrabold">{tier.name}</h3>
                      <p className="mt-1.5 text-xs leading-6 text-[var(--text-muted)]">{tier.body}</p>
                      <div className="mt-5 flex items-baseline gap-1.5">
                        <span className="tabular text-3xl font-extrabold">{tier.price}</span>
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                          {dict.pricing.unit} · {tier.period}
                        </span>
                      </div>
                      <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-[var(--border)] pt-5">
                        {tier.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5 text-xs leading-6">
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <LinkButton
                        href="#contact"
                        variant={highlighted ? "primary" : "secondary"}
                        size="md"
                        className="mt-6 w-full"
                      >
                        {dict.pricing.cta}
                      </LinkButton>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>

            <Reveal delay={0.1}>
              <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[var(--text-muted)]">
                <Layers size={14} className="shrink-0 text-brand-500" />
                {dict.pricing.setupNote}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ROI --------------------------------------------------------- */}
        <section id="roi" className="scroll-mt-20 bg-[var(--page-veil)] py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading eyebrow={dict.nav.roi} title={dict.roi.title} subtitle={dict.roi.subtitle} />
            </Reveal>
            <div className="mt-12">
              <RoiCalculator locale={locale} dict={dict} />
            </div>
          </div>
        </section>

        {/* Contact ----------------------------------------------------- */}
        <section id="contact" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
              <Reveal>
                <div className="lg:sticky lg:top-28">
                  <SectionHeading align="start" title={dict.contact.title} subtitle={dict.contact.subtitle} />
                  <ul className="mt-8 flex flex-col gap-4">
                    {[
                      { icon: ScrollText, text: dict.rollout.steps[0].body },
                      { icon: Activity, text: dict.impact.items[0].detail },
                      { icon: Lock, text: dict.security.items[0].body },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-start gap-3 text-xs leading-6 text-[var(--text-secondary)]">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
                          <Icon size={14} />
                        </span>
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <ContactForm locale={locale} dict={dict} />
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
