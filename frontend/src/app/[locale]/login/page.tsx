import { notFound } from "next/navigation";
import { LoginView } from "@/components/app/login-view";
import { getDictionary, isLocale, type Locale } from "@/i18n";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  return <LoginView locale={locale} dict={getDictionary(locale)} />;
}
