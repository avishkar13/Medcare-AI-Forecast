"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function RecommendationsHeader() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 sm:pt-6 mb-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          AI-prescribed actions to optimize inventory and prevent stockouts.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Last analyzed: 02:05 AM
        </p>
        <Button 
          variant="outline" 
          size="sm"
          className="bg-background"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
