"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Settings, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth.store";
import { SidebarContent } from "./sidebar";
import { NotificationCenter } from "./notification-center";
import { ScopeSelectors } from "./scope-selectors";
import { useSettings, useSaveSettings } from "@/hooks/use-settings";

function getInitials(name?: string) {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const { user, logout } = useAuthStore();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (settings?.general) {
      saveSettings.mutate({
        general: { ...settings.general, theme: newTheme }
      });
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/auth");
  };

  // Basic breadcrumb logic based on pathname
  const pathSegments = pathname?.split("/").filter(Boolean) || [];

  const currentPage =
    pathSegments.length > 0
      ? pathSegments[0].charAt(0).toUpperCase() +
        pathSegments[0].slice(1)
      : "Dashboard";

  const initials = getInitials(user?.name);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left side: Mobile menu & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
              />
            }
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </SheetTrigger>

          <SheetContent side="left" className="p-0 w-[250px]">
            <SheetTitle className="sr-only">
              Navigation Menu
            </SheetTitle>

            <SidebarContent />
          </SheetContent>
        </Sheet>

        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Pages
          </span>

          <h1 className="text-sm font-semibold text-foreground">
            {currentPage}
          </h1>
        </div>
      </div>

      {/* Right side: Scope, Notifications, Avatar */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/*
          Scope, not search. The input that stood here had no state and no handler.
          Suspense because `useScope` reads `useSearchParams`, which would otherwise
          opt every page rendering this layout out of static generation.
        */}
        <Suspense fallback={<div className="hidden md:block h-8 w-56" />}>
          <ScopeSelectors />
        </Suspense>

        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground hidden sm:flex"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        )}

        {/* Notifications */}
        <NotificationCenter />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full ml-1 cursor-pointer p-0"
              />
            }
          >
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56"
            align="end"
            sideOffset={8}
          >
            {/* User Information */}
            <div className="px-2 py-1.5">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name ?? "User"}
                </p>

                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.email ?? ""}
                </p>

                {user?.role?.name && (
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider pt-0.5">
                    {user.role.name}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Settings */}
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Logout */}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}