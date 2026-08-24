import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Input } from "@/components/ui/input";

export function InventorySettings({
  data,
  onChange,
}: {
  data: AppSettings["inventory"];
  onChange: (updates: Partial<AppSettings["inventory"]>) => void;
}) {
  const updateThreshold = (metric: keyof AppSettings["inventory"]["thresholds"], level: "warning" | "critical", value: number) => {
    onChange({
      thresholds: {
        ...data.thresholds,
        [metric]: {
          ...data.thresholds[metric],
          [level]: value
        }
      }
    });
  };

  return (
    <SettingsSection 
      title="Inventory Configuration" 
      subtitle="Define inventory thresholds and replenishment behavior."
    >
      <SettingsCard title="Safety Stock">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Default Safety Stock" description="Minimum buffer held against demand volatility.">
            <div className="relative w-[160px]">
              <Input 
                type="number" 
                value={data.defaultSafetyStock} 
                onChange={(e) => onChange({ defaultSafetyStock: parseInt(e.target.value) || 0 })}
                className="pr-12 h-9 text-right font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">Days</span>
            </div>
          </SettingsRow>
          
          <SettingsRow title="Reorder Point" description="Inventory level that triggers a replenishment recommendation.">
            <div className="relative w-[160px]">
              <Input 
                type="number" 
                value={data.reorderPoint} 
                onChange={(e) => onChange({ reorderPoint: parseInt(e.target.value) || 0 })}
                className="pr-12 h-9 text-right font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">Days</span>
            </div>
          </SettingsRow>
          
          <SettingsRow title="Maximum Inventory" description="Upper limit to prevent overstocking and expiry risks.">
             <div className="relative w-[160px]">
              <Input 
                type="number" 
                value={data.maxInventory} 
                onChange={(e) => onChange({ maxInventory: parseInt(e.target.value) || 0 })}
                className="pr-12 h-9 text-right font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">Days</span>
            </div>
          </SettingsRow>

          <SettingsRow title="Minimum Service Level" description="Target order fulfillment rate without stockouts.">
             <div className="relative w-[160px]">
              <Input 
                type="number" 
                value={data.minServiceLevel} 
                onChange={(e) => onChange({ minServiceLevel: parseInt(e.target.value) || 0 })}
                className="pr-8 h-9 text-right font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
            </div>
          </SettingsRow>

          <SettingsRow title="Automatic Reorder Recommendations" description="Let AI suggest POs when stock hits the reorder point.">
            <SettingsToggle 
              checked={data.autoReorder} 
              onCheckedChange={(v) => onChange({ autoReorder: v })} 
            />
          </SettingsRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Inventory Thresholds">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border/60 text-muted-foreground text-left">
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider">Metric</th>
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider">Warning</th>
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider">Critical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-4 px-4 font-semibold text-foreground text-[13px]">Stock Coverage</td>
                <td className="py-4 px-4">
                  <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.stockCoverage.warning} onChange={(e) => updateThreshold("stockCoverage", "warning", parseInt(e.target.value) || 0)} className="h-8 pr-12 text-right text-[13px] font-medium focus-visible:ring-warning/20 border-warning/30 hover:border-warning/50 transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">days</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.stockCoverage.critical} onChange={(e) => updateThreshold("stockCoverage", "critical", parseInt(e.target.value) || 0)} className="h-8 pr-12 text-right text-[13px] font-medium border-destructive/40 focus-visible:ring-destructive/30 hover:border-destructive/60 transition-colors bg-destructive/5" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive text-[10px] font-bold">days</span>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-4 px-4 font-semibold text-foreground text-[13px]">Safety Stock Level</td>
                <td className="py-4 px-4">
                   <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.safetyStock.warning} onChange={(e) => updateThreshold("safetyStock", "warning", parseInt(e.target.value) || 0)} className="h-8 pr-8 text-right text-[13px] font-medium focus-visible:ring-warning/20 border-warning/30 hover:border-warning/50 transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">%</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                   <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.safetyStock.critical} onChange={(e) => updateThreshold("safetyStock", "critical", parseInt(e.target.value) || 0)} className="h-8 pr-8 text-right text-[13px] font-medium border-destructive/40 focus-visible:ring-destructive/30 hover:border-destructive/60 transition-colors bg-destructive/5" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive text-[10px] font-bold">%</span>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-4 px-4 font-semibold text-foreground text-[13px]">Capacity Utilization</td>
                <td className="py-4 px-4">
                  <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.capacity.warning} onChange={(e) => updateThreshold("capacity", "warning", parseInt(e.target.value) || 0)} className="h-8 pr-8 text-right text-[13px] font-medium focus-visible:ring-warning/20 border-warning/30 hover:border-warning/50 transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">%</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                   <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.capacity.critical} onChange={(e) => updateThreshold("capacity", "critical", parseInt(e.target.value) || 0)} className="h-8 pr-8 text-right text-[13px] font-medium border-destructive/40 focus-visible:ring-destructive/30 hover:border-destructive/60 transition-colors bg-destructive/5" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive text-[10px] font-bold">%</span>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-muted/20 transition-colors border-b-0">
                <td className="py-4 px-4 font-semibold text-foreground text-[13px] border-b-0">Expiry Window</td>
                <td className="py-4 px-4 border-b-0">
                  <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.expiryWindow.warning} onChange={(e) => updateThreshold("expiryWindow", "warning", parseInt(e.target.value) || 0)} className="h-8 pr-12 text-right text-[13px] font-medium focus-visible:ring-warning/20 border-warning/30 hover:border-warning/50 transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">days</span>
                  </div>
                </td>
                <td className="py-4 px-4 border-b-0">
                   <div className="relative w-[110px]">
                    <Input type="number" value={data.thresholds.expiryWindow.critical} onChange={(e) => updateThreshold("expiryWindow", "critical", parseInt(e.target.value) || 0)} className="h-8 pr-12 text-right text-[13px] font-medium border-destructive/40 focus-visible:ring-destructive/30 hover:border-destructive/60 transition-colors bg-destructive/5" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive text-[10px] font-bold">days</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
