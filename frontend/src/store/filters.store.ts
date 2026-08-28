import { create } from "zustand";
import { useUiStore } from "./ui.store";

// runId, sku, warehouse and date range scope almost every backend route and are
// shared across pages. react query owns server state, this owns the selection.
interface ForecastScope {
  sku?: string;
  warehouse?: string;
  category?: string;
}

interface FiltersState {
  forecast: ForecastScope;
  setForecastScope: (patch: Partial<ForecastScope>) => void;
  resetForecastScope: () => void;
}

const DEFAULT_FORECAST: ForecastScope = {};

export const useFiltersStore = create<FiltersState>((set) => ({
  forecast: DEFAULT_FORECAST,
  setForecastScope: (patch) =>
    set((state) => ({ forecast: { ...state.forecast, ...patch } })),
  resetForecastScope: () => set({ forecast: DEFAULT_FORECAST }),
}));

/**
 * What the forecast panels actually send to the API.
 *
 * The api takes sku, warehouse and days. category only narrows the sku list here, so
 * it is deliberately left out of what goes over the wire.
 *
 * **The URL wins.** `?dc=` and `?sku=` are the app-wide scope set in the top bar, and
 * this is the one seam every forecast panel reads - overriding here scopes all eleven
 * of them at once, and stops the page contradicting the DC named in the top bar. The
 * page's own pickers still work: they apply wherever the URL says nothing.
 */
export const useForecastScope = () => {
  const { sku, warehouse } = useFiltersStore((state) => state.forecast);
  const urlDc = useUiStore((state) => state.dc);
  const urlSku = useUiStore((state) => state.sku);
  /**
   * The horizon has exactly one owner: the URL.
   *
   * This used to read `urlHorizon ?? days` against a store copy - but `horizonDays` is
   * initialised to a default and is therefore *never* undefined, so the `??` could not
   * fall through and the page's own horizon selector silently changed nothing. Rather
   * than invent a "the URL really meant it" signal, the duplicate was removed: the
   * selector now writes to the URL like every other scope control.
   */
  const horizonDays = useUiStore((state) => state.horizonDays);

  return {
    sku: urlSku ?? sku,
    warehouse: urlDc ?? warehouse,
    days: horizonDays,
  };
};
