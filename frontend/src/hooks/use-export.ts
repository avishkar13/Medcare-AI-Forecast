"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadFile } from "@/lib/api/client";
import type { QueryParams } from "@/lib/api/types";

/**
 * The CSV exports, as a mutation rather than a query.
 *
 * A download is an action with a side effect on the user's disk, not cached server
 * state - caching it would mean a second click silently re-saving a stale file.
 *
 * The filters passed here are the ones already on screen, so the file a planner gets
 * is the table they are looking at rather than the whole network.
 */
export interface ExportTarget {
  path: string;
  /** Used only if the server's `Content-Disposition` cannot be read. */
  fallbackName: string;
  /** What the file is, for the toast: "alerts", "stock positions". */
  label: string;
}

export function useExport(target: ExportTarget) {
  return useMutation({
    mutationFn: (params?: QueryParams) =>
      downloadFile(target.path, params, target.fallbackName),
    onSuccess: (result) => {
      toast.success(`Exported ${target.label}`, {
        description:
          result.rows === null
            ? result.filename
            : `${result.rows.toLocaleString()} rows · ${result.filename}`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Could not export ${target.label}`, { description: error.message });
    },
  });
}
