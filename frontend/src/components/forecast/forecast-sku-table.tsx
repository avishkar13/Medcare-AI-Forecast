"use client";

import { useState, useMemo } from "react";
// import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForecastSkus } from "@/hooks/use-forecast";
import { Search, TrendingUp, TrendingDown, Minus, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
// import { useScopedHref } from "@/hooks/use-scope";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";
import { SkuDetailDrawer } from "@/components/inventory/sku-detail-drawer";
import { useForecastScope } from "@/store/filters.store";

/**
 * Risk, in one place.
 *
 * The filter offered `"Critical"` while the rows carried `"critical"`, so the filter
 * matched nothing and `getRiskBadge` fell through to `null` - the Risk column rendered
 * empty for every row. Deriving both the options and the badge from one map is what
 * stops them drifting apart again.
 */
const RISK = {
  critical: { label: "Critical", className: "bg-destructive/10 text-destructive" },
  high: { label: "High", className: "bg-warning/20 text-warning" },
  low: { label: "Low", className: "bg-success/20 text-success" },
} as const;

type Risk = keyof typeof RISK;

/** Above this, demand is moving enough to call it a direction rather than noise. */
const TREND_BAND_PERCENT = 5;

const TREND = {
  rising: { label: "Rising", icon: TrendingUp, className: "text-destructive" },
  stable: { label: "Stable", icon: Minus, className: "text-muted-foreground" },
  falling: { label: "Falling", icon: TrendingDown, className: "text-ai" },
} as const;

type Trend = keyof typeof TREND;

const riskOf = (criticality: string): Risk =>
  criticality === "CRITICAL" ? "critical" : criticality === "HIGH" ? "high" : "low";

export function ForecastSkuTable() {
  const scope = useForecastScope();
  const { formatNumber } = useFormatters();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [trend, setTrend] = useState<string | undefined>(undefined);
  const [risk, setRisk] = useState<string | undefined>(undefined);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const { data, isPending, isError } = useForecastSkus(scope);

  /**
   * Baseline, growth and trend are **derived from the response**, not invented.
   *
   * These four columns used to be hardcoded zeros with a comment admitting the API did
   * not break them out per SKU - a column of zeros reads as data, which is worse than
   * no column. `averageDailyDemand` over the same `forecastDays` window is a real
   * baseline, so the comparison against `forecastDemand` is a real number.
   *
   * Per-SKU accuracy and confidence genuinely are not available, so those two columns
   * are gone rather than shown as zero. `/forecast/performance` carries accuracy for
   * the model as a whole and the page already renders it.
   */
  const items = useMemo(
    () =>
      (data?.items ?? []).map((row) => {
        const baseline =
          row.averageDailyDemand === null ? null : row.averageDailyDemand * row.forecastDays;

        const growth =
          baseline === null || baseline === 0
            ? null
            : ((row.forecastDemand - baseline) / baseline) * 100;

        const direction: Trend =
          growth === null || Math.abs(growth) < TREND_BAND_PERCENT
            ? "stable"
            : growth > 0
              ? "rising"
              : "falling";

        return {
          id: row.sku,
          product: row.name,
          category: row.category,
          baseline,
          forecastDemand: row.forecastDemand,
          growth,
          trend: direction,
          risk: riskOf(row.criticality),
        };
      }),
    [data],
  );

  // Built from what came back, so an option can never name a category the data does
  // not contain - the hardcoded list had drifted from the seeded catalogue.
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort() as string[],
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const needle = search.toLowerCase();
        const matchSearch =
          !search ||
          item.product.toLowerCase().includes(needle) ||
          item.id.toLowerCase().includes(needle);
        return (
          matchSearch &&
          (category === undefined || item.category === category) &&
          (trend === undefined || item.trend === trend) &&
          (risk === undefined || item.risk === risk)
        );
      }),
    [items, search, category, trend, risk],
  );

  if (isPending) return null;
  if (isError) return <QueryError label="the SKU forecast" />;

  const resetFilters = () => {
    setSearch("");
    setCategory(undefined);
    setTrend(undefined);
    setRisk(undefined);
  };

  const isFiltered = Boolean(search) || category !== undefined || trend !== undefined || risk !== undefined;

  return (
    <>
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Forecast by SKU</CardTitle>
        <CardDescription>
          Predicted demand over the next {scope.days} days against each item&apos;s recent
          average. Select a row to open its stock position.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={category || undefined} onValueChange={(val) => setCategory(val === "all" ? undefined : val as string)}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={trend || undefined} onValueChange={(val) => setTrend(val === "all" ? undefined : val as string)}>
              <SelectTrigger className="w-[120px] bg-background">
                <SelectValue placeholder="All Trends" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trends</SelectItem>
                {Object.entries(TREND).map(([key, entry]) => (
                  <SelectItem key={key} value={key}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={risk || undefined} onValueChange={(val) => setRisk(val === "all" ? undefined : val as string)}>
              <SelectTrigger className="w-[120px] bg-background">
                <SelectValue placeholder="All Risks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                {Object.entries(RISK).map(([key, entry]) => (
                  <SelectItem key={key} value={key}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={resetFilters}
                title="Reset filters"
              >
                <FilterX className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Product / SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Recent average</TableHead>
                <TableHead className="text-right">Forecast demand</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-center">Trend</TableHead>
                <TableHead className="text-center">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No matching products found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const TrendIcon = TREND[item.trend].icon;

                  return (
                    <TableRow
                      key={item.id}
                      // The row advertised itself with a hover and did nothing. Its
                      // stock position is what a reader wants next from a forecast.
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedSku(item.id)}
                    >
                      <TableCell>
                        <p className="font-medium">{item.product}</p>
                        <p className="text-xs text-muted-foreground">{item.id}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.category ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {item.baseline === null ? "—" : formatNumber(Math.round(item.baseline))}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-ai">
                        {formatNumber(Math.round(item.forecastDemand))}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-sm font-medium tabular-nums ${
                            item.growth === null
                              ? "text-muted-foreground"
                              : item.growth > 0
                                ? "text-destructive"
                                : item.growth < 0
                                  ? "text-ai"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {item.growth === null
                            ? "—"
                            : `${item.growth > 0 ? "+" : ""}${item.growth.toFixed(1)}%`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center" title={TREND[item.trend].label}>
                          <TrendIcon className={`h-4 w-4 ${TREND[item.trend].className}`} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${RISK[item.risk].className}`}
                        >
                          {RISK[item.risk].label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <SkuDetailDrawer
      skuId={selectedSku}
      isOpen={selectedSku !== null}
      onClose={() => setSelectedSku(null)}
    />
    </>
  );
}
