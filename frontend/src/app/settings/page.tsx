"use client";

import { useState } from "react";
import { AppSettings, defaultSettings } from "@/types/settings";
import { SettingsSectionKey, SettingsNavigation } from "@/components/settings/settings-navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";

// Import all sections
import { GeneralSettings } from "@/components/settings/general-settings";
import { ForecastSettings } from "@/components/settings/forecast-settings";
import { InventorySettings } from "@/components/settings/inventory-settings";
import { AlertSettings } from "@/components/settings/alert-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { AISettings } from "@/components/settings/ai-settings";
import { IntegrationSettings } from "@/components/settings/integration-settings";
import { SecuritySettings } from "@/components/settings/security-settings";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("general");
  
  // Manage settings state
  const [savedSettings, setSavedSettings] = useState<AppSettings>(defaultSettings);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(defaultSettings);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if draft differs from saved
  const hasUnsavedChanges = JSON.stringify(savedSettings) !== JSON.stringify(draftSettings);

  const handleUpdate = <K extends keyof AppSettings>(section: K, updates: Partial<AppSettings[K]>) => {
    setDraftSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...updates,
      },
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setSavedSettings(draftSettings);
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 600);
  };

  const handleDiscard = () => {
    setDraftSettings(savedSettings);
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings data={draftSettings.general} onChange={(v) => handleUpdate("general", v)} />;
      case "forecast":
        return <ForecastSettings data={draftSettings.forecast} onChange={(v) => handleUpdate("forecast", v)} />;
      case "inventory":
        return <InventorySettings data={draftSettings.inventory} onChange={(v) => handleUpdate("inventory", v)} />;
      case "alerts":
        return <AlertSettings data={draftSettings.alerts} onChange={(v) => handleUpdate("alerts", v)} />;
      case "notifications":
        return <NotificationSettings data={draftSettings.notifications} onChange={(v) => handleUpdate("notifications", v)} />;
      case "ai":
        return <AISettings data={draftSettings.ai} onChange={(v) => handleUpdate("ai", v)} />;
      case "integrations":
        return <IntegrationSettings data={draftSettings.integrations} onChange={(v) => handleUpdate("integrations", v)} />;
      case "security":
        return <SecuritySettings data={draftSettings.security} onChange={(v) => handleUpdate("security", v)} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 w-full p-4 md:p-8 max-w-[1200px] mx-auto overflow-y-auto no-scrollbar pb-24">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 pb-4 border-b border-border/50">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">System Configuration</span>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[500px]">
            Configure forecasting, inventory monitoring, alerts, and application preferences.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            {hasUnsavedChanges ? (
              <span className="text-warning bg-warning/10 px-3 py-1 rounded-full border border-warning/20">
                Unsaved changes
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                All changes saved
              </span>
            )}
          </div>
          <Button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="h-10 px-6 font-bold shadow-sm transition-all"
          >
            <Save className={cn("h-4 w-4 mr-2", isSaving && "animate-spin opacity-50")} />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col md:flex-row gap-8 items-start relative">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-[240px] shrink-0 sticky top-4">
          <SettingsNavigation activeSection={activeSection} onSelect={setActiveSection} />
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full min-w-0">
          {renderActiveSection()}
          
          {/* Bottom Actions */}
          {hasUnsavedChanges && (
            <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground mr-auto hidden sm:block">
                You have unsaved changes in this section.
              </span>
              <Button variant="ghost" onClick={handleDiscard} className="w-full sm:w-auto h-10 font-bold hover:bg-destructive/10 hover:text-destructive transition-colors">
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard Changes
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto h-10 font-bold shadow-sm">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}

          {showSuccess && (
            <div className="mt-6 p-4 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm font-bold text-success">Settings saved successfully.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
