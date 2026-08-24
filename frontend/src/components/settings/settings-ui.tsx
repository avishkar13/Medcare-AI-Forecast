import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function SettingsSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 shadow-sm bg-background transition-all", className)}>
      {(title || description) && (
        <CardHeader className="pb-3 border-b border-border/40 px-5 pt-5">
          {title && <CardTitle className="text-sm font-bold tracking-tight">{title}</CardTitle>}
          {description && <CardDescription className="text-[13px] mt-1">{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn("p-5", !title && !description && "pt-5")}>
        {children}
      </CardContent>
    </Card>
  );
}

export function SettingsRow({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4", className)}>
      <div className="flex flex-col gap-1 flex-1 pr-4">
        <Label className="text-sm font-semibold text-foreground leading-none">{title}</Label>
        {description && (
          <p className="text-[13px] text-muted-foreground leading-snug max-w-[90%]">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex-shrink-0 flex items-center justify-end">
          {children}
        </div>
      )}
    </div>
  );
}

export function SettingsToggle({
  checked,
  onCheckedChange,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
