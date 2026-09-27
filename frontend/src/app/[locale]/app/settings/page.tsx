import { notFound } from "next/navigation";
import { SettingsView } from "@/components/app/settings-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <SettingsView locale={locale} dict={getDictionary(locale)} />;
}
