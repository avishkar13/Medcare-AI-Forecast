import { AppSettings } from "@/types/settings";
import { SettingsSection, SettingsCard, SettingsRow } from "./settings-ui";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Building, LayoutDashboard, Monitor } from "lucide-react";

export function GeneralSettings({
  data,
  onChange,
}: {
  data: AppSettings["general"];
  onChange: (updates: Partial<AppSettings["general"]>) => void;
}) {
  return (
    <SettingsSection 
      title="General Settings" 
      subtitle="Manage your workspace and regional preferences."
    >
      <SettingsCard title="Workspace Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 divide-y divide-border/50 md:divide-y-0">
          <SettingsRow title="Workspace Name" className="py-3 sm:py-4 border-b border-border/50 md:border-none">
            <Input 
              value={data.workspaceName} 
              onChange={(e) => onChange({ workspaceName: e.target.value })}
              className="w-full sm:w-[220px] h-9 text-sm" 
            />
          </SettingsRow>
          <SettingsRow title="Organization" className="py-3 sm:py-4 border-b border-border/50 md:border-none">
            <div className="flex items-center gap-2 w-full sm:w-[220px] bg-muted/30 px-3 py-2 rounded-md border border-border/50 text-sm">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{data.organization}</span>
            </div>
          </SettingsRow>
          
          <SettingsRow title="Region" className="py-3 sm:py-4 border-b border-border/50 md:border-none">
            <Select value={data.region} onValueChange={(v) => v && onChange({ region: v })}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="North America">North America</SelectItem>
                <SelectItem value="Europe">Europe</SelectItem>
                <SelectItem value="Asia Pacific">Asia Pacific</SelectItem>
                <SelectItem value="India">India</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          
          <SettingsRow title="Timezone" className="py-3 sm:py-4 border-b border-border/50 md:border-none">
            <Select value={data.timezone} onValueChange={(v) => v && onChange({ timezone: v })}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time (EST/EDT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PST/PDT)</SelectItem>
                <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                <SelectItem value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Date Format" className="py-3 sm:py-4 border-b border-border/50 md:border-none">
            <Select value={data.dateFormat} onValueChange={(v) => v && onChange({ dateFormat: v })}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="DD MMM YYYY">DD MMM YYYY</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          
          <SettingsRow title="Currency" className="py-3 sm:py-4 border-b border-border/50 md:border-none">
             <Select value={data.currency} onValueChange={(v) => v && onChange({ currency: v })}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD ($)">USD ($)</SelectItem>
                <SelectItem value="EUR (€)">EUR (€)</SelectItem>
                <SelectItem value="GBP (£)">GBP (£)</SelectItem>
                <SelectItem value="INR (₹)">INR (₹)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Language" className="py-3 sm:py-4">
             <Select value={data.language} onValueChange={(v) => v && onChange({ language: v })}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Appearance">
        <div className="flex flex-col divide-y divide-border/50">
          <SettingsRow title="Theme" description="Select your preferred application color theme.">
            <Select value={data.theme} onValueChange={(v: "light" | "dark" | "system" | null) => v && onChange({ theme: v })}>
              <SelectTrigger className="w-[180px] h-9">
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System Default</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          
          <SettingsRow title="Density" description="Control the compactness of lists, tables, and spacing.">
            <Select value={data.density} onValueChange={(v: "comfortable" | "compact" | null) => v && onChange({ density: v })}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow title="Default Landing Page" description="The first page shown when you log into MedCare AI.">
            <Select value={data.defaultLandingPage} onValueChange={(v) => v && onChange({ defaultLandingPage: v })}>
              <SelectTrigger className="w-[180px] h-9">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/dashboard">Dashboard</SelectItem>
                <SelectItem value="/inventory">Inventory</SelectItem>
                <SelectItem value="/forecast">Demand Forecast</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
