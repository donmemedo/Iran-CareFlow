import { notFound } from "next/navigation";
import { PatientDetailView } from "@/components/app/patient-detail-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const patientId = Number(id);
  if (!Number.isFinite(patientId)) notFound();
  const locale: Locale = raw;
  return <PatientDetailView locale={locale} dict={getDictionary(locale)} patientId={patientId} />;
}
