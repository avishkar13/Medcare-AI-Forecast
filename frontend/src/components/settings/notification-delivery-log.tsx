"use client";

import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "./settings-ui";
import { useNotificationDeliveries, useTestNotification } from "@/hooks/use-alerts";
import { cn } from "@/lib/utils";

/**
 * What actually happened on each channel.
 *
 * Channel toggles above this used to be unverifiable: nothing read them, and nothing
 * reported on them, so the only way to learn that email was misconfigured was for an
 * alert to quietly fail to arrive. Every attempt is recorded, including the ones that
 * were never made, which is what makes "why did nothing send?" answerable.
 */

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-success/15 text-success-foreground border-success/30",
  FAILED: "bg-destructive/15 text-destructive border-destructive/30",
  SKIPPED: "bg-muted text-muted-foreground border-border",
};

const relativeTime = (iso: string): string => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

export function NotificationDeliveryLog() {
  const { data, isPending, isError } = useNotificationDeliveries({ pageSize: 25 });
  const test = useTestNotification();

  const deliveries = data?.data ?? [];

  return (
    <SettingsCard title="Delivery Log">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          The last 25 delivery attempts. <span className="font-medium">Skipped</span> means the
          channel was switched off or its provider is not configured.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 cursor-pointer text-xs font-semibold"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          {test.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          Send test
        </Button>
      </div>

      {isPending ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading delivery log…</p>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Could not load the delivery log.
        </p>
      ) : deliveries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing sent yet. Run detection from the Alerts page to generate activity.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="py-2 pr-3 font-bold">When</th>
                <th className="py-2 pr-3 font-bold">Channel</th>
                <th className="py-2 pr-3 font-bold">Status</th>
                <th className="py-2 pr-3 font-bold">Alert</th>
                <th className="py-2 font-bold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="align-top">
                  <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">
                    {relativeTime(delivery.createdAt)}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-foreground">{delivery.channel}</td>
                  <td className="py-2.5 pr-3">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-bold", STATUS_STYLE[delivery.status])}
                    >
                      {delivery.status}
                    </Badge>
                  </td>
                  <td className="max-w-[220px] truncate py-2.5 pr-3 text-foreground">
                    {delivery.alertTitle}
                  </td>
                  <td className="max-w-[260px] py-2.5 text-muted-foreground">
                    {delivery.error ?? delivery.recipient ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsCard>
  );
}
