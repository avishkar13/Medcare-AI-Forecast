"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Cpu, TrendingUp, CheckCircle } from "lucide-react";

export function RecommendationFramework() {
  return (
    <Card className="shadow-sm border-ai/20 bg-gradient-to-br from-background to-ai/5 overflow-hidden">
      <CardContent className="p-6 md:p-8">
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-1">How AI Prioritizes Actions</h3>
          <p className="text-sm text-muted-foreground">The decision framework powering MedCare AI prescriptive intelligence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-0.5 bg-border z-0"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-background border-2 border-border flex items-center justify-center mb-4 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <h4 className="font-bold text-sm mb-2">1. Detect Risk</h4>
            <p className="text-xs text-muted-foreground">
              Continuously monitors inventory levels against forecast demand and lead times to identify anomalies.
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-background border-2 border-ai/30 flex items-center justify-center mb-4 shadow-sm">
              <TrendingUp className="h-5 w-5 text-ai" />
            </div>
            <h4 className="font-bold text-sm mb-2">2. Predict Impact</h4>
            <p className="text-xs text-muted-foreground">
              Calculates financial and operational exposure of stockouts, expiry, or excess inventory.
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-ai border-2 border-ai flex items-center justify-center mb-4 shadow-sm shadow-ai/20">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <h4 className="font-bold text-sm mb-2">3. Optimize Action</h4>
            <p className="text-xs text-muted-foreground">
              Evaluates multiple remediation strategies (transfers, rush orders, standard replenishment).
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-success/20 border-2 border-success/30 flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <h4 className="font-bold text-sm mb-2">4. Recommend</h4>
            <p className="text-xs text-muted-foreground">
              Surfaces the highest ROI action with clear rationale and expected financial impact.
            </p>
          </div>
        </div>

        <div className="mt-10 p-4 bg-background/60 backdrop-blur-sm rounded-xl border border-border flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm font-medium text-muted-foreground">
          <span className="px-3 py-1.5 bg-muted rounded-md whitespace-nowrap">Risk + Forecast + Inventory</span>
          <span className="hidden sm:block">→</span>
          <span className="px-3 py-1.5 bg-ai/10 text-ai rounded-md whitespace-nowrap">AI Optimization Engine</span>
          <span className="hidden sm:block">→</span>
          <span className="px-3 py-1.5 bg-success/10 text-success rounded-md whitespace-nowrap">Recommended Action</span>
        </div>
      </CardContent>
    </Card>
  );
}
