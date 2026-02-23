"use client";

import { NextIntlClientProvider } from "next-intl";
import { useSettingsStore } from "@/lib/store";
import type { Locale } from "./config";

import trMessages from "@/messages/tr.json";
import enMessages from "@/messages/en.json";

const messages: Record<Locale, Record<string, unknown>> = {
  tr: trMessages as Record<string, unknown>,
  en: enMessages as Record<string, unknown>,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSettingsStore((s) => s.locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}
