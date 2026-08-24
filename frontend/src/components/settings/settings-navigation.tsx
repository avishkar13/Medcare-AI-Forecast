import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, TrendingUp, Package, Bell, MessageSquare, Zap, Database, Shield } from "lucide-react";

export type SettingsSectionKey = "general" | "forecast" | "inventory" | "alerts" | "notifications" | "ai" | "integrations" | "security";

interface NavItem {
  id: SettingsSectionKey;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "forecast", label: "Forecasting", icon: TrendingUp },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "alerts", label: "Alerts & Monitoring", icon: Bell },
  { id: "notifications", label: "Notifications", icon: MessageSquare },
  { id: "ai", label: "AI & Models", icon: Zap },
  { id: "integrations", label: "Data & Integrations", icon: Database },
  { id: "security", label: "Security", icon: Shield },
];

export function SettingsNavigation({
  activeSection,
  onSelect,
}: {
  activeSection: SettingsSectionKey;
  onSelect: (section: SettingsSectionKey) => void;
}) {
  return (
    <>
      {/* Mobile Select Navigation */}
      <div className="md:hidden mb-6">
        <Select value={activeSection} onValueChange={(v: SettingsSectionKey | null) => v && onSelect(v)}>
          <SelectTrigger className="w-full h-12 bg-background font-bold text-sm border-border/60">
            <div className="flex items-center gap-2">
              {(() => {
                const activeItem = navItems.find((n) => n.id === activeSection);
                if (activeItem) {
                  const Icon = activeItem.icon;
                  return (
                    <>
                      <Icon className="h-4 w-4 text-primary" />
                      {activeItem.label}
                    </>
                  );
                }
                return <SelectValue />;
              })()}
            </div>
          </SelectTrigger>
          <SelectContent>
            {navItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <div className="flex items-center gap-2 font-medium">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Vertical Navigation */}
      <nav className="hidden md:flex flex-col gap-1 w-full max-w-[240px]">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left relative group",
                isActive
                  ? "bg-primary/10 text-primary font-bold shadow-sm"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md" />
              )}
              <item.icon className={cn("h-4 w-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
