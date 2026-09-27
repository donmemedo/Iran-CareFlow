import { notFound } from "next/navigation";
import { PathwaysView } from "@/components/app/pathways-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function PathwaysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <PathwaysView locale={locale} dict={getDictionary(locale)} />;
}
