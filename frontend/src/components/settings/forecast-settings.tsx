import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function ForecastSettings({
  data,
  onChange,
}: {
  data: AppSettings["forecast"];
  onChange: (updates: Partial<AppSettings["forecast"]>) => void;
}) {
  return (
    <SettingsSection 
      title="Forecasting Preferences" 
      subtitle="Configure how demand forecasts are generated and presented."
    >
      <SettingsCard>
        <div className="flex flex-col divide-y divide-border/50">
          
          <SettingsRow title="Default Forecast Horizon" description="The default number of days projected in the demand forecast.">
            <Select 
              value={data.defaultHorizon.toString()} 
              onValueChange={(v) => v && onChange({ defaultHorizon: parseInt(v) })}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Default Forecast Model" description="The underlying mathematical model used for baseline forecasting.">
            <Select 
              value={data.defaultModel} 
              onValueChange={(v) => v && onChange({ defaultModel: v })}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AI Ensemble">AI Ensemble</SelectItem>
                <SelectItem value="Seasonal Forecast">Seasonal Forecast</SelectItem>
                <SelectItem value="Moving Average">Moving Average</SelectItem>
                <SelectItem value="Exponential Smoothing">Exponential Smoothing</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Confidence Threshold" description="Minimum confidence score required for AI recommendations.">
            <div className="flex items-center gap-3 w-[180px]">
              <input 
                type="range" 
                min="50" max="99" 
                value={data.confidenceThreshold}
                onChange={(e) => onChange({ confidenceThreshold: parseInt(e.target.value) })}
                className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-full appearance-none"
              />
              <span className="text-xs font-bold w-8 text-right">{data.confidenceThreshold}%</span>
            </div>
          </SettingsRow>

          <SettingsRow title="Forecast Update Frequency" description="How often the system recalculates baseline forecasts.">
             <Select 
              value={data.updateFrequency} 
              onValueChange={(v) => v && onChange({ updateFrequency: v })}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="6_hours">Every 6 hours</SelectItem>
                <SelectItem value="12_hours">Every 12 hours</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          
          <SettingsRow title="Prediction Interval" description="Statistical confidence bounds (e.g., P95) for demand variance.">
            <Select 
              value={data.predictionInterval.toString()} 
              onValueChange={(v) => v && onChange({ predictionInterval: parseInt(v) })}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="90">90%</SelectItem>
                <SelectItem value="95">95%</SelectItem>
                <SelectItem value="99">99%</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Automatic Forecast Refresh" description="Automatically refresh dashboard numbers when new data is available.">
            <SettingsToggle 
              checked={data.autoRefresh} 
              onCheckedChange={(v) => onChange({ autoRefresh: v })} 
            />
          </SettingsRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Forecast Accuracy">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Target Accuracy" description="The KPI baseline for overall model performance.">
            <div className="relative w-[120px]">
              <Input 
                type="number" 
                value={data.targetAccuracy} 
                onChange={(e) => onChange({ targetAccuracy: parseInt(e.target.value) || 0 })}
                className="pr-8 h-9 text-right font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
            </div>
          </SettingsRow>
          <SettingsRow title="Alert Threshold" description="Trigger a system alert when accuracy falls below this level.">
            <div className="relative w-[120px]">
              <Input 
                type="number" 
                value={data.alertAccuracyThreshold} 
                onChange={(e) => onChange({ alertAccuracyThreshold: parseInt(e.target.value) || 0 })}
                className="pr-8 h-9 text-right font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
            </div>
          </SettingsRow>
        </div>
        <div className="mt-4 p-3 bg-muted/30 border border-border/50 rounded-md">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground">Note:</span> Forecast performance is monitored continuously. Lower accuracy may indicate changing demand patterns or insufficient historical data.
          </p>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
