import { create } from "zustand";

// runId, sku, warehouse and date range scope almost every backend route and are
// shared across pages. react query owns server state, this owns the selection.
interface ForecastScope {
  sku?: string;
  warehouse?: string;
  category?: string;
  days: number;
}

interface FiltersState {
  forecast: ForecastScope;
  setForecastScope: (patch: Partial<ForecastScope>) => void;
  resetForecastScope: () => void;
}

const DEFAULT_FORECAST: ForecastScope = { days: 14 };

export const useFiltersStore = create<FiltersState>((set) => ({
  forecast: DEFAULT_FORECAST,
  setForecastScope: (patch) =>
    set((state) => ({ forecast: { ...state.forecast, ...patch } })),
  resetForecastScope: () => set({ forecast: DEFAULT_FORECAST }),
}));

// the api takes sku, warehouse and days. category only narrows the sku list here, so
// it is deliberately left out of what goes over the wire.
export const useForecastScope = () => {
  const { sku, warehouse, days } = useFiltersStore((state) => state.forecast);
  return { sku, warehouse, days };
};
