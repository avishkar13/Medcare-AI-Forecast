"use client";

import React from "react";
import { useAuthStore } from "@/store/auth.store";
import { ShieldAlert } from "lucide-react";

interface PermissionGuardProps {
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  requiredAllPermissions?: string[];
  children: React.ReactNode;
}

export function PermissionGuard({
  requiredPermission,
  requiredAnyPermission,
  requiredAllPermissions,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isInitializing } = useAuthStore();

  if (isInitializing) {
    return null; // app-shell handles global loading state
  }

  let hasAccess = true;

  if (requiredPermission && !hasPermission(requiredPermission)) {
    hasAccess = false;
  }
  if (requiredAnyPermission && !hasAnyPermission(requiredAnyPermission)) {
    hasAccess = false;
  }
  if (requiredAllPermissions && !hasAllPermissions(requiredAllPermissions)) {
    hasAccess = false;
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          You do not have the required permissions to view this page. If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
