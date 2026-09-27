import { notFound } from "next/navigation";
import { CollaborationView } from "@/components/app/collaboration-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function CollaborationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <CollaborationView locale={locale} dict={getDictionary(locale)} />;
}
