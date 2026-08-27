import { create } from "zustand";

/**
 * Scope, mirrored out of the URL.
 *
 * The URL is the source of truth - `hooks/use-scope.ts` writes here after reading
 * `useSearchParams`, so a deep link and a click produce the same state and a scoped
 * view is shareable. This store exists for components too deep to want the hook and
 * for the parts of the app that render outside a Suspense boundary.
 *
 * Never mirror the other way. A component that sets scope here without touching the
 * URL produces a view that cannot be linked to, which is the thing Phase 2 fixes.
 */
interface UiState {
  /** Warehouse **id**, not code. Undefined means the whole network. */
  dc?: string;
  sku?: string;
  /** Forecast/planning horizon in days, shared by every page that shows one. */
  horizonDays: number;
  setScope: (patch: Partial<Pick<UiState, "dc" | "sku" | "horizonDays">>) => void;
}

export const DEFAULT_HORIZON_DAYS = 14;

export const useUiStore = create<UiState>((set) => ({
  dc: undefined,
  sku: undefined,
  horizonDays: DEFAULT_HORIZON_DAYS,
  setScope: (patch) => set((state) => ({ ...state, ...patch })),
}));
