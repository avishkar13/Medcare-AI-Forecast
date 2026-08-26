"use client";

import { ExpiryBatch } from "@/types/expiry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock } from "lucide-react";
import { useFormatters } from "@/hooks/use-formatters";

interface AtRiskBatchTableProps {
  batches: ExpiryBatch[];
  onBatchClick: (batch: ExpiryBatch) => void;
  onActionClick: (batch: ExpiryBatch, action: string, e: React.MouseEvent) => void;
}

export function AtRiskBatchTable({ batches, onBatchClick, onActionClick }: AtRiskBatchTableProps) {
  const { formatCurrency, formatNumber, formatDate } = useFormatters();

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
      case "high": return "bg-warning text-warning-foreground hover:bg-warning/90";
      case "medium": return "bg-muted text-muted-foreground hover:bg-muted/80";
      case "low": return "bg-success/20 text-success hover:bg-success/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getActionText = (status: string) => {
    switch (status) {
      case "prioritized": return "Prioritize";
      case "transfer": return "Transfer";
      case "monitor": return "Monitor";
      default: return "Review";
    }
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 100) return "text-success font-bold";
    if (coverage >= 75) return "text-foreground font-medium";
    if (coverage >= 50) return "text-warning font-bold";
    return "text-destructive font-bold";
  };

  if (batches.length === 0) {
    return (
      <div className="bg-background border border-border/60 rounded-xl p-12 text-center shadow-sm">
        <div className="h-12 w-12 rounded-full bg-muted/20 mx-auto flex items-center justify-center mb-4">
          <CalendarClock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-bold text-foreground">No at-risk batches found</h3>
        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col mb-6">
      <div className="p-4 border-b border-border/50 bg-muted/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            At-Risk Batches
          </h2>
          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
            Prioritized using expiry date, demand coverage, inventory value, and waste exposure.
          </p>
        </div>
        <div className="text-[10px] font-bold bg-background border border-border/50 px-2 py-1 rounded-md text-muted-foreground">
          {batches.length} Batches
        </div>
      </div>

        <div className="hidden md:block overflow-auto max-h-[500px]">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-border/50 bg-muted/5 h-8">
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground w-[70px]">Risk</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Product & Batch</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Location</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right">Quantity</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Expiry</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right">Demand Cov.</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right">Value Risk</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right w-[90px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow 
                  key={batch.id} 
                  className="cursor-pointer hover:bg-muted/30 border-border/30 transition-colors h-11"
                  onClick={() => onBatchClick(batch)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-1 h-8 rounded-full ${batch.riskLevel === 'critical' ? 'bg-destructive' : batch.riskLevel === 'high' ? 'bg-warning' : batch.riskLevel === 'medium' ? 'bg-muted-foreground/40' : 'bg-success'}`} />
                      <Badge variant="secondary" className={`${getRiskColor(batch.riskLevel)} text-[9px] uppercase font-black px-1.5 py-0 rounded-sm shadow-none`}>
                        {batch.riskLevel}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-xs leading-tight">{batch.productName}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {batch.sku} <span className="h-1 w-1 rounded-full bg-border" /> {batch.batchNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[11px] font-medium">
                    {batch.location}
                  </TableCell>
                  <TableCell className="text-right font-bold text-xs">
                    {formatNumber(batch.quantity)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-xs leading-tight">{formatDate(batch.expiryDate)}</span>
                      <span className={`text-[10px] font-black mt-0.5 ${batch.daysRemaining <= 30 ? 'text-destructive' : batch.daysRemaining <= 60 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {batch.daysRemaining} days
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-xs ${getCoverageColor(batch.demandCoverage)}`}>
                      {batch.demandCoverage}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-black text-foreground text-xs leading-tight">{formatCurrency(batch.inventoryValue)}</span>
                      <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{batch.wasteSharePercent}% prob.</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] font-bold bg-background hover:bg-muted/50 border-border/50 shadow-sm transition-all"
                      onClick={(e) => onActionClick(batch, getActionText(batch.status), e)}
                    >
                      {getActionText(batch.status)}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-border/50">
          {batches.map((batch) => (
            <div 
              key={batch.id} 
              className="flex flex-col p-4 gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => onBatchClick(batch)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-8 rounded-full ${batch.riskLevel === 'critical' ? 'bg-destructive' : batch.riskLevel === 'high' ? 'bg-warning' : batch.riskLevel === 'medium' ? 'bg-muted-foreground/40' : 'bg-success'}`} />
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground text-sm leading-tight">{batch.productName}</span>
                    <span className="text-[10px] text-muted-foreground">{batch.sku} • {batch.batchNumber}</span>
                  </div>
                </div>
                <Badge variant="secondary" className={`${getRiskColor(batch.riskLevel)} text-[9px] uppercase font-black px-1.5 py-0 rounded-sm shadow-none`}>
                  {batch.riskLevel}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/10 p-2.5 rounded-lg border border-border/50">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">Expiry</span>
                  <span className={`font-bold ${batch.daysRemaining <= 30 ? 'text-destructive' : batch.daysRemaining <= 60 ? 'text-warning' : 'text-foreground'}`}>
                    {batch.daysRemaining} days left
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">Quantity</span>
                  <span className="font-bold text-foreground">{formatNumber(batch.quantity)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">Location</span>
                  <span className="font-bold text-foreground">{batch.location}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">Value Risk</span>
                  <span className="font-bold text-foreground">{formatCurrency(batch.inventoryValue)}</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-8 text-[11px] font-bold bg-background hover:bg-muted/50 border-border/50 shadow-sm"
                onClick={(e) => onActionClick(batch, getActionText(batch.status), e)}
              >
                {getActionText(batch.status)}
              </Button>
            </div>
          ))}
        </div>
    </div>
  );
}
