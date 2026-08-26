"use client";

import { DistributionCenterExpiry } from "@/types/expiry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { useFormatters } from "@/hooks/use-formatters";

interface DCExpiryExposureProps {
  data: DistributionCenterExpiry[];
}

export function DCExpiryExposure({ data }: DCExpiryExposureProps) {
  const { formatCompactCurrency: formatCurrency } = useFormatters();
  const maxExposure = Math.max(...data.map(d => d.atRiskValue));

  return (
    <Card className="border-border/60 shadow-sm bg-background h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Expiry Exposure by DC
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-center">
        <div className="space-y-5">
          {data.map((dc, idx) => {
            const widthPct = (dc.atRiskValue / maxExposure) * 100;
            const isHighest = dc.atRiskValue === maxExposure;
            
            return (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end">
                  <span className={`text-xs font-bold ${isHighest ? 'text-destructive' : 'text-foreground'}`}>
                    {dc.location}
                  </span>
                  <div className="flex flex-col text-right">
                    <span className={`text-sm font-black ${isHighest ? 'text-destructive' : 'text-foreground'}`}>
                      {formatCurrency(dc.atRiskValue)}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground">{dc.criticalBatches} critical batches</span>
                  </div>
                </div>
                
                <div className="w-full bg-muted/20 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isHighest ? 'bg-destructive' : 'bg-primary'}`} 
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
