"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Navigation, ArrowRightLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function AIExpiryAssessment() {
  return (
    <Card className="border-ai/30 shadow-sm bg-ai/5  flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-ai" />
      <CardHeader className="pb-4 border-b border-ai/20">
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          <span className="flex items-center gap-2 text-ai">
            <Zap className="h-4 w-4 fill-ai/20" />
            AI Expiry Assessment
          </span>
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Confidence</span>
              <span className="text-xs font-black text-foreground">91%</span>
            </div>
            <div className="h-6 w-px bg-border/50" />
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Overall Risk</span>
              <span className="text-xs font-black text-destructive flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> HIGH</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 flex- flex flex-col">
        <div className="space-y-2 mb-6 flex-1">
          <div className="flex gap-3 items-start">
            <div className="h-5 w-5 rounded-full bg-ai/20 text-ai flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</div>
            <p className="text-sm text-foreground font-medium leading-relaxed">
              <span className="font-bold">5,000 units of Cetirizine</span> are projected to expire before forecast demand can consume the full batch.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="h-5 w-5 rounded-full bg-ai/20 text-ai flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</div>
            <p className="text-sm text-foreground font-medium leading-relaxed">
              <span className="font-bold">West Coast DC</span> has the highest expiry exposure due to excess inventory across multiple categories.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="h-5 w-5 rounded-full bg-ai/20 text-ai flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</div>
            <p className="text-sm text-foreground font-medium leading-relaxed">
              Transferring <span className="font-bold">1,500 units to South DC</span> could reduce projected waste by approximately $5.2K.
            </p>
          </div>
        </div>

        <div className="bg-background border border-border/50 px-5 py-2 rounded-xl mb-6 shadow-sm transition-all hover:border-ai/30 group">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5 group-hover:text-ai transition-colors">
            Recommended Strategy
          </h4>
          <p className="text-sm font-bold text-foreground leading-relaxed">
            Prioritize FEFO fulfillment globally and execute internal transfers of excess stock to locations with stronger localized forecast demand.
          </p>
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
