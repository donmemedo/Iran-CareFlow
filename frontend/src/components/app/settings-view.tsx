"use client";

import { useEffect, useState } from "react";
import { Download, Globe2, Palette, UserRound } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader } from "@/components/ui";
import { PageHeader } from "./page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitch } from "@/components/locale-switch";
import { useSession } from "@/lib/session";
import { localeMeta, otherLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function SettingsView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { user } = useSession();
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title={dict.app.settings.title} subtitle={dict.app.settings.subtitle} />

      <div className="flex flex-col gap-5">
        {user ? (
          <Card>
            <CardHeader title={dict.app.settings.account} />
            <div className="flex flex-wrap items-center gap-4 px-5 pb-6">
              <Avatar name={locale === "fa" ? user.name_fa : user.name_en} hue={user.avatar_hue} size={56} />
              <div className="min-w-0">
                <p className="text-sm font-bold">{locale === "fa" ? user.name_fa : user.name_en}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]" dir="ltr">
                  {user.email}
                </p>
              </div>
              <Badge tone="brand" className="ms-auto">
                <UserRound size={12} />
                {dict.app.settings.roles[user.role]}
              </Badge>
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Palette size={16} className="text-brand-500" />
                {dict.app.settings.appearance}
              </span>
            }
            subtitle={dict.app.settings.appearanceBody}
          />
          <div className="px-5 pb-6">
            <ThemeToggle dict={dict} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Globe2 size={16} className="text-brand-500" />
                {dict.app.settings.language}
              </span>
            }
            subtitle={dict.app.settings.languageBody}
          />
          <div className="flex items-center gap-3 px-5 pb-6">
            <Badge tone="brand">{localeMeta[locale].label}</Badge>
            <span className="text-xs text-[var(--text-muted)]">→</span>
            <LocaleSwitch locale={locale} />
            <span className="text-xs text-[var(--text-muted)]">{localeMeta[otherLocale(locale)].label}</span>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Download size={16} className="text-brand-500" />
                {dict.app.settings.installTitle}
              </span>
            }
            subtitle={dict.app.settings.installBody}
          />
          <div className="px-5 pb-6">
            {installed ? (
              <Badge tone="good">{dict.app.settings.installed}</Badge>
            ) : installEvent ? (
              <Button
                size="md"
                onClick={async () => {
                  await installEvent.prompt();
                  const choice = await installEvent.userChoice;
                  if (choice.outcome === "accepted") setInstalled(true);
                  setInstallEvent(null);
                }}
              >
                <Download size={15} />
                {dict.app.settings.install}
              </Button>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">{dict.app.settings.unavailable}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
