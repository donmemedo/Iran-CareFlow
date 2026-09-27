import type { Locale } from "@/i18n/config";

/** Persian digits and the Jalali calendar come free from Intl - use it everywhere. */
export function formatNumber(value: number, locale: Locale, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", options).format(value);
}

export function formatDecimal(value: number, locale: Locale, digits = 1): string {
  return formatNumber(value, locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(value: number, locale: Locale, digits = 0): string {
  return `${formatNumber(value, locale, { maximumFractionDigits: digits })}${locale === "fa" ? "٪" : "%"}`;
}

export function formatCompact(value: number, locale: Locale): string {
  return formatNumber(value, locale, { notation: "compact", maximumFractionDigits: 1 });
}

/** Million IRT, the unit the business plan uses throughout. */
export function formatMoney(value: number, locale: Locale): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const billions = value / 1000;
    return locale === "fa"
      ? `${formatNumber(billions, locale, { maximumFractionDigits: 1 })} میلیارد تومان`
      : `${formatNumber(billions, locale, { maximumFractionDigits: 1 })}B IRT`;
  }
  return locale === "fa"
    ? `${formatNumber(value, locale, { maximumFractionDigits: 0 })} میلیون تومان`
    : `${formatNumber(value, locale, { maximumFractionDigits: 0 })}M IRT`;
}

export function formatDate(value: string | Date, locale: Locale, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === "string" ? new Date(ensureUtc(value)) : value;
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", {
    day: "numeric",
    month: "short",
    ...options,
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  return formatDate(value, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatWeekday(value: string | Date, locale: Locale): string {
  return formatDate(value, locale, { weekday: "short", day: "numeric", month: undefined });
}

/** Durations read better as "3 روز و 4 ساعت" than as a raw hour count. */
export function formatDuration(hours: number, locale: Locale): string {
  const wholeDays = Math.floor(hours / 24);
  const restHours = Math.round(hours % 24);
  if (wholeDays <= 0) {
    return locale === "fa" ? `${formatNumber(restHours, locale)} ساعت` : `${restHours}h`;
  }
  return locale === "fa"
    ? `${formatNumber(wholeDays, locale)} روز و ${formatNumber(restHours, locale)} ساعت`
    : `${wholeDays}d ${restHours}h`;
}

export function formatMinutes(minutes: number, locale: Locale): string {
  if (minutes < 60) return locale === "fa" ? `${formatNumber(Math.round(minutes), locale)} دقیقه` : `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return locale === "fa"
    ? `${formatNumber(hours, locale)} ساعت و ${formatNumber(rest, locale)} دقیقه`
    : `${hours}h ${rest}m`;
}

export function relativeTime(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(ensureUtc(value)) : value;
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "fa" ? "fa-IR" : "en", { numeric: "auto" });
  const absolute = Math.abs(diffMinutes);
  if (absolute < 60) return rtf.format(diffMinutes, "minute");
  if (absolute < 60 * 24) return rtf.format(Math.round(diffMinutes / 60), "hour");
  return rtf.format(Math.round(diffMinutes / 1440), "day");
}

/** The API returns naive UTC timestamps; tell the browser so. */
function ensureUtc(value: string): string {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return hasZone || !value.includes("T") ? value : `${value}Z`;
}

const PERSIAN_DIGITS = ["\u06f0", "\u06f1", "\u06f2", "\u06f3", "\u06f4", "\u06f5", "\u06f6", "\u06f7", "\u06f8", "\u06f9"];

/**
 * The API composes a few human sentences server-side (ROI details, assumptions)
 * with Latin digits. Rendering those beside Intl-formatted Persian numerals looks
 * broken, so localise the digits and separators at the edge.
 */
export function localizeDigits(text: string, locale: Locale): string {
  if (locale !== "fa") return text;
  return text
    .replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])
    .replace(/,/g, "\u066c")
    .replace(/%/g, "\u066a")
    .replace(/\./g, "\u066b");
}
