import { notFound } from "next/navigation";
import { DashboardView } from "@/components/app/dashboard-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <DashboardView locale={locale} dict={getDictionary(locale)} />;
}
