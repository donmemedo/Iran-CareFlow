import { en } from "./en";
import { fa, type Dictionary } from "./fa";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { fa, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.fa;
}

export type { Dictionary };
export * from "./config";
