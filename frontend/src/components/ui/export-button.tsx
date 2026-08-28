"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExport, type ExportTarget } from "@/hooks/use-export";
import type { QueryParams } from "@/lib/api/types";

interface ExportButtonProps extends ExportTarget {
  /** The filters currently on screen, so the file matches the table. */
  params?: QueryParams;
  className?: string;
}

export function ExportButton({ params, className, ...target }: ExportButtonProps) {
  const exportCsv = useExport(target);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={className ?? "h-8 cursor-pointer gap-2 bg-background text-xs font-semibold"}
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.mutate(params)}
          />
        }
      >
        {exportCsv.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span>{exportCsv.isPending ? "Exporting…" : "Export CSV"}</span>
      </TooltipTrigger>
      <TooltipContent>
        Downloads the {target.label} currently filtered on this page, not the whole network.
      </TooltipContent>
    </Tooltip>
  );
}
