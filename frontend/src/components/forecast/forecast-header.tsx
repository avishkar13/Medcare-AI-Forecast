"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryKeys } from "@/config/query-keys";
import { useForecastKpi } from "@/hooks/use-forecast";
import { useForecastScope } from "@/store/filters.store";
import { useScope } from "@/hooks/use-scope";

const HORIZONS = [7, 14, 30, 90];

export function ForecastHeader() {
  const client = useQueryClient();
  const scope = useForecastScope();
  // Writes the horizon to the URL, which is what every forecast panel reads. It used
  // to write to a store copy the URL always won over, so the control was inert.
  const { setHorizonDays } = useScope();
  const kpi = useForecastKpi(scope);

  const handleRefresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.forecast.all });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Demand Forecast</h1>
        <p className="text-muted-foreground mt-1">AI-powered demand prediction across products and distribution centers.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(scope.days)}
          onValueChange={(value) => value && setHorizonDays(Number(value))}
        >
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue placeholder="Horizon" />
          </SelectTrigger>
          <SelectContent>
            {HORIZONS.map((days) => (
              <SelectItem key={days} value={String(days)}>{days} Days</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
          <RefreshCw className={`mr-2 h-4 w-4 ${kpi.isFetching ? "animate-spin" : ""}`} />
          Refresh Forecast
        </Button>

        <div className="hidden md:flex items-center text-xs text-muted-foreground ml-2">
          <Clock className="mr-1.5 h-3.5 w-3.5" />
          {kpi.dataUpdatedAt
            ? `Updated ${new Date(kpi.dataUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : "Not loaded"}
        </div>
      </div>
    </div>
  );
}
