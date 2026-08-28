"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForecastKpi, useForecastPerformance } from "@/hooks/use-forecast";
import { Target, CheckCircle2 } from "lucide-react";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastPerformance() {
  const scope = useForecastScope();
  const { data, isPending, isError } = useForecastPerformance(scope);
  const kpi = useForecastKpi(scope);

  // one model produced these rows, so one row comes back. bias is not scored yet.
  const models = (data?.models ?? []).map((m) => ({
    modelName: m.modelVersion ?? "unknown",
    mape: m.wapePercent ?? 0,
    mae: m.mae ?? 0,
    rmse: m.rmse ?? 0,
    accuracy: m.accuracyPercent ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bias: (m as any).biasPercent ?? 0,
    isPrimary: m.isPrimary,
  }));

  const kpis = {
    forecastAccuracy: kpi.data?.forecastAccuracy ?? null,
    accuracyChange: null,
  };

  if (isPending) return null;

  if (isError) return <QueryError label="model performance" />;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Forecast Performance</CardTitle>
        <CardDescription>Accuracy metrics and model comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1 whitespace-nowrap">Accuracy</p>
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-success" />
              <p className="text-xl font-bold">{kpis.forecastAccuracy === null ? "—" : `${kpis.forecastAccuracy}%`}</p>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">MAPE</p>
            <p className="text-xl font-bold text-foreground">{models.find(m => m.isPrimary)?.mape}%</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">MAE</p>
            <p className="text-xl font-bold text-foreground">{models.find(m => m.isPrimary)?.mae}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Bias</p>
            <p className="text-xl font-bold text-foreground">
              {(() => {
                const bias = models.find(m => m.isPrimary)?.bias ?? 0;
                return bias > 0 ? `+${bias}%` : `${bias}%`;
              })()}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">Model Performance</h4>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table className="whitespace-nowrap text-xs">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-1/2">Model</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">MAPE</TableHead>
                  <TableHead className="text-right">RMSE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.modelName} className={model.isPrimary ? "bg-ai/5" : ""}>
                    <TableCell className="font-medium max-w-[140px] truncate" title={model.modelName}>
                      <div className="flex items-center gap-1.5">
                        {model.modelName}
                        {model.isPrimary && <CheckCircle2 className="h-3.5 w-3.5 text-ai shrink-0" />}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${model.isPrimary ? 'font-bold text-ai' : ''}`}>
                      {model.accuracy}%
                    </TableCell>
                    <TableCell className="text-right">{model.mape}%</TableCell>
                    <TableCell className="text-right">{model.rmse}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
