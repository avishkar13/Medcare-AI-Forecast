"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Sparkles,
  FlaskConical,
  Bell,
  CalendarClock,
  Settings,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navGroups = [
  {
    title: "OVERVIEW",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "PLANNING",
    items: [
      { title: "Inventory", href: "/inventory", icon: Package },
      { title: "Demand Forecast", href: "/forecast", icon: TrendingUp },
      { title: "Recommendations", href: "/recommendations", icon: Sparkles },
      { title: "Simulation", href: "/simulation", icon: FlaskConical },
    ],
  },
  {
    title: "MONITORING",
    items: [
      { title: "Alerts", href: "/alerts", icon: Bell },
      { title: "Expiry Risk", href: "/expiry", icon: CalendarClock },
    ],
  },
  {
    title: "SYSTEM",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
];

export function SidebarContent() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight leading-none text-foreground">MedCare Pharma</span>
          <span className="text-[10px] font-medium text-muted-foreground mt-1">Forecast & Replenishment</span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <span className="px-3 text-xs font-semibold tracking-wider text-muted-foreground/70 mb-1">
              {group.title}
            </span>
            {group.items.map((item) => {
              // Ensure exact match for /dashboard so child routes don't highlight it, 
              // or simple startsWith logic
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href.split("?")[0]));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md" />
                  )}
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.title}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-4 flex flex-col gap-4 bg-sidebar shrink-0">
        <div className="flex items-center gap-2 px-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">AI Engine Online</span>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-sidebar-border p-2 bg-card">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">SA</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground leading-none mb-1">Jane Doe</span>
            <span className="text-[10px] text-muted-foreground leading-none">Supply Chain Analyst</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[250px] flex-col fixed inset-y-0 z-50">
      <SidebarContent />
    </aside>
  );
}
