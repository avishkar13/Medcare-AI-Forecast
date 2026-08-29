"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { useAuthStore } from "@/store/auth.store";
import { Loader2 } from "lucide-react";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "next-themes";

const ROUTE_PERMISSIONS: Record<string, string> = {
  "/dashboard": "dashboard:view",
  "/inventory": "inventory:view",
  "/forecast": "forecast:view",
  "/recommendations": "recommendations:view",
  "/simulation": "simulation:view",
  "/alerts": "alerts:view",
  "/expiry": "expiry:view",
  "/settings": "settings:view",
  "/admin/users": "users:view",
  "/admin/roles": "roles:view",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = pathname?.startsWith("/auth");
  
  const { isAuthenticated, isInitializing } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const { data: settings } = useSettings();
  const { setTheme, theme: currentTheme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || isInitializing) return;

    if (!isAuthenticated && !isAuth) {
      router.push("/auth");
    } else if (isAuthenticated && isAuth) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isInitializing, isAuth, router, mounted]);

  // Sync user theme settings from API to next-themes
  useEffect(() => {
    if (mounted && settings?.general?.theme && settings.general.theme !== currentTheme) {
      setTheme(settings.general.theme);
    }
  }, [mounted, settings?.general?.theme, currentTheme, setTheme]);

  // Show a subtle loading state during initial client-side hydration or while verifying auth
  if (!mounted || isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  // If they are on a protected route but not authenticated, don't render the layout yet
  if (!isAuthenticated && !isAuth) {
    return null; 
  }

  if (isAuth) {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 w-full md:pl-[250px]">
        <Navbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {pathname && ROUTE_PERMISSIONS[pathname] ? (
            <PermissionGuard requiredPermission={ROUTE_PERMISSIONS[pathname]}>
              {children}
            </PermissionGuard>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
