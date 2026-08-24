"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SystemAlert } from "@/types/alert";
import { 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  PackagePlus, 
  Truck, 
  Server, 
  LineChart 
} from "lucide-react";

interface AlertRowProps {
  alert: SystemAlert;
  onReview: () => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  stockout_risk: <AlertTriangle className="h-4 w-4" />,
  demand_spike: <TrendingUp className="h-4 w-4" />,
  expiry_risk: <Clock className="h-4 w-4" />,
  overstock: <PackagePlus className="h-4 w-4" />,
  supplier_delay: <Truck className="h-4 w-4" />,
  capacity_breach: <Server className="h-4 w-4" />,
  forecast_anomaly: <LineChart className="h-4 w-4" />,
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-destructive text-white border-transparent",
  acknowledged: "bg-warning text-white border-transparent",
  in_progress: "bg-primary text-white border-transparent",
  resolved: "bg-success text-white border-transparent",
};

export function AlertRow({ alert, onReview }: AlertRowProps) {
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formattedType = alert.type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="relative group">
      {/* Small subtle left border indicator for new alerts */}
      {alert.status === "new" && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive/80 rounded-l-md" />
      )}
      <div className={`
        flex flex-col md:grid md:grid-cols-[80px_1fr_1.5fr_1fr_1fr_120px_100px] gap-3 md:gap-4 p-4 md:p-3 items-start md:items-center hover:bg-muted/40 transition-colors bg-background
      `}>
      {/* Mobile Header: Severity & Status */}
      <div className="flex md:hidden items-center justify-between w-full mb-1">
        <Badge variant="outline" className={`${SEVERITY_STYLES[alert.severity]} text-[10px] font-bold uppercase px-2`}>
          {alert.severity}
        </Badge>
        <Badge variant="outline" className={`${STATUS_STYLES[alert.status]} text-[10px] font-bold capitalize`}>
          {alert.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Severity (Desktop) */}
      <div className="hidden md:block">
        <Badge variant="outline" className={`${SEVERITY_STYLES[alert.severity]} text-[10px] font-bold uppercase px-2 shadow-sm`}>
          {alert.severity}
        </Badge>
      </div>

      {/* Alert Type */}
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded bg-muted/50 border border-border/50 text-foreground`}>
          {TYPE_ICONS[alert.type]}
        </div>
        <span className="text-[11px] font-bold text-foreground leading-tight">{formattedType}</span>
      </div>

      {/* Issue & Location */}
      <div className="w-full">
        <p className="text-xs font-semibold text-foreground leading-tight mb-1">{alert.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-muted-foreground">
          {alert.sku && (
            <span className="px-1.5 py-0.5 bg-muted/50 border border-border/50 rounded">{alert.sku}</span>
          )}
          <span>{alert.location}</span>
        </div>
      </div>

      {/* Business Impact */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-destructive/60" />
        <span className="text-[11px] font-bold text-foreground leading-tight">
          {alert.businessImpact}
        </span>
      </div>

      {/* Detected */}
      <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3 w-3 opacity-70" />
        {formatTime(alert.detectedAt)}
      </div>

      {/* Status (Desktop) */}
      <div className="hidden md:block">
        <Badge variant="outline" className={`${STATUS_STYLES[alert.status]} text-[10px] font-bold capitalize shadow-sm`}>
          {alert.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Action */}
      <div className="w-full md:w-auto md:text-right mt-2 md:mt-0 flex justify-end">
        <Button size="sm" variant="outline" className="w-full md:w-auto h-7 text-[10px] font-bold px-4 bg-background hover:bg-muted" onClick={onReview}>
          Review
        </Button>
      </div>
    </div>
    </div>
  );
}
