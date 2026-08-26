// a planning run takes tens of seconds, so anything polling it needs one interval
// rather than a guess per component.
export const PLANNING_POLL_MS = 2_000;

export const STALE_TIME = {
  // master data barely moves
  reference: 10 * 60 * 1000,
  // a dashboard is read constantly and only changes when a run completes
  dashboard: 60 * 1000,
  // lists a user is actively filtering
  list: 30 * 1000,
} as const;

export const DEFAULT_PAGE_SIZE = 50;
