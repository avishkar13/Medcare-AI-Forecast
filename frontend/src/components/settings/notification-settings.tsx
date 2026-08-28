import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Input } from "@/components/ui/input";
import { NotificationDeliveryLog } from "./notification-delivery-log";

/**
 * Rules are stored keyed on the alert type, because that is what the router matches
 * against. This is only the display side of that - without it the table would read
 * `stockout_risk` at a planner configuring it.
 */
const EVENT_LABELS: Record<string, string> = {
  stockout_risk: "Stockout risk",
  expiry_risk: "Expiry risk",
  overstock: "Overstock",
  capacity_breach: "Capacity breach",
  demand_spike: "Demand spike",
  supplier_delay: "Supplier delay",
};

const labelFor = (event: string) => EVENT_LABELS[event] ?? event;

export function NotificationSettings({
  data,
  onChange,
}: {
  data: AppSettings["notifications"];
  onChange: (updates: Partial<AppSettings["notifications"]>) => void;
}) {

  const updateChannel = (key: keyof AppSettings["notifications"]["channels"], value: boolean) => {
    onChange({ channels: { ...data.channels, [key]: value } });
  };

  const updateRule = (index: number, key: keyof AppSettings["notifications"]["rules"][0], value: boolean) => {
    const newRules = [...data.rules];
    newRules[index] = { ...newRules[index], [key]: value };
    onChange({ rules: newRules });
  };

  return (
    <SettingsSection 
      title="Notification Preferences" 
      subtitle="Choose how MedCare AI communicates important events."
    >
      <SettingsCard title="Notification Channels">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="In-App Notifications" description="Receive alerts directly within the MedCare dashboard.">
            <SettingsToggle checked={data.channels.inApp} onCheckedChange={(v) => updateChannel("inApp", v)} />
          </SettingsRow>
          <SettingsRow title="Email Notifications" description="Receive a digest and critical alerts via email.">
            <SettingsToggle checked={data.channels.email} onCheckedChange={(v) => updateChannel("email", v)} />
          </SettingsRow>
          <SettingsRow title="SMS Notifications" description="Receive urgent critical alerts via text message.">
            <SettingsToggle checked={data.channels.sms} onCheckedChange={(v) => updateChannel("sms", v)} />
          </SettingsRow>
          <SettingsRow title="Teams / Slack" description="Send notifications to enterprise messaging channels.">
            <SettingsToggle checked={data.channels.teams} onCheckedChange={(v) => updateChannel("teams", v)} />
          </SettingsRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Notification Rules">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border/60 text-muted-foreground text-left">
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider">Event</th>
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider text-center">In-App</th>
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider text-center">Email</th>
                <th className="pb-3 pt-3 px-4 font-bold text-xs uppercase tracking-wider text-center">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.rules.map((rule, index) => (
                <tr key={rule.event} className="hover:bg-muted/20 transition-colors">
                  <td className="py-4 px-4 font-semibold text-foreground text-[13px]">{labelFor(rule.event)}</td>
                  <td className="py-4 px-4 text-center">
                    <input type="checkbox" checked={rule.inApp} onChange={(e) => updateRule(index, "inApp", e.target.checked)} className="h-4 w-4 rounded border-border/50 text-primary focus:ring-primary accent-primary cursor-pointer transition-all" />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input type="checkbox" checked={rule.email} onChange={(e) => updateRule(index, "email", e.target.checked)} className="h-4 w-4 rounded border-border/50 text-primary focus:ring-primary accent-primary cursor-pointer transition-all" />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input type="checkbox" checked={rule.sms} onChange={(e) => updateRule(index, "sms", e.target.checked)} className="h-4 w-4 rounded border-border/50 text-primary focus:ring-primary accent-primary cursor-pointer transition-all" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <SettingsCard title="Daily Digest">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Enable Daily Digest" description="Receive a comprehensive summary of all supply chain events once a day.">
            <SettingsToggle checked={data.dailyDigest.enabled} onCheckedChange={(v) => onChange({ dailyDigest: { ...data.dailyDigest, enabled: v }})} />
          </SettingsRow>
          <SettingsRow title="Delivery Time" description="When the daily digest should be sent.">
             <div className="relative w-[120px]">
              <Input type="time" value={data.dailyDigest.deliveryTime} onChange={(e) => onChange({ dailyDigest: { ...data.dailyDigest, deliveryTime: e.target.value }})} className="h-9 text-right font-medium" />
            </div>
          </SettingsRow>
        </div>
        <div className="mt-4 p-4 bg-muted/30 border border-border/50 rounded-md">
          <p className="text-xs font-semibold text-foreground mb-2">Summary includes:</p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Alert Summary</li>
            <li>Forecast Changes</li>
            <li>Inventory Risks</li>
            <li>AI Recommendations</li>
          </ul>
        </div>
      </SettingsCard>

      <NotificationDeliveryLog />
    </SettingsSection>
  );
}
