import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, CheckCircle2 } from "lucide-react";

export function AIEngineStatus() {
  const engines = [
    { name: "Forecast Engine", status: "Online" },
    { name: "Inventory Engine", status: "Online" },
    { name: "Optimization Engine", status: "Online" },
    { name: "Simulation Engine", status: "Ready" },
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
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-sm font-semibold text-foreground">{engine.status}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
