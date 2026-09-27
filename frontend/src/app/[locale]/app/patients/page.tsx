import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PatientsView } from "@/components/app/patients-view";
import { Skeleton } from "@/components/ui";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function PatientsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PatientsView locale={locale} dict={getDictionary(locale)} />
    </Suspense>
  );
}
