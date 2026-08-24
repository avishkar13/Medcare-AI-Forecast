"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ForecastHeader() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Demand Forecast</h1>
        <p className="text-muted-foreground mt-1">AI-powered demand prediction across products and distribution centers.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select defaultValue="30">
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue placeholder="Horizon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 Days</SelectItem>
            <SelectItem value="14">14 Days</SelectItem>
            <SelectItem value="30">30 Days</SelectItem>
            <SelectItem value="90">90 Days</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Forecast
        </Button>
        
        <div className="hidden md:flex items-center text-xs text-muted-foreground ml-2">
          <Clock className="mr-1.5 h-3.5 w-3.5" />
          Updated Today, 08:42 AM
        </div>
      </div>
    </div>
  );
}
