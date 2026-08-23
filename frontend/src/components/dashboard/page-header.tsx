import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader() {
  const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Supply Chain Command Center</h1>
        <p className="text-sm text-muted-foreground">
          AI-driven inventory and replenishment intelligence
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium" suppressHydrationWarning>
          Last updated: {lastUpdated}
        </span>
        <Button variant="outline" size="sm" className="h-8 gap-2 cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  );
}
