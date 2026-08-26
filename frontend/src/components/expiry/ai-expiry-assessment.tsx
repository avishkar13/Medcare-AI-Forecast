"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Navigation, ArrowRightLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useExpiryAssessment } from "@/hooks/use-expiry";

const RISK_TONE = {
  high: "text-destructive",
  moderate: "text-warning-foreground",
  low: "text-success",
} as const;

export function AIExpiryAssessment() {
  const { data, isPending } = useExpiryAssessment();

  const findings = data?.findings ?? [];

  if (isPending) return null;

  return (
    <Card className="border-ai/30 shadow-sm bg-ai/5  flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-ai" />
      <CardHeader className="pb-4 border-b border-ai/20">
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          <span className="flex items-center gap-2 text-ai">
            <Zap className="h-4 w-4 fill-ai/20" />
            AI Expiry Assessment
          </span>
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Overall Risk</span>
            <span className={`text-xs font-black flex items-center gap-1 ${data ? RISK_TONE[data.riskLevel] : ""}`}>
              <ShieldAlert className="h-3 w-3" /> {data?.riskLevel.toUpperCase() ?? "-"}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 flex- flex flex-col">
        <div className="space-y-2 mb-6 flex-1">
          {findings.length === 0 && (
            <p className="text-sm font-medium text-muted-foreground">
              Nothing to assess: no unexpired batches are tracked.
            </p>
          )}
          {findings.map((finding, index) => (
            <div key={finding.kind} className="flex gap-3 items-start">
              <div className="h-5 w-5 rounded-full bg-ai/20 text-ai flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                {index + 1}
              </div>
              <p className="text-sm text-foreground font-medium leading-relaxed">{finding.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <Link href="/recommendations" className="block w-full cursor-pointer" passHref>
            <Button className="w-full bg-ai hover:bg-ai/90 text-primary-foreground font-bold h-11 text-xs shadow-sm transition-transform hover:scale-[1.02] cursor-pointer">
              <Navigation className="h-4 w-4" />
              Recommendations
            </Button>
          </Link>
          <Link href="/simulation" className="block w-full cursor-pointer" passHref>
            <Button variant="outline" className="w-full h-11 text-xs font-bold border-ai/30 text-foreground hover:bg-ai/10 transition-transform hover:scale-[1.02] cursor-pointer">
              <ArrowRightLeft className="h-4 w-4 mr-2 text-ai" />
              Simulate Transfer
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
