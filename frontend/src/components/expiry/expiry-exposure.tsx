"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExpiryExposure() {
  const chartData = [
    { label: "0–30 Days", value: 32400, color: "bg-destructive" },
    { label: "31–60 Days", value: 44800, color: "bg-warning" },
    { label: "61–90 Days", value: 51200, color: "bg-primary" },
    { label: "90+ Days", value: 182000, color: "bg-muted-foreground/30" },
  ];

  const maxValue = Math.max(...chartData.map((d) => d.value));

  const formatCurrency = (val: number) => {
    return "$" + (val / 1000).toFixed(1) + "K";
  };

  return (
    <Card className="border-border/60 shadow-sm mb-6 bg-background">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex flex-col gap-1">
          <span className="text-base">Expiry Exposure</span>
          <span className="text-[10px] font-medium text-muted-foreground normal-case">
            Inventory value and quantity approaching expiry.
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
          
          {/* Left Side: Chart */}
          <div className="p-6">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
              Value by Expiry Window
            </h3>
            <div className="space-y-4">
              {chartData.map((item, idx) => {
                const widthPct = (item.value / maxValue) * 100;
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-20 text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                      {item.label}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-full bg-muted/20 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${item.color} transition-all duration-500`} 
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-foreground w-12 text-right">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Breakdown */}
          <div className="p-6 bg-muted/5 flex flex-col justify-center">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
              Expiry Risk Breakdown
            </h3>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="flex flex-col gap-1 p-3 bg-background border border-border/50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Critical</span>
                </div>
                <span className="text-sm font-black text-foreground">$32.4K</span>
                <span className="text-[9px] font-medium text-muted-foreground">8 batches</span>
              </div>
              
              <div className="flex flex-col gap-1 p-3 bg-background border border-border/50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">High</span>
                </div>
                <span className="text-sm font-black text-foreground">$44.8K</span>
                <span className="text-[9px] font-medium text-muted-foreground">9 batches</span>
              </div>
              
              <div className="flex flex-col gap-1 p-3 bg-background border border-border/50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Medium</span>
                </div>
                <span className="text-sm font-black text-foreground">$51.2K</span>
                <span className="text-[9px] font-medium text-muted-foreground">20 batches</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Exposure</span>
              <span className="text-xl font-black text-foreground">$128.4K</span>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
