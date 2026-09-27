import { notFound } from "next/navigation";
import { AnalyticsView } from "@/components/app/analytics-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <AnalyticsView locale={locale} dict={getDictionary(locale)} />;
}
