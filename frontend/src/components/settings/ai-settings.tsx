import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap } from "lucide-react";

export function AISettings({
  data,
  onChange,
}: {
  data: AppSettings["ai"];
  onChange: (updates: Partial<AppSettings["ai"]>) => void;
}) {

  const updateFeature = (key: keyof AppSettings["ai"]["features"], value: boolean) => {
    onChange({ features: { ...data.features, [key]: value } });
  };

  return (
    <SettingsSection 
      title="AI Configuration" 
      subtitle="Configure AI forecasting and recommendation behavior."
    >
      <SettingsCard>
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Primary Model" description="The core machine learning model powering MedCare AI.">
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-success uppercase tracking-wider bg-success/10 px-2 py-1 rounded">Active</span>
               <Select value={data.primaryModel} onValueChange={(v) => v && onChange({ primaryModel: v })}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI Ensemble">AI Ensemble</SelectItem>
                  <SelectItem value="Deep Neural Network">Deep Neural Network</SelectItem>
                  <SelectItem value="LightGBM Boosted">LightGBM Boosted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingsRow>
          
          <SettingsRow title="Model Confidence Threshold" description="Minimum confidence for the AI model to automatically apply forecasts.">
             <div className="flex items-center gap-3 w-[180px]">
              <input type="range" min="50" max="99" value={data.modelConfidence} onChange={(e) => onChange({ modelConfidence: parseInt(e.target.value) })} className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-full appearance-none" />
              <span className="text-xs font-bold w-8 text-right">{data.modelConfidence}%</span>
            </div>
          </SettingsRow>

          <SettingsRow title="Recommendation Confidence Threshold" description="Minimum confidence to surface an automated action (e.g. FEFO priority transfer).">
             <div className="flex items-center gap-3 w-[180px]">
              <input type="range" min="50" max="99" value={data.recommendationConfidence} onChange={(e) => onChange({ recommendationConfidence: parseInt(e.target.value) })} className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-full appearance-none" />
              <span className="text-xs font-bold w-8 text-right">{data.recommendationConfidence}%</span>
            </div>
          </SettingsRow>
        </div>

        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">AI Features</h4>
          <div className="flex flex-col divide-y divide-border/50 border-t border-border/50">
            <SettingsRow title="AI Recommendations" description="Allow MedCare AI to propose actionable next steps."><SettingsToggle checked={data.features.recommendations} onCheckedChange={(v) => updateFeature("recommendations", v)} /></SettingsRow>
            <SettingsRow title="Explainability" description="Show the key signals and reasoning behind AI-generated forecasts, alerts, and recommendations."><SettingsToggle checked={data.features.explainability} onCheckedChange={(v) => updateFeature("explainability", v)} /></SettingsRow>
            <SettingsRow title="Automatic Risk Detection" description="Proactively scan for undocumented supply chain risks."><SettingsToggle checked={data.features.autoRiskDetection} onCheckedChange={(v) => updateFeature("autoRiskDetection", v)} /></SettingsRow>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="AI Decision Factors" description="Weighted importance of signals the AI uses to generate recommendations.">
        <div className="space-y-5 pt-3">
          {Object.entries(data.decisionFactors).map(([key, value]) => {
            const labels: Record<string, string> = {
              demandForecast: "Demand Forecast",
              inventoryPosition: "Inventory Position",
              leadTime: "Lead Time",
              expiryRisk: "Expiry Risk",
              networkCapacity: "Network Capacity",
            };
            return (
              <div key={key} className="flex flex-col gap-2 group">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground/90 group-hover:text-foreground transition-colors">{labels[key]}</span>
                  <span className="font-bold text-muted-foreground">{value}%</span>
                </div>
                <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden shadow-inner">
                  <div className="bg-ai h-full transition-all group-hover:bg-ai/80" style={{ width: `${value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-7 flex items-start gap-3 p-3.5 bg-ai/5 border border-ai/20 rounded-md">
          <Zap className="h-4 w-4 text-ai mt-0.5 shrink-0" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            <span className="font-bold text-ai">Explainable AI:</span> These weights are dynamically adjusted by the ensemble model per SKU, but these configuration baselines guide the core heuristic fallback.
          </p>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
