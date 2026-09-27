"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "@/lib/session";
import type { Locale } from "@/i18n/config";

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider locale={locale}>{children}</SessionProvider>
    </ThemeProvider>
  );
}
