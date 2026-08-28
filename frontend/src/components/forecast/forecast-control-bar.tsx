"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, BrainCircuit } from "lucide-react";
import { useProducts, useWarehouses } from "@/hooks/use-masterdata";
import { useModelMetrics } from "@/hooks/use-models";
import { useFiltersStore } from "@/store/filters.store";
import { useScope } from "@/hooks/use-scope";

export function ForecastControlBar() {
  const { data: products } = useProducts();
  const { data: warehouses } = useWarehouses();
  const { data: metrics } = useModelMetrics();
  const { dc } = useScope();

  const scope = useFiltersStore((state) => state.forecast);
  const setScope = useFiltersStore((state) => state.setForecastScope);
  const resetScope = useFiltersStore((state) => state.resetForecastScope);

  const categories = useMemo(
    () => [...new Set((products ?? []).map((product) => product.category))].sort(),
    [products],
  );

  // the category select narrows this list rather than going to the api, which scopes
  // by sku and warehouse only
  const visibleProducts = useMemo(
    () =>
      (products ?? []).filter(
        (product) => !scope.category || product.category === scope.category,
      ),
    [products, scope.category],
  );

  return (
    <Card>
      <CardContent className="p-4 flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <span className="text-sm font-medium hidden sm:block mr-2">Filters:</span>
          </div>

          <Select
            value={scope.sku || undefined}
            onValueChange={(value) =>
              setScope({ sku: !value || value === "all" ? undefined : value })
            }
          >
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {visibleProducts.map((product) => (
                <SelectItem key={product.sku} value={product.sku}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={scope.category || undefined}
            onValueChange={(value) =>
              setScope({ category: !value || value === "all" ? undefined : value, sku: undefined })
            }
          >
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/*
            Emits the warehouse **id**, not its code: `useForecastScope` resolves this
            against `?dc=`, which carries an id, so the two halves of that precedence
            rule were comparing different value spaces and never agreed.
          */}
          <Select
            value={dc || scope.warehouse || undefined}
            onValueChange={(value) =>
              setScope({ warehouse: !value || value === "all" ? undefined : value })
            }
            disabled={Boolean(dc)}
          >
            <SelectTrigger
              className="w-[190px] h-9"
              title={dc ? "Scoped by the DC selector in the top bar" : undefined}
            >
              <SelectValue placeholder="All DCs (Network)" />
            </SelectTrigger>
            <SelectContent>
              {!dc && <SelectItem value="all">All DCs (Network)</SelectItem>}
              {(warehouses ?? [])
                .filter((w) => !dc || w.id === dc)
                .map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-border">
          <span className="text-sm font-medium hidden lg:block text-muted-foreground mr-1">Model:</span>
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-ai/30 bg-ai/5 text-ai font-medium text-sm">
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>{metrics?.model_version ?? "Not trained"}</span>
          </div>
          <Button size="sm" variant="outline" className="h-9 w-full md:w-auto" onClick={resetScope}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
