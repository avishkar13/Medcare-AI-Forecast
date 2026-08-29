import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AlertSettings({
  data,
  onChange,
}: {
  data: AppSettings["alerts"];
  onChange: (updates: Partial<AppSettings["alerts"]>) => void;
}) {

  const updateType = (key: keyof AppSettings["alerts"]["types"], value: boolean) => {
    onChange({ types: { ...data.types, [key]: value } });
  };

  const updateThreshold = (key: keyof AppSettings["alerts"]["thresholds"], value: number) => {
    onChange({ thresholds: { ...data.thresholds, [key]: value } });
  };

  const updateEscalation = (key: keyof AppSettings["alerts"]["escalation"], value: string) => {
    onChange({ escalation: { ...data.escalation, [key]: value } });
  };

  return (
    <SettingsSection 
      title="Alert Configuration" 
      subtitle="Control which supply-chain events trigger alerts."
    >
      <SettingsCard>
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Real-Time Monitoring" description="Continuously scan data for anomalies and risks.">
            <SettingsToggle checked={data.realTimeMonitoring} onCheckedChange={(v) => onChange({ realTimeMonitoring: v })} />
          </SettingsRow>
        </div>
        
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Active Alert Types</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            <SettingsRow title="Stockout Risk" className="py-2"><SettingsToggle checked={data.types.stockoutRisk} onCheckedChange={(v) => updateType("stockoutRisk", v)} /></SettingsRow>
            <SettingsRow title="Demand Spike" className="py-2"><SettingsToggle checked={data.types.demandSpike} onCheckedChange={(v) => updateType("demandSpike", v)} /></SettingsRow>
            <SettingsRow title="Expiry Risk" className="py-2"><SettingsToggle checked={data.types.expiryRisk} onCheckedChange={(v) => updateType("expiryRisk", v)} /></SettingsRow>
            <SettingsRow title="Supplier Delay" className="py-2"><SettingsToggle checked={data.types.supplierDelay} onCheckedChange={(v) => updateType("supplierDelay", v)} /></SettingsRow>
            <SettingsRow title="Capacity Breach" className="py-2"><SettingsToggle checked={data.types.capacityBreach} onCheckedChange={(v) => updateType("capacityBreach", v)} /></SettingsRow>
            <SettingsRow title="Overstock" className="py-2"><SettingsToggle checked={data.types.overstock} onCheckedChange={(v) => updateType("overstock", v)} /></SettingsRow>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Alert Thresholds">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Stockout Probability" description="Alert when AI prediction exceeds this chance of stockout.">
            <div className="relative w-[120px]">
              <Input type="number" value={data.thresholds.stockoutProbability} onChange={(e) => updateThreshold("stockoutProbability", parseInt(e.target.value) || 0)} className="pr-8 h-9 text-right font-medium" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
            </div>
          </SettingsRow>
          <SettingsRow title="Demand Deviation" description="Alert when real demand differs from forecast by this margin.">
            <div className="relative w-[120px]">
              <Input type="number" value={data.thresholds.demandDeviation} onChange={(e) => updateThreshold("demandDeviation", parseInt(e.target.value) || 0)} className="pr-8 h-9 text-right font-medium" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
            </div>
          </SettingsRow>
          <SettingsRow title="Expiry Window" description="Alert when batches will expire within this timeframe.">
            <div className="relative w-[120px]">
              <Input type="number" value={data.thresholds.expiryWindow} onChange={(e) => updateThreshold("expiryWindow", parseInt(e.target.value) || 0)} className="pr-12 h-9 text-right font-medium" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">Days</span>
            </div>
          </SettingsRow>
          <SettingsRow title="Capacity Utilization" description="Alert when warehouse storage exceeds this utilization.">
            <div className="relative w-[120px]">
              <Input type="number" value={data.thresholds.capacityUtilization} onChange={(e) => updateThreshold("capacityUtilization", parseInt(e.target.value) || 0)} className="pr-8 h-9 text-right font-medium" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
            </div>
          </SettingsRow>
          <SettingsRow title="Supplier Delay" description="Alert when a PO is delayed by this many days.">
            <div className="relative w-[120px]">
              <Input type="number" value={data.thresholds.supplierDelay} onChange={(e) => updateThreshold("supplierDelay", parseInt(e.target.value) || 0)} className="pr-12 h-9 text-right font-medium" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">Days</span>
            </div>
          </SettingsRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Alert Escalation">
         <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Critical Alerts" description="Escalation SLA for critical risk events.">
            <Select value={data.escalation.critical} onValueChange={(v) => v && updateEscalation("critical", v)}>
              <SelectTrigger className="w-[180px] h-9 border-destructive/30 text-destructive font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="Within 5 minutes">Within 5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow title="High Alerts" description="Escalation SLA for high risk events.">
            <Select value={data.escalation.high} onValueChange={(v) => v && updateEscalation("high", v)}>
              <SelectTrigger className="w-[180px] h-9 border-warning/30 text-warning-foreground font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="Within 15 minutes">Within 15 minutes</SelectItem>
                <SelectItem value="Within 1 hour">Within 1 hour</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow title="Medium Alerts" description="Escalation SLA for standard warnings.">
             <Select value={data.escalation.medium} onValueChange={(v) => v && updateEscalation("medium", v)}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Within 1 hour">Within 1 hour</SelectItem>
                <SelectItem value="Within 4 hours">Within 4 hours</SelectItem>
                <SelectItem value="Daily Digest">Daily Digest</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow title="Low Alerts" description="Escalation SLA for informational alerts.">
             <Select value={data.escalation.low} onValueChange={(v) => v && updateEscalation("low", v)}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Within 4 hours">Within 4 hours</SelectItem>
                <SelectItem value="Daily Digest">Daily Digest</SelectItem>
                <SelectItem value="Dashboard Only">Dashboard Only</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
         </div>
      </SettingsCard>
    </SettingsSection>
  );
}
