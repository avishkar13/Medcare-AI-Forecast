"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, CheckCircle2, XCircle } from "lucide-react";
import { useReadiness } from "@/hooks/use-health";
import { QueryError } from "@/components/ui/query-state";

export function AIEngineStatus() {
  const { data, isPending, isError } = useReadiness();

  if (isPending || !data) return null;

  if (isError) return <QueryError label="engine status" />;

  // the readiness probe reports the three dependencies the planner needs, which is
  // the only engine state anything actually knows
  const engines = [
    { name: "Forecast Engine", up: data.dependencies.forecast === "up" },
    { name: "Database", up: data.dependencies.database === "up" },
    { name: "Cache", up: data.dependencies.redis === "up" },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-ai" />
          AI Engine Status
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex flex-col gap-4">
          {engines.map((engine) => (
            <div key={engine.name} className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{engine.name}</span>
              <div className="flex items-center gap-1.5">
                {engine.up ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={`text-sm font-semibold ${engine.up ? "text-foreground" : "text-destructive"}`}>
                  {engine.up ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-sm font-medium text-muted-foreground">Uptime</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {Math.floor(data.uptimeSeconds / 3600)}h {Math.floor((data.uptimeSeconds % 3600) / 60)}m
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
