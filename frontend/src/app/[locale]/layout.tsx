import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Providers } from "@/components/providers";
import { getDictionary, isLocale, locales, localeMeta, type Locale } from "@/i18n";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const active: Locale = isLocale(locale) ? locale : "fa";
  const dict = getDictionary(active);
  const title = `${dict.brand.name} — ${dict.brand.tagline}`;

  return {
    title: { default: title, template: `%s · ${dict.brand.name}` },
    description: dict.hero.subtitle,
    applicationName: dict.brand.name,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: dict.brand.name, statusBarStyle: "black-translucent" },
    icons: { icon: "/icon.svg", apple: "/icon-192.png" },
    alternates: {
      languages: { fa: "/fa", en: "/en" },
    },
    openGraph: {
      title,
      description: dict.hero.subtitle,
      locale: localeMeta[active].htmlLang,
      type: "website",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#070a0e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const meta = localeMeta[locale];

  return (
    <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
