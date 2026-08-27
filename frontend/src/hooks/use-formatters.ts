"use client";

import { useSettings } from "./use-settings";
import { format } from "date-fns";

export function useFormatters() {
  const { data: settings } = useSettings();

  const general = settings?.general;

  const currencyCode = (() => {
    if (!general?.currency) return "USD";
    return general.currency.split(" ")[0]; // "USD ($)" -> "USD"
  })();

  /**
   * Grouping follows the currency, not the browser.
   *
   * `en-US` renders INR as ₹4,902,600. India groups in lakh and crore, so the same
   * figure reads ₹49,02,600 - which is what `utils/currency.ts` produces on the
   * server for the text baked into alerts. Formatting the two halves differently
   * puts two spellings of the same amount on one screen.
   */
  const currencyLocale = ({ INR: "en-IN" } as Record<string, string>)[currencyCode] ?? "en-US";

  const timezone = (() => {
    if (!general?.timezone) return undefined;
    return general.timezone.split(" ")[0]; // "Asia/Kolkata (IST)" -> "Asia/Kolkata"
  })();

  const dateFormat = general?.dateFormat || "MM/DD/YYYY";

  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null) return "—";
    return new Intl.NumberFormat(currencyLocale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  };

  const formatCompactCurrency = (value: number | null | undefined): string => {
    if (value == null) return "—";
    
    const formatter = new Intl.NumberFormat(currencyLocale, {
      style: "currency",
      currency: currencyCode,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    
    return formatter.format(value);
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value == null) return "—";
    return value.toLocaleString("en-US");
  };

  const formatDate = (date: Date | string | number | null | undefined): string => {
    if (!date) return "—";
    
    const dateObj = new Date(date);
    
    // date-fns format tokens:
    // MM/DD/YYYY -> MM/dd/yyyy
    // DD/MM/YYYY -> dd/MM/yyyy
    // YYYY-MM-DD -> yyyy-MM-dd
    // DD MMM YYYY -> dd MMM yyyy
    let fnsFormat = "MM/dd/yyyy";
    if (dateFormat === "DD/MM/YYYY") fnsFormat = "dd/MM/yyyy";
    else if (dateFormat === "YYYY-MM-DD") fnsFormat = "yyyy-MM-dd";
    else if (dateFormat === "DD MMM YYYY") fnsFormat = "dd MMM yyyy";

    try {
      return format(dateObj, fnsFormat);
    } catch {
      return "—";
    }
  };

  return {
    formatCurrency,
    formatCompactCurrency,
    formatNumber,
    formatDate,
    timezone,
  };
}
