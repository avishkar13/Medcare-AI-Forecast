"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardPriorityActions } from "@/hooks/use-dashboard";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useScopedHref } from "@/hooks/use-scope";

export function PriorityActions() {
  const { data, isPending, isError } = useDashboardPriorityActions();
  const scopedHref = useScopedHref();

  const actions = (data?.items ?? []).map((item) => ({
    id: item.id,
    severity: item.severity,
    sku: item.sku,
    dc: item.warehouseCode,
    problem: item.problem,
    recommendedAction: item.recommendedAction,
    warehouseId: item.warehouseId,
  }));

  if (isPending || isError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          {isPending ? "Loading priority actions…" : "Could not load priority actions."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col shadow-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning" />
          Priority Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-[460px] overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col divide-y divide-border/50">
          {actions.map((action) => (
            <div key={action.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-muted/30">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm font-mono text-foreground">{action.sku}</span>
                  <Badge 
                    variant="outline"
                    className={
                      action.severity === "critical" ? "bg-destructive text-[#FFFFFF] border-transparent hover:bg-destructive/90" : 
                      action.severity === "high" ? "bg-warning text-[#FFFFFF] border-transparent hover:bg-warning/80" : ""
                    }
                  >
                    {action.severity}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-foreground">{action.problem}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="font-medium text-foreground/80">{action.dc}</span> 
                  <span>&bull;</span> 
                  <span>{action.recommendedAction}</span>
                </div>
              </div>
              {/*
                This button had no onClick and no Link at all. It now opens the
                recommendations list narrowed to the SKU and DC of the action being
                read, which is what "review" meant.
              */}
              <Link
                href={scopedHref("/recommendations", { sku: action.sku, dc: action.warehouseId })}
                className="w-full sm:w-auto shrink-0"
              >
                <Button size="sm" className="w-full gap-1.5 cursor-pointer group" variant="secondary">
                  Review Action <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
