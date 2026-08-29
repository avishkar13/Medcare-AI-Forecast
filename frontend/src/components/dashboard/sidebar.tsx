"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Sparkles,
  FlaskConical,
  Bell,
  CalendarClock,
  ClipboardList,
  PackageCheck,
  Settings,
  Activity,
  LogOut,
  Users,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { useScopedHref } from "@/hooks/use-scope";

function getInitials(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * `items` carries an optional `children`, one level deep.
 *
 * The array was flat, so Phase 3-5 could not add sub-navigation - a Planning section
 * with Runs, Supply and Scenarios under it - without changing this component. Nothing
 * uses `children` yet; the shape is here so adding a sub-page is a data change.
 */
interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: { title: string; href: string }[];
  requiredPermission?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiredPermission: "dashboard:view" }],
  },
  {
    title: "PLANNING",
    items: [
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        requiredPermission: "inventory:view",
        // The first user of Phase 2's sub-navigation: the ledger belongs under
        // inventory, not beside it. Gated by the parent's permission - a reader who
        // cannot see inventory has no business in its ledger either.
        children: [{ title: "Transactions", href: "/inventory/transactions" }],
      },
      { title: "Demand Forecast", href: "/forecast", icon: TrendingUp, requiredPermission: "forecast:view" },
      // between forecasting and recommending, which is where the executor writes them
      { title: "Supply & Transfers", href: "/plans", icon: ClipboardList, requiredPermission: "simulation:view" },
      // Gated on read: deciding needs inventory:adjust, and the buttons enforce that
      // themselves rather than hiding the queue from everyone who cannot decide.
      { title: "Restock Requests", href: "/restock", icon: PackageCheck, requiredPermission: "inventory:view" },
      { title: "Recommendations", href: "/recommendations", icon: Sparkles, requiredPermission: "recommendations:view" },
      { title: "Simulation", href: "/simulation", icon: FlaskConical, requiredPermission: "simulation:view" },
    ],
  },
  {
    title: "MONITORING",
    items: [
      { title: "Alerts", href: "/alerts", icon: Bell, requiredPermission: "alerts:view" },
      { title: "Expiry Risk", href: "/expiry", icon: CalendarClock, requiredPermission: "expiry:view" },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { title: "User Management", href: "/admin/users", icon: Users, requiredPermission: "users:view" },
      { title: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck, requiredPermission: "roles:view" },
    ],
  },
  {
    title: "SYSTEM",
    items: [{ title: "Settings", href: "/settings", icon: Settings, requiredPermission: "settings:view" }],
  },

];

export function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/auth");
  };

  const initials = getInitials(user?.name);
  const scopedHref = useScopedHref();
  const { data: summaryData } = useDashboardSummary();
  const kpis = summaryData?.kpis;

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
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.requiredPermission) return true;
            return user?.permissions?.includes(item.requiredPermission);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="flex flex-col gap-1">
              <span className="px-3 text-xs font-semibold tracking-wider text-muted-foreground/70 mb-1">
                {group.title}
              </span>
              {visibleItems.map((item) => {
                /**
                  * A parent highlights only when no child of its own matches.
                  *
                  * Plain `startsWith` lit up both "Inventory" and its "Transactions"
                  * child on `/inventory/transactions`, so two entries looked current at
                  * once and neither told the reader where they actually were.
                  */
                const base = item.href.split("?")[0]!;
                const onChild = (item.children ?? []).some(
                  (child) => pathname === child.href.split("?")[0],
                );
                const isActive =
                  pathname === base || (!onChild && base !== "/" && pathname?.startsWith(`${base}/`));
                const Icon = item.icon;

                return (
                  <div key={item.href} className="flex flex-col gap-1">
                    <Link
                      href={scopedHref(item.href)}
                      className={cn(
                        "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md" />
                        )}
                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                        {item.title}
                      </div>
                      {item.title === "Alerts" && kpis?.activeAlerts !== undefined && kpis.activeAlerts > 0 && (
                        <span className="bg-destructive text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {kpis.activeAlerts}
                        </span>
                      )}
                      {item.title === "Recommendations" && kpis?.pendingRecommendations !== undefined && kpis.pendingRecommendations > 0 && (
                        <span className="bg-ai/20 text-ai dark:text-ai-foreground dark:bg-ai/40 text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {kpis.pendingRecommendations}
                        </span>
                      )}
                      {item.title === "Expiry Risk" && kpis?.expiryRiskItems !== undefined && kpis.expiryRiskItems > 0 && (
                        <span className="bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {kpis.expiryRiskItems}
                        </span>
                      )}
                    </Link>

                    {/* Sub-navigation, shown only while its parent section is open. */}
                    {isActive && item.children?.length ? (
                      <div className="ml-7 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={scopedHref(child.href)}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                                childActive
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {child.title}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
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

        <div className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border p-2 bg-card">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground leading-none mb-1 truncate">
                {user?.name ?? "User"}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none truncate">
                {user?.role?.name ?? (user?.warehouseId ? `DC: ${user.warehouseId}` : user?.email ?? "Authenticated")}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
            onClick={handleLogout}
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Log out</span>
          </Button>
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
