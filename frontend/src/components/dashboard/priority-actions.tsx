import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockPriorityActions } from "@/lib/mockData";
import { AlertCircle, ArrowRight } from "lucide-react";

export function PriorityActions() {
  const actions = mockPriorityActions;

  return (
    <Card className="flex flex-col shadow-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning" />
          Priority Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
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
                      action.severity === "warning" ? "bg-warning text-[#FFFFFF] border-transparent hover:bg-warning/80" : ""
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
              <Button size="sm" className="w-full sm:w-auto shrink-0 gap-1.5 cursor-pointer group" variant="secondary">
                Review Action <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
