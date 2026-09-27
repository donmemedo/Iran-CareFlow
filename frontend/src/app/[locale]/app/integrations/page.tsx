import { notFound } from "next/navigation";
import { IntegrationsView } from "@/components/app/integrations-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function IntegrationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <IntegrationsView locale={locale} dict={getDictionary(locale)} />;
}
