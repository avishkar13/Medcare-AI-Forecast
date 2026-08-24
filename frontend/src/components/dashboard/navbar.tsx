"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Menu, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarContent } from "./sidebar";

export function Navbar() {
  const pathname = usePathname();

  // Basic breadcrumb logic based on pathname
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const currentPage = pathSegments.length > 0
    ? pathSegments[0].charAt(0).toUpperCase() + pathSegments[0].slice(1)
    : "Dashboard";

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">

      {/* Left side: Mobile menu & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[250px]">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>

        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pages</span>
          <h1 className="text-sm font-semibold text-foreground">{currentPage}</h1>
        </div>
      </div>

      {/* Right side: Search, Notifications, Avatar */}
      <div className="flex items-center gap-2 sm:gap-4">

        {/* Search */}
        <div className="relative hidden md:flex items-center w-64">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search inventory, SKU..."
            className="w-full rounded-md bg-muted/50 pl-9 border border-border focus-visible:bg-transparent h-9 text-sm"
          />
        </div>

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" className="relative h-9 w-9 cursor-pointer" />}>
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            <span className="sr-only">Notifications</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications</p>
          </TooltipContent>
        </Tooltip>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1 cursor-pointer" />}>
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">SA</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Jane Doe</p>
                <p className="text-xs leading-none text-muted-foreground">
                  jane.doe@medcare.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
