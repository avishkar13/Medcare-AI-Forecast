/**
 * Money as text, in the currency the workspace is configured for.
 *
 * Alerts store prose - `businessImpact`, `explanation`, and the metric values are
 * sentences and figures written at detection time, not numbers the client formats.
 * That means the currency symbol is chosen *here*, and a hardcoded `$` produced
 * "$3,962 of stock is projected to be written off" on a workspace whose configured
 * currency was INR, on an Indian distribution network.
 *
 * The frontend already resolves the same setting for the values it formats itself
 * (`hooks/use-formatters.ts`), so this is the server half of one decision rather than
 * a second, competing one.
 */

/** Grouping conventions that differ from the western default, keyed by currency. */
const LOCALE_BY_CURRENCY: Record<string, string> = {
  // Lakh and crore grouping: 4902600 reads as 49,02,600 rather than 4,902,600.
  INR: "en-IN",
};

/**
 * The stored setting is a display label - `"INR (₹)"`, `"USD ($)"` - so the code is
 * the first token. Falls back to USD, matching what the frontend does with the same
 * value, so the two never disagree about an unparseable setting.
 */
export const currencyCodeOf = (setting: string | null | undefined): string => {
  const code = setting?.trim().split(/\s+/)[0]?.toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : "USD";
};

export type MoneyFormatter = (value: number) => string;

export const moneyFormatter = (setting: string | null | undefined): MoneyFormatter => {
  const currency = currencyCodeOf(setting);
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US";

  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
  } catch {
    // An unknown ISO code throws rather than degrading. A detection cycle must not
    // fail over a settings typo, so fall back to the plain number.
    return (value: number) => Math.round(value).toLocaleString(locale);
  }

  return (value: number) => format.format(Math.round(value));
};
