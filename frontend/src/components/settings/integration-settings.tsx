import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Database, Key } from "lucide-react";

export function IntegrationSettings({
  data,
  onChange,
}: {
  data: AppSettings["integrations"];
  onChange: (updates: Partial<AppSettings["integrations"]>) => void;
}) {

  return (
    <SettingsSection 
      title="Data Sources" 
      subtitle="Manage the systems that provide MedCare AI with supply-chain data."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.sources.map((source) => (
          <div key={source.id} className="bg-background border border-border/60 rounded-xl p-5 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-sm text-foreground tracking-tight">{source.name}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded shadow-sm">
                {source.status}
              </span>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <RefreshCcw className="h-3 w-3" /> Last sync: {source.lastSync}
              </span>
              <span className="text-sm font-semibold text-foreground">{source.records.toLocaleString()} records synced</span>
            </div>
            
            <div className="flex gap-2 mt-5 pt-4 border-t border-border/50">
              <Button variant="outline" size="sm" className="w-full text-xs font-semibold h-8 hover:bg-muted">Manage</Button>
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold h-8 shadow-sm">
                <RefreshCcw className="h-3 w-3 mr-2" /> Sync
              </Button>
            </div>
          </div>
        ))}
      </div>

      <SettingsCard title="Data Refresh">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Automatic Sync" description="Periodically pull data from connected sources.">
            <SettingsToggle checked={data.dataRefresh.autoSync} onCheckedChange={(v) => onChange({ dataRefresh: { ...data.dataRefresh, autoSync: v } })} />
          </SettingsRow>
          <SettingsRow title="Sync Frequency" description="How often automatic synchronization occurs.">
             <Select value={data.dataRefresh.frequency} onValueChange={(v) => v && onChange({ dataRefresh: { ...data.dataRefresh, frequency: v } })}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5_minutes">Every 5 minutes</SelectItem>
                <SelectItem value="15_minutes">Every 15 minutes</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          
          <div className="py-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Last Successful Sync</span>
              <span className="text-sm font-bold text-foreground">02:07 AM</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Next Scheduled Sync</span>
              <span className="text-sm font-bold text-foreground">02:22 AM</span>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="API Configuration">
         <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="API Status" description="Indicates if the REST API is actively accepting connections.">
             <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-1 rounded">
                {data.api.status}
              </span>
          </SettingsRow>
          <SettingsRow title="Environment" description="Current deployment environment.">
            <Select value={data.api.environment} onValueChange={(v) => v && onChange({ api: { ...data.api, environment: v } })}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Demo">Demo</SelectItem>
                <SelectItem value="Staging">Staging</SelectItem>
                <SelectItem value="Production">Production</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow title="API Version" description="Active schema version for data mapping.">
             <span className="text-sm font-bold text-foreground">{data.api.version}</span>
          </SettingsRow>
          <SettingsRow title="API Keys" description="Manage authentication keys for external systems.">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
              <Key className="h-3.5 w-3.5 mr-2" />
              Manage Keys
            </Button>
          </SettingsRow>
         </div>
      </SettingsCard>
    </SettingsSection>
  );
}
