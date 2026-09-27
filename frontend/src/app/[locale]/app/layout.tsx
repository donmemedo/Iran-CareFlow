import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return (
    <>
      <PwaRegister />
      <AppShell locale={locale} dict={getDictionary(locale)}>
        {children}
      </AppShell>
    </>
  );
}
