"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWarehouses } from "./use-masterdata";
import { DEFAULT_HORIZON_DAYS, useUiStore } from "@/store/ui.store";

/**
 * Scope lives in the URL.
 *
 * `dc` carries a warehouse **id**. The alert links Phase 1 shipped already read
 * `?dc=` as an id and hand it straight to `warehouseId`, so that is the canonical
 * form. A hand-typed code (`?dc=DEL`) is resolved against the warehouse list rather
 * than rejected, because the URL contract in the architecture doc is written that way
 * and a link a human typed should still work.
 *
 * `useSearchParams` opts a route out of static rendering, so every page calling this
 * has to sit behind a Suspense boundary - see `app/alerts/page.tsx`.
 */
export interface Scope {
  /** Warehouse id, or undefined for the whole network. */
  dc?: string;
  /** The DC's display code, when it can be resolved. For labels, never for filters. */
  dcCode?: string;
  sku?: string;
  horizonDays: number;
  setDc: (dc?: string) => void;
  setSku: (sku?: string) => void;
  setHorizonDays: (days: number) => void;
  /** Carries the current scope onto a link. A bare `/forecast` is a bug. */
  withScope: (href: string, extra?: Record<string, string | undefined>) => string;
}

export function useScope(): Scope {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: warehouses } = useWarehouses();
  const setStoreScope = useUiStore((state) => state.setScope);

  const rawDc = params.get("dc") ?? undefined;
  const sku = params.get("sku") ?? undefined;

  const horizonParam = Number(params.get("horizon"));
  const horizonDays =
    Number.isFinite(horizonParam) && horizonParam > 0 ? horizonParam : DEFAULT_HORIZON_DAYS;

  // A code in the URL resolves to its id; an id passes through untouched. Unresolved
  // while the warehouse list is still loading, which is why this returns the raw value
  // rather than dropping it.
  const { dc, dcCode } = useMemo(() => {
    if (!rawDc) return { dc: undefined, dcCode: undefined };
    const match = warehouses?.find(
      (warehouse) =>
        warehouse.id === rawDc || warehouse.code.toLowerCase() === rawDc.toLowerCase(),
    );
    return { dc: match?.id ?? rawDc, dcCode: match?.code };
  }, [rawDc, warehouses]);

  useEffect(() => {
    setStoreScope({ dc, sku, horizonDays });
  }, [dc, sku, horizonDays, setStoreScope]);

  const write = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      // `replace`, not `push`: changing the DC you are looking at is not a navigation,
      // and pushing would make Back walk every selector change.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const withScope = useCallback(
    (href: string, extra?: Record<string, string | undefined>) => {
      const [path, existing] = href.split("?");
      const next = new URLSearchParams(existing ?? "");
      // Anything already on the href wins - a link that names its own SKU means it.
      if (dc && !next.has("dc")) next.set("dc", dc);
      if (sku && !next.has("sku")) next.set("sku", sku);
      for (const [key, value] of Object.entries(extra ?? {})) {
        if (value !== undefined && value !== "") next.set(key, value);
      }
      const query = next.toString();
      return query ? `${path}?${query}` : path;
    },
    [dc, sku],
  );

  return {
    dc,
    dcCode,
    sku,
    horizonDays,
    setDc: useCallback((value?: string) => write({ dc: value }), [write]),
    setSku: useCallback((value?: string) => write({ sku: value }), [write]),
    setHorizonDays: useCallback(
      (days: number) => write({ horizon: days === DEFAULT_HORIZON_DAYS ? undefined : String(days) }),
      [write],
    ),
    withScope,
  };
}

/**
 * `withScope` for components too deep to sit behind their own Suspense boundary.
 *
 * Reads the mirror in `ui.store` rather than `useSearchParams`, so it adds no static
 * rendering constraint. The navbar renders `ScopeSelectors` on every page and that
 * calls `useScope`, so the mirror is always current by the time this runs.
 */
export function useScopedHref() {
  const dc = useUiStore((state) => state.dc);
  const sku = useUiStore((state) => state.sku);

  return useCallback(
    (href: string, extra?: Record<string, string | undefined>) => {
      const [path, existing] = href.split("?");
      const next = new URLSearchParams(existing ?? "");
      if (dc && !next.has("dc")) next.set("dc", dc);
      if (sku && !next.has("sku")) next.set("sku", sku);
      for (const [key, value] of Object.entries(extra ?? {})) {
        if (value !== undefined && value !== "") next.set(key, value);
      }
      const query = next.toString();
      return query ? `${path}?${query}` : path;
    },
    [dc, sku],
  );
}
