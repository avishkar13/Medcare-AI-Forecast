"use client";

import { WastePreventionRecord } from "@/types/expiry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, ArrowUpRight } from "lucide-react";

interface PreventedWasteProps {
  records: WastePreventionRecord[];
}

export function PreventedWaste({ records }: PreventedWasteProps) {
  const formatCurrency = (val: number) => "$" + (val / 1000).toFixed(1) + "K";

  return (
    <Card className="border-border/60 shadow-sm bg-background h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <History className="h-4 w-4" />
            Recently Prevented Waste
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">This Month</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 flex flex-col">
        <div className="p-6 pb-4 bg-success/5 border-b border-success/10 flex flex-col items-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-success/80 mb-1">Total Prevented</span>
          <span className="text-3xl font-black text-success">$42.8K</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="flex flex-col divide-y divide-border/50">
            {records.map((record) => (
              <div key={record.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">{record.productName}</span>
                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{record.actionTaken}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-success">+{formatCurrency(record.valueSaved)}</span>
                  <ArrowUpRight className="h-3 w-3 text-success" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
