"use client";

import { AlertOverviewData } from "@/types/alert";
import { useUiStore } from "@/store/ui.store";
import { useWarehouses } from "@/hooks/use-masterdata";

interface AlertOverviewProps {
  data: AlertOverviewData;
}

export function AlertOverview({ data }: AlertOverviewProps) {
  const dc = useUiStore((state) => state.dc);
  const { data: warehouses } = useWarehouses();
  const scopeLabel = dc
    ? `At ${warehouses?.find((w) => w.id === dc)?.name ?? "this DC"}`
    : "Across the network";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {/* Critical */}
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 shadow-sm relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-destructive/10 group-hover:scale-110 transition-transform" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1">Critical Alerts</p>
        <p className="text-3xl font-black text-destructive tracking-tight">{data.criticalCount}</p>
        <p className="text-[10px] font-medium text-destructive/80 mt-1">Require immediate action</p>
      </div>

      {/* High Priority */}
      <div className="p-4 rounded-xl border border-warning/30 bg-warning/10 shadow-sm relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-warning/20 group-hover:scale-110 transition-transform" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-warning mb-1">High Priority</p>
        <p className="text-3xl font-black text-warning tracking-tight">{data.highCount}</p>
        <p className="text-[10px] font-medium text-warning/80 mt-1">Needs attention today</p>
      </div>

      {/* Unresolved */}
      <div className="p-4 rounded-xl border border-border/50 bg-background shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Unresolved</p>
        <p className="text-3xl font-black text-foreground tracking-tight">{data.unresolvedCount}</p>
        {/*
          Was "Across the network", which stopped being true once the KPI strip started
          following the DC selector. The label now names whichever scope produced the
          figure rather than asserting one.
        */}
        <p className="text-[10px] font-medium text-muted-foreground mt-1">
          {scopeLabel}
        </p>
      </div>

      {/* Alerts Today */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Alerts Today</p>
        <p className="text-3xl font-black text-primary tracking-tight">{data.todayCount}</p>
        <p className="text-[10px] font-bold text-primary/80 mt-1">+{data.todayDelta} vs yesterday</p>
      </div>

      {/* Resolved */}
      <div className="col-span-2 lg:col-span-1 p-4 rounded-xl border border-success/20 bg-success/5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-success mb-1">Resolved</p>
        <p className="text-3xl font-black text-success tracking-tight">{data.resolvedCount}</p>
        <p className="text-[10px] font-bold text-success/80 mt-1">{data.resolvedPercentage}% resolution rate</p>
      </div>
    </div>
  );
}
