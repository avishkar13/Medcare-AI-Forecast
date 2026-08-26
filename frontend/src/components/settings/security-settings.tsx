import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from "./settings-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";

export function SecuritySettings({
  data,
  onChange,
}: {
  data: AppSettings["security"];
  onChange: (updates: Partial<AppSettings["security"]>) => void;
}) {

  return (
    <SettingsSection 
      title="Security & Access" 
      subtitle="Manage account security and access preferences."
    >
      <SettingsCard title="Authentication & Policies">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Two-Factor Authentication" description="Require a second form of verification for all logins.">
            <SettingsToggle checked={data.twoFactor} onCheckedChange={(v) => onChange({ twoFactor: v })} />
          </SettingsRow>
          
          <SettingsRow title="Session Timeout" description="Automatically sign out inactive users after this period.">
            <Select value={data.sessionTimeout.toString()} onValueChange={(v) => v && onChange({ sessionTimeout: parseInt(v) })}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Password Policy" description="Enforce complexity requirements for all users.">
             <Select value={data.passwordPolicy} onValueChange={(v) => v && onChange({ passwordPolicy: v })}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Strong">Strong (Require special chars)</SelectItem>
                <SelectItem value="Strict">Strict (90-day rotation)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Login Alerts" description="Notify via email when a login occurs from a new device or IP.">
            <SettingsToggle checked={data.loginAlerts} onCheckedChange={(v) => onChange({ loginAlerts: v })} />
          </SettingsRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Active Sessions" description="Manage devices currently logged into your account.">
        <p className="text-sm text-muted-foreground mt-3">
          Session tracking becomes available once authentication is in place. There is no
          session store to read from yet.
        </p>
      </SettingsCard>

      <SettingsCard title="Audit Logging">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5 flex-1 pr-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-foreground leading-none">Enable Audit Logs</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              Record configuration changes, authentication events, and important administrative actions. Recommended for enterprise compliance.
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center justify-end">
            <SettingsToggle checked={data.auditLogging} onCheckedChange={(v) => onChange({ auditLogging: v })} />
          </div>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
